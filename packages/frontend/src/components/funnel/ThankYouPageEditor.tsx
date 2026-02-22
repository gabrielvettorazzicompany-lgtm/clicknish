import { useState, useEffect } from 'react'
import { Save, Eye, Settings, CheckCircle, X, Trash2 } from 'lucide-react'
import { supabase } from '@/services/supabase'
import ImageUploader from '@/components/ImageUploader'
import { useI18n } from '@/i18n'

interface ThankYouPageContent {
    title?: string
    subtitle?: string
    description?: string
    image?: string
    imageShape?: 'circle' | 'square'
    showButton?: boolean
    buttonText?: string
    buttonLink?: string
    backgroundColor?: string
    textColor?: string
    // Configurações de fluxo
    autoRedirect?: boolean
    redirectDelay?: number
    nextPageUrl?: string
    showUpsellSection?: boolean
    useDefaultRedirect?: boolean
}

interface ThankYouPageEditorProps {
    pageId: string
    initialContent?: ThankYouPageContent
    onUpdate: () => void
}

export default function ThankYouPageEditor({ pageId, initialContent, onUpdate }: ThankYouPageEditorProps) {
    const { t } = useI18n()
    const [content, setContent] = useState<ThankYouPageContent>({
        title: 'Thank You for Your Purchase!',
        subtitle: 'Your order has been successfully processed',
        description: 'You will receive an email confirmation shortly with your purchase details and access instructions.',
        buttonText: 'Access Your Product',
        buttonLink: '#',
        showButton: false,
        backgroundColor: '#0f1117',
        textColor: '#ffffff',
        autoRedirect: false,
        redirectDelay: 5,
        nextPageUrl: '',
        showUpsellSection: false,
        imageShape: 'circle',
        useDefaultRedirect: true,
        ...initialContent
    })
    const [saving, setSaving] = useState(false)
    const [showEditor, setShowEditor] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (initialContent) {
            setContent(prev => ({ ...prev, ...initialContent }))
        }
    }, [initialContent])

    const handleSave = async () => {
        try {
            setSaving(true)

            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    content: content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)

            if (error) throw error

            onUpdate()
            alert(t('funnel_components.saved_success'))
        } catch (error) {
            console.error('Error saving page:', error)
            alert(t('funnel_components.error_saving_page'))
        } finally {
            setSaving(false)
        }
    }

    const handleContentChange = (field: keyof ThankYouPageContent, value: string | number | boolean) => {
        setContent(prev => ({ ...prev, [field]: value }))
    }

    const handleImageUpload = async (base64Data: string) => {
        if (!base64Data) {
            handleContentChange('image', '')
            return
        }

        try {
            setUploading(true)

            // Convert base64 to blob
            const response = await fetch(base64Data)
            const blob = await response.blob()
            const fileExt = blob.type.split('/')[1] || 'png'
            const filePath = `thankyou-pages/${pageId}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('marketplace-content')
                .upload(filePath, blob, { cacheControl: '3600', upsert: false })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('marketplace-content')
                .getPublicUrl(filePath)

            handleContentChange('image', publicUrl)
        } catch (err) {
            console.error('Upload error:', err)
            alert(t('funnel_components.upload_error'))
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-white">{t('funnel_components.thankyou_page')}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        {t('funnel_components.customize_post_purchase')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!showEditor ? (
                        <>
                            <button
                                onClick={() => setShowPreview(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded text-xs transition-colors"
                            >
                                <Eye size={14} />
                                {t('common.preview')}
                            </button>
                            <button
                                onClick={() => setShowEditor(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                            >
                                <Settings size={14} />
                                {t('funnel_components.edit_page')}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowEditor(false)}
                                className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded text-xs transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors disabled:opacity-50"
                            >
                                <Save size={14} />
                                {saving ? t('common.saving') : t('common.save')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Preview Card */}
            {!showEditor && !showPreview && (
                <div className="rounded p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-start gap-3">
                        {content.image && (
                            <img
                                src={content.image}
                                alt="Preview"
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                        )}
                        <div className="flex-1">
                            <h4 className="text-white text-xs font-medium mb-0.5">
                                {content.title || 'Thank You for Your Purchase!'}
                            </h4>
                            <p className="text-xs text-zinc-400 mb-1">
                                {content.subtitle || 'Your order has been successfully processed'}
                            </p>
                            {content.description && (
                                <p className="text-xs text-zinc-500 line-clamp-2">
                                    {content.description}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-gray-400">
                            {content.useDefaultRedirect !== false && (
                                <span className="flex items-center gap-1.5 text-green-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                    {t('funnel_components.auto_redirect_enabled')}
                                </span>
                            )}
                            {content.autoRedirect && content.nextPageUrl && (
                                <span className="flex items-center gap-1.5 text-blue-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    {t('funnel_components.custom_redirect_label')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Editor Form */}
            {showEditor && (
                <div className="space-y-6">
                    {/* Content Section */}
                    <div>
                        <h4 className="text-white text-xs font-medium mb-3">
                            {t('funnel_components.visual_content')}
                        </h4>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('common.title')}</label>
                                    <input
                                        type="text"
                                        value={content.title || ''}
                                        onChange={(e) => handleContentChange('title', e.target.value)}
                                        placeholder="Thank You for Your Purchase!"
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.subtitle_label')}</label>
                                    <input
                                        type="text"
                                        value={content.subtitle || ''}
                                        onChange={(e) => handleContentChange('subtitle', e.target.value)}
                                        placeholder="Your order has been successfully processed"
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('common.description')}</label>
                                <textarea
                                    value={content.description || ''}
                                    onChange={(e) => handleContentChange('description', e.target.value)}
                                    placeholder="You will receive an email confirmation shortly..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.image_label')}</label>
                                {content.image ? (
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={content.image}
                                            alt="Thank you page"
                                            className="w-16 h-16 rounded-lg object-cover border border-gray-300 dark:border-zinc-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleContentChange('image', '')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 hover:bg-red-100 dark:hover:bg-red-600/80 hover:border-red-300 dark:hover:border-red-600/80 text-red-600 dark:text-zinc-400 hover:text-red-700 dark:hover:text-white rounded text-xs transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            {t('funnel_components.remove')}
                                        </button>
                                        {uploading && (
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                {t('funnel_components.uploading')}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <ImageUploader
                                            onImageSelect={handleImageUpload}
                                            currentImage={content.image}
                                            placeholder="Click to select an image"
                                            aspectRatio="square"
                                        />
                                        {uploading && (
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                {t('funnel_components.uploading_to_server')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Image Shape */}
                            {content.image && (
                                <div>
                                    <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.image_shape')}</label>
                                    <div className="inline-flex bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded p-0.5 gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleContentChange('imageShape', 'circle')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${(content.imageShape || 'circle') === 'circle'
                                                ? 'bg-zinc-600 text-white shadow-sm'
                                                : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current" />
                                            {t('funnel_components.circle')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleContentChange('imageShape', 'square')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${content.imageShape === 'square'
                                                ? 'bg-zinc-600 text-white shadow-sm'
                                                : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            <div className="w-3.5 h-3.5 rounded-[3px] border-[1.5px] border-current" />
                                            {t('funnel_components.square')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.background_color')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={content.backgroundColor || '#0f1117'}
                                            onChange={(e) => handleContentChange('backgroundColor', e.target.value)}
                                            className="w-10 h-10 rounded bg-white dark:bg-zinc-900 cursor-pointer border border-gray-300 dark:border-zinc-800"
                                        />
                                        <input
                                            type="text"
                                            value={content.backgroundColor || '#0f1117'}
                                            onChange={(e) => handleContentChange('backgroundColor', e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.text_color')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={content.textColor || '#ffffff'}
                                            onChange={(e) => handleContentChange('textColor', e.target.value)}
                                            className="w-10 h-10 rounded bg-white dark:bg-zinc-900 cursor-pointer border border-gray-300 dark:border-zinc-800"
                                        />
                                        <input
                                            type="text"
                                            value={content.textColor || '#ffffff'}
                                            onChange={(e) => handleContentChange('textColor', e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Button Section */}
                    <div>
                        <h4 className="text-white text-xs font-medium mb-3">
                            {t('funnel_components.cta_button')}
                        </h4>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="showButton"
                                    checked={content.showButton || false}
                                    onChange={(e) => handleContentChange('showButton', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                    <label htmlFor="showButton" className="text-xs text-white cursor-pointer">{t('funnel_components.show_cta_button')}</label>
                                    <p className="text-xs text-zinc-500">{t('funnel_components.cta_disabled_hint')}</p>
                                </div>
                            </div>

                            {content.showButton && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.button_text_label')}</label>
                                        <input
                                            type="text"
                                            value={content.buttonText || ''}
                                            onChange={(e) => handleContentChange('buttonText', e.target.value)}
                                            placeholder="Access Your Product"
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-900 dark:text-white text-xs font-medium mb-1.5">{t('funnel_components.button_link')}</label>
                                        <input
                                            type="url"
                                            value={content.buttonLink || ''}
                                            onChange={(e) => handleContentChange('buttonLink', e.target.value)}
                                            placeholder="https://yoursite.com/access"
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Flow Configuration */}
                    <div>
                        <h4 className="text-gray-900 dark:text-white text-xs font-medium mb-3">
                            {t('funnel_components.post_purchase_flow')}
                        </h4>

                        <div className="space-y-4">
                            {/* Default Redirect */}
                            <div className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="useDefaultRedirect"
                                        checked={content.useDefaultRedirect !== false}
                                        onChange={(e) => handleContentChange('useDefaultRedirect', e.target.checked)}
                                        className="mt-1 w-4 h-4 text-green-600 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded focus:ring-green-500"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="useDefaultRedirect" className="text-xs font-medium text-gray-900 dark:text-white cursor-pointer">
                                            {t('funnel_components.enable_default_redirect')}
                                        </label>
                                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                                            {t('funnel_components.default_redirect_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Redirect */}
                            <div className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded">
                                <div className="flex items-start gap-3 mb-3">
                                    <input
                                        type="checkbox"
                                        id="autoRedirect"
                                        checked={content.autoRedirect || false}
                                        onChange={(e) => handleContentChange('autoRedirect', e.target.checked)}
                                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="autoRedirect" className="text-xs font-medium text-gray-900 dark:text-white cursor-pointer">
                                            {t('funnel_components.custom_redirect_upsell')}
                                        </label>
                                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                                            {t('funnel_components.custom_redirect_desc')}
                                        </p>
                                    </div>
                                </div>

                                {content.autoRedirect && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pl-7">
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">{t('funnel_components.delay_seconds')}</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={content.redirectDelay || 5}
                                                onChange={(e) => handleContentChange('redirectDelay', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">{t('funnel_components.destination_url')}</label>
                                            <input
                                                type="url"
                                                value={content.nextPageUrl || ''}
                                                onChange={(e) => handleContentChange('nextPageUrl', e.target.value)}
                                                placeholder="https://yoursite.com/upsell"
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-700"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Upsell Section */}
                            <div className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="showUpsellSection"
                                        checked={content.showUpsellSection || false}
                                        onChange={(e) => handleContentChange('showUpsellSection', e.target.checked)}
                                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="showUpsellSection" className="text-xs font-medium text-white cursor-pointer">
                                            {t('funnel_components.show_offers')}
                                        </label>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {t('funnel_components.show_offers_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Preview */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
                    <button
                        onClick={() => setShowPreview(false)}
                        className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-slate-800 rounded-md transition-all text-sm font-medium shadow-xl"
                    >
                        <X size={16} />
                        {t('funnel_components.close_preview')}
                    </button>

                    {/* Thank You Page Preview - minimal design */}
                    <div
                        className="min-h-screen bg-white flex flex-col items-center justify-center px-4"
                        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                    >
                        <div className="w-full max-w-md text-center">
                            {content.image ? (
                                <div className={`w-20 h-20 mx-auto mb-6 overflow-hidden ${content.imageShape === 'square' ? 'rounded-lg' : 'rounded-full'}`}>
                                    <img src={content.image} alt="Thank you" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="text-green-600" size={40} />
                                </div>
                            )}

                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                {content.title || 'Thank You for Your Purchase!'}
                            </h1>

                            <p className="text-gray-500 text-sm mb-8">
                                {content.subtitle || 'Your order has been confirmed'}
                            </p>

                            {/* Redirect info */}
                            {(content.useDefaultRedirect !== false || (content.autoRedirect && content.nextPageUrl)) && (
                                <p className="text-xs text-gray-400 mb-6">
                                    {content.autoRedirect && content.nextPageUrl
                                        ? t('funnel_components.redirecting_in', { seconds: content.redirectDelay || 5 })
                                        : t('funnel_components.redirecting_to_product')
                                    }
                                </p>
                            )}

                            {/* Button - hidden when redirect is active */}
                            {!(content.autoRedirect && content.nextPageUrl) && !(content.useDefaultRedirect !== false) && (
                                <button className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-medium">
                                    {content.showButton ? (content.buttonText || 'Access Your Product') : 'Access Your Product'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}