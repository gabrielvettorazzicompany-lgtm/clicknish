import { X } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface LessonForm {
    title: string
    description: string
    duration: string
    type: 'video' | 'pdf' | 'article' | 'quiz'
    video_url: string
    pdf_url: string
    content: string
    is_locked: boolean
}

interface LessonModalProps {
    isOpen: boolean
    onClose: () => void
    lessonForm: LessonForm
    setLessonForm: (form: LessonForm) => void
    onSave: (e: React.FormEvent) => void
    editingLesson: any
}

export default function LessonModal({
    isOpen,
    onClose,
    lessonForm,
    setLessonForm,
    onSave,
    editingLesson
}: LessonModalProps) {
    if (!isOpen) return null

    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold">
                        {editingLesson ? t('components.lesson_modal.edit_lesson') : t('components.lesson_modal.new_lesson')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={onSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.title')}</label>
                        <input
                            type="text"
                            value={lessonForm.title}
                            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                            className="w-full p-3 border border-[#252941] rounded-lg"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.description')}</label>
                        <textarea
                            value={lessonForm.description}
                            onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                            rows={3}
                            className="w-full p-3 border border-[#252941] rounded-lg"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.type')}</label>
                            <select
                                value={lessonForm.type}
                                onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as any })}
                                className="w-full p-3 border border-[#252941] rounded-lg"
                            >
                                <option value="video">{t('common.video')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.duration')}</label>
                            <input
                                type="text"
                                value={lessonForm.duration}
                                onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                                className="w-full p-3 border border-[#252941] rounded-lg"
                                placeholder={t('components.lesson_modal.duration_placeholder')}
                            />
                        </div>
                    </div>

                    {lessonForm.type === 'video' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('components.lesson_modal.lesson_video')}</label>
                            <div className="space-y-3">
                                {lessonForm.video_url && (
                                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-[#252941] bg-[#252941]">
                                        <video
                                            src={lessonForm.video_url}
                                            className="w-full h-full object-cover"
                                            controls
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setLessonForm({ ...lessonForm, video_url: '' })}
                                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            try {
                                                const fileExt = file.name.split('.').pop()
                                                const fileName = `${Math.random()}.${fileExt}`
                                                const filePath = `lesson-videos/${fileName}`

                                                const { error: uploadError } = await supabase.storage
                                                    .from('marketplace-content')
                                                    .upload(filePath, file)

                                                if (uploadError) throw uploadError

                                                const { data } = supabase.storage
                                                    .from('marketplace-content')
                                                    .getPublicUrl(filePath)

                                                setLessonForm({ ...lessonForm, video_url: data.publicUrl })
                                            } catch (error) {
                                                console.error('Erro ao fazer upload:', error)
                                                alert(t('components.lesson_modal.error_video_upload'))
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-3 border border-[#252941] rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-teal-700 hover:file:bg-teal-100"
                                />
                                <p className="text-xs text-gray-500">{t('components.lesson_modal.paste_video_url')}</p>
                                <input
                                    type="url"
                                    value={lessonForm.video_url}
                                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                                    className="w-full p-3 border border-[#252941] rounded-lg"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    )}

                    {lessonForm.type === 'pdf' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('components.lesson_modal.lesson_pdf')}</label>
                            <div className="space-y-3">
                                {lessonForm.pdf_url && (
                                    <div className="flex items-center justify-between p-3 bg-[#0f1117] border border-[#252941] rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">PDF</span>
                                            </div>
                                            <span className="text-sm text-gray-300">{t('components.lesson_modal.pdf_uploaded')}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLessonForm({ ...lessonForm, pdf_url: '' })}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            try {
                                                const fileName = `${Math.random()}.pdf`
                                                const filePath = `lesson-pdfs/${fileName}`

                                                const { error: uploadError } = await supabase.storage
                                                    .from('marketplace-content')
                                                    .upload(filePath, file)

                                                if (uploadError) throw uploadError

                                                const { data } = supabase.storage
                                                    .from('marketplace-content')
                                                    .getPublicUrl(filePath)

                                                setLessonForm({ ...lessonForm, pdf_url: data.publicUrl })
                                            } catch (error) {
                                                console.error('Error uploading:', error)
                                                alert(t('components.lesson_modal.error_pdf_upload'))
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-3 border border-[#252941] rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-teal-700 hover:file:bg-teal-100"
                                />
                                <p className="text-xs text-gray-500">{t('components.lesson_modal.paste_pdf_url')}</p>
                                <input
                                    type="url"
                                    value={lessonForm.pdf_url}
                                    onChange={(e) => setLessonForm({ ...lessonForm, pdf_url: e.target.value })}
                                    className="w-full p-3 border border-[#252941] rounded-lg"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    )}

                    {(lessonForm.type === 'article' || lessonForm.type === 'quiz') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.content')}</label>
                            <textarea
                                value={lessonForm.content}
                                onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                                rows={6}
                                className="w-full p-3 border border-[#252941] rounded-lg"
                            />
                        </div>
                    )}

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={lessonForm.is_locked}
                                onChange={(e) => setLessonForm({ ...lessonForm, is_locked: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-300">{t('components.lesson_modal.locked_lesson')}</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-300 border border-[#252941] rounded-lg hover:bg-[#0f1117]"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            {editingLesson ? t('components.lesson_modal.update_lesson') : t('components.lesson_modal.create_lesson')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}