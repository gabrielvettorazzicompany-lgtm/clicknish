import { useState, useEffect, useRef } from 'react'
import { X, Upload, Bold, Italic, Underline, List, ListOrdered, Link } from 'lucide-react'
import ImageUploader from './ImageUploader'
import { supabase } from '../services/supabase'
import { useI18n } from '@/i18n'

interface ContentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (contentData: any) => void
  content?: any
  isEditing?: boolean
}

export default function ContentModal({ isOpen, onClose, onSave, content, isEditing = false }: ContentModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: '',
    type: 'youtube',
    url: '',
    description: '',
    cover_url: '',
    attachments: [] as Array<{ name: string, url: string }>
  })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentFiles, setAttachmentFiles] = useState<Array<{ name: string, url: string }>>([])
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [fileUploaded, setFileUploaded] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [hasSelectedText, setHasSelectedText] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedSelectionRef = useRef<Range | null>(null)

  // Helper functions to save and restore selection
  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    if (editorRef.current) {
      editorRef.current.focus()
      if (savedSelectionRef.current) {
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(savedSelectionRef.current)
        }
      }
    }
  }

  const execFormatCommand = (command: string, value?: string) => {
    // Focus and restore selection first
    restoreSelection()
    // Execute the command - this toggles formatting for current selection or future typing
    document.execCommand(command, false, value)
    // Save selection after command to maintain cursor position
    saveSelection()
    // Update formData after formatting
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, description: editorRef.current?.innerHTML || '' }))
    }
  }

  const insertList = (ordered: boolean) => {
    if (!editorRef.current) return

    editorRef.current.focus()

    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''

    // Create list HTML
    const listTag = ordered ? 'ol' : 'ul'
    const listHtml = selectedText
      ? `<${listTag}><li>${selectedText}</li></${listTag}>`
      : `<${listTag}><li></li></${listTag}>`

    // Insert the list
    document.execCommand('insertHTML', false, listHtml)

    // Update formData
    setFormData(prev => ({ ...prev, description: editorRef.current?.innerHTML || '' }))
  }

  const openLinkModal = () => {
    saveSelection()
    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''
    setHasSelectedText(!!selectedText)
    setLinkText(selectedText)
    setLinkUrl('')
    setShowLinkModal(true)
  }

  const insertLink = () => {
    if (!editorRef.current || !linkUrl) return

    editorRef.current.focus()

    // If there's selected text, use createLink command
    if (hasSelectedText) {
      restoreSelection()
      document.execCommand('createLink', false, linkUrl)
    } else {
      // Insert link HTML directly using URL as text
      const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkUrl}</a>`
      document.execCommand('insertHTML', false, linkHtml)
    }

    // Update formData
    setFormData(prev => ({ ...prev, description: editorRef.current?.innerHTML || '' }))

    // Close modal and reset
    setShowLinkModal(false)
    setLinkUrl('')
    setLinkText('')
  }

  useEffect(() => {
    if (content && isEditing) {
      setFormData({
        name: content.name || '',
        type: content.type || 'youtube',
        url: content.url || '',
        description: content.description || '',
        cover_url: content.cover_url || '',
        attachments: content.attachments || []
      })
      setAttachmentFiles(content.attachments || [])

      // Atualizar o editor de texto rico
      if (editorRef.current) {
        if (content.description) {
          editorRef.current.innerHTML = content.description
          editorRef.current.style.color = '#e5e7eb'
        } else {
          editorRef.current.innerHTML = 'Enter content description here...'
          editorRef.current.style.color = '#6b7280'
        }
      }
    } else {
      resetForm()
    }
  }, [content, isEditing, isOpen])

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'youtube',
      url: '',
      description: '',
      cover_url: '',
      attachments: []
    })
    setUploading(false)
    setUploadProgress(0)
    setAttachmentFiles([])
    setUploadingAttachment(false)
    setSelectedFileName(null)
    setFileUploaded(false)

    // Limpar o editor de texto rico
    if (editorRef.current) {
      editorRef.current.innerHTML = t('components.content_modal.description_placeholder')
      editorRef.current.style.color = '#6b7280'
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setUploadProgress(0)

      // Determinar a pasta baseado no tipo
      const folder = formData.type === 'pdf' || formData.type === 'pdf-drive' ? 'pdfs' :
        formData.type === 'audio' ? 'audios' : 'videos'
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${folder}/${fileName}`



      // Upload para o Supabase Storage
      const { error } = await supabase.storage
        .from('content-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('[ContentModal] Upload error:', error)
        throw error
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('content-files')
        .getPublicUrl(filePath)



      setFormData(prev => ({ ...prev, url: publicUrl }))
      setUploadProgress(100)
      setFileUploaded(true)
      alert(t('components.content_modal.file_uploaded'))
    } catch (error: any) {
      console.error('[ContentModal] Error uploading file:', error)
      alert(`${t('components.content_modal.error_upload_file')} ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploadingAttachment(true)
      const uploadedFiles: Array<{ name: string, url: string }> = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `attachments/${fileName}`



        // Upload para o Supabase Storage
        const { error } = await supabase.storage
          .from('content-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error('[ContentModal] Attachment upload error:', error)
          throw error
        }

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('content-files')
          .getPublicUrl(filePath)

        uploadedFiles.push({
          name: file.name,
          url: publicUrl
        })
      }

      const newAttachments = [...attachmentFiles, ...uploadedFiles]
      setAttachmentFiles(newAttachments)
      setFormData(prev => ({ ...prev, attachments: newAttachments }))

      alert(t('components.content_modal.files_uploaded_count', { count: uploadedFiles.length }))
    } catch (error: any) {
      console.error('[ContentModal] Error uploading attachments:', error)
      alert(`${t('components.content_modal.error_upload_attachments')} ${error.message}`)
    } finally {
      setUploadingAttachment(false)
      // Reset input
      e.target.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    const newAttachments = attachmentFiles.filter((_, i) => i !== index)
    setAttachmentFiles(newAttachments)
    setFormData(prev => ({ ...prev, attachments: newAttachments }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()


    // Validação básica
    if (!formData.name.trim()) {
      alert(t('components.content_modal.name_required'))
      return
    }

    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center p-4 pb-6">
      <div className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] border border-[#2a4060] rounded-lg shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a4060]">
          <div>
            <h2 className="text-xs font-semibold text-gray-100">
              {isEditing ? t('components.content_modal.edit_content') : t('components.content_modal.new_content')}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {isEditing ? t('components.content_modal.update_info') : t('components.content_modal.add_materials')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-3 py-3 space-y-2.5">
          {/* Capa do Conteúdo */}
          <div>
            <label className="block text-[10px] font-medium text-gray-300 mb-1">
              {t('components.content_modal.content_cover')}
            </label>
            <ImageUploader
              onImageSelect={(imageData) => setFormData(prev => ({ ...prev, cover_url: imageData }))}
              currentImage={formData.cover_url}
              placeholder={t('components.content_modal.click_upload_cover')}
              aspectRatio="banner"
            />
          </div>

          {/* Nome do Conteúdo */}
          <div>
            <label className="block text-[10px] font-medium text-gray-300 mb-1">
              {t('components.content_modal.content_name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(t('components.content_modal.fill_field'))}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              placeholder={t('components.content_modal.name_placeholder')}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100 placeholder-gray-600"
            />
          </div>

          {/* Tipo de Conteúdo */}
          <div>
            <label className="block text-[10px] font-medium text-gray-300 mb-1">
              {t('components.content_modal.select_type')} <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              onInvalid={(e) => (e.target as HTMLSelectElement).setCustomValidity(t('components.content_modal.select_option'))}
              onInput={(e) => (e.target as HTMLSelectElement).setCustomValidity('')}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100"
            >
              <option value="">{t('components.content_modal.select_type')}</option>
              <option value="audio">{t('components.content_modal.audio')}</option>
              <option value="html">{t('components.content_modal.html')}</option>
              <option value="link">{t('components.content_modal.external_link')}</option>
              <option value="webpage">{t('components.content_modal.webpage')}</option>
              <option value="pdf-drive">{t('components.content_modal.google_drive_pdf')}</option>
              <option value="vimeo">{t('components.content_modal.vimeo')}</option>
              <option value="youtube">{t('components.content_modal.youtube')}</option>
              <option value="download">{t('components.content_modal.downloadable_file')}</option>
              <option value="embedded">{t('components.content_modal.embedded_file')}</option>
              <option value="vtub">{t('components.content_modal.vtub_panda')}</option>
            </select>
          </div>

          {/* File Upload - for PDFs and Audios */}
          {(formData.type === 'pdf-drive' || formData.type === 'audio') && (
            <div className="bg-blue-500/10 border border-[#2a4060] rounded-lg p-3">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                <Upload className="inline-block w-3 h-3 mr-1" />
                {t('components.content_modal.upload_from_device')}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  formData.type === 'pdf-drive'
                    ? '.pdf,.doc,.docx'
                    : formData.type === 'audio'
                      ? 'audio/*,.mp3,.wav,.ogg,.m4a,.aac'
                      : ''
                }
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setSelectedFileName(e.target.files[0].name)
                  }
                  handleFileUpload(e)
                }}
                disabled={uploading}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg hover:bg-[#1a1f2e] transition-colors text-gray-100 disabled:opacity-50"
                >
                  {t('components.content_modal.browse')}
                </button>
                <span className="text-sm text-gray-400 truncate flex-1">
                  {selectedFileName || t('components.content_modal.no_file_selected')}
                </span>
              </div>
              {uploading && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{t('components.content_modal.uploading')}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#252941] rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">
                {formData.type === 'pdf-drive'
                  ? t('components.content_modal.accepted_pdf')
                  : formData.type === 'audio'
                    ? t('components.content_modal.accepted_audio')
                    : ''}
              </p>
              {fileUploaded && selectedFileName && (
                <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                  <span>✓ {t('components.content_modal.file_ready')} {selectedFileName}</span>
                </div>
              )}
            </div>
          )}

          {/* URL - Hide for audio/pdf when file was uploaded */}
          {formData.type !== 'html' && formData.type !== 'vtub' && !(fileUploaded && (formData.type === 'audio' || formData.type === 'pdf-drive')) && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                {formData.type === 'pdf-drive'
                  ? t('components.content_modal.url_if_no_upload')
                  : t('components.content_modal.url_star')
                }
              </label>
              <input
                type="url"
                required={!formData.url}
                value={formData.url}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, url: e.target.value }))
                  setFileUploaded(false)
                }}
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(t('components.content_modal.fill_field'))}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                placeholder={
                  formData.type === 'youtube' ? 'https://youtube.com/watch?v=...' :
                    formData.type === 'vimeo' ? 'https://vimeo.com/...' :
                      formData.type === 'audio' ? 'https://example.com/audio.mp3' :
                        formData.type === 'pdf-drive' ? 'https://drive.google.com/file/d/...' :
                          formData.type === 'link' ? 'https://example.com' :
                            formData.type === 'webpage' ? 'https://example.com' :
                              formData.type === 'download' ? 'https://example.com/file.zip' :
                                formData.type === 'embedded' ? 'https://example.com/embed' :
                                  'Content URL'
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100 placeholder-gray-600"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                {formData.type === 'youtube' && t('components.content_modal.youtube_hint')}
                {formData.type === 'vimeo' && t('components.content_modal.vimeo_hint')}
                {formData.type === 'audio' && t('components.content_modal.audio_hint')}
                {formData.type === 'pdf-drive' && t('components.content_modal.gdrive_hint')}
                {formData.type === 'link' && t('components.content_modal.link_hint')}
                {formData.type === 'webpage' && t('components.content_modal.webpage_hint')}
                {formData.type === 'download' && t('components.content_modal.download_hint')}
                {formData.type === 'embedded' && t('components.content_modal.embedded_hint')}
                {!formData.type && t('components.content_modal.select_type_hint')}
              </p>
            </div>
          )}

          {/* Embed Code - only for Vtub type */}
          {formData.type === 'vtub' && (
            <div>
              <label className="block text-[10px] font-medium text-gray-300 mb-1">
                {t('components.content_modal.embed_code')} <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity(t('components.content_modal.fill_field'))}
                onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                placeholder={t('components.content_modal.embed_placeholder')}
                className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100 placeholder-gray-600 font-mono"
                rows={3}
              />
            </div>
          )}

          {/* HTML Code - only for HTML type */}
          {formData.type === 'html' && (
            <div>
              <label className="block text-[10px] font-medium text-gray-300 mb-1">
                {t('components.content_modal.html_code')} <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity(t('components.content_modal.fill_field'))}
                onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                placeholder={t('components.content_modal.html_placeholder')}
                className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100 placeholder-gray-600 font-mono"
                rows={4}
              />
            </div>
          )}

          {/* Descrição do Conteúdo */}
          <div>
            <label className="block text-[10px] font-medium text-gray-300 mb-1">
              {t('components.content_modal.content_description')}
            </label>

            {/* Barra de ferramentas do editor */}
            <div className="border border-[#252941] rounded-t-lg bg-[#0f1117] p-1.5 flex items-center gap-0.5 flex-wrap">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  execFormatCommand('bold')
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.bold')}
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  execFormatCommand('italic')
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.italic')}
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  execFormatCommand('underline')
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.underline')}
              >
                <Underline size={16} />
              </button>

              <div className="h-4 w-px bg-[#3a3f5c] mx-1" />

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertList(false)
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.list')}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertList(true)
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.numbered_list')}
              >
                <ListOrdered size={16} />
              </button>

              <div className="h-4 w-px bg-[#3a3f5c] mx-1" />

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  openLinkModal()
                }}
                className="p-1.5 rounded hover:bg-[#252941] transition-colors text-white"
                title={t('common.link')}
              >
                <Link size={16} />
              </button>
            </div>

            {/* Link Modal */}
            {showLinkModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]">
                <div className="bg-[#1a2035] border border-[#2a4060] rounded-lg p-4 w-80">
                  <h3 className="text-white font-medium mb-3">{t('components.content_modal.insert_link')}</h3>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('components.content_modal.url')}</label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-100"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowLinkModal(false)}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={insertLink}
                      disabled={!linkUrl}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {t('common.ok')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rich text editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onMouseUp={saveSelection}
              onKeyUp={saveSelection}
              onFocus={(e) => {
                if (e.currentTarget.textContent === t('components.content_modal.description_placeholder')) {
                  e.currentTarget.innerHTML = '';
                  e.currentTarget.style.color = '#e5e7eb';
                }
              }}
              onBlur={(e) => {
                saveSelection()
                if (e.currentTarget.innerHTML.trim() === '' || e.currentTarget.innerHTML === '<br>') {
                  e.currentTarget.innerHTML = t('components.content_modal.description_placeholder');
                  e.currentTarget.style.color = '#6b7280';
                  setFormData(prev => ({ ...prev, description: '' }));
                }
              }}
              onInput={(e) => {
                const content = e.currentTarget.innerHTML;
                if (content !== t('components.content_modal.description_placeholder')) {
                  setFormData(prev => ({ ...prev, description: content }));
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              className="w-full px-3 py-2 border border-[#252941] border-t-0 rounded-b-lg focus:outline-none focus:border-blue-500/50 min-h-[120px] max-h-[300px] overflow-y-auto bg-[#0f1117] content-editor"
              style={{
                fontSize: '14px',
                lineHeight: '1.5',
                fontFamily: 'inherit',
                color: '#6b7280'
              }}
            />
            <style>{`
              .content-editor ul {
                list-style-type: disc;
                padding-left: 1.5rem;
                margin: 0.5rem 0;
              }
              .content-editor ol {
                list-style-type: decimal;
                padding-left: 1.5rem;
                margin: 0.5rem 0;
              }
              .content-editor li {
                margin: 0.25rem 0;
              }
              .content-editor a {
                color: #60a5fa;
                text-decoration: underline;
              }
            `}</style>

            <p className="text-xs text-gray-500 mt-1">
              {t('components.content_modal.rich_text_hint')}
            </p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-[10px] font-medium text-gray-300 mb-1.5">
              {t('components.content_modal.attachments_optional')}
            </label>

            {/* Attachments list */}
            {attachmentFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                {attachmentFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-[#0f1117] rounded-lg">
                    <div className="flex items-center gap-2 flex-1">
                      <Upload size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-300 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-dashed border-[#252941] rounded-lg p-4 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              {uploadingAttachment ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">{t('components.content_modal.uploading_attachments')}</p>
                  <div className="w-full bg-[#252941] rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    {attachmentFiles.length > 0
                      ? t('components.content_modal.files_added', { count: attachmentFiles.length })
                      : t('components.content_modal.no_attachments')}
                  </p>
                  <label
                    htmlFor="attachment-upload"
                    className="mt-1 inline-block text-blue-400 hover:text-blue-300 text-xs font-medium cursor-pointer"
                  >
                    {t('common.choose_file')}
                  </label>
                  <input
                    id="attachment-upload"
                    type="file"
                    multiple
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.gif"
                  />
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {t('components.content_modal.attachments_hint')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-[#2a4060]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-gray-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {isEditing ? t('common.save') : t('components.content_modal.create_content')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}