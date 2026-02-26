import { X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface ModuleForm {
    title: string
    description: string
    module_number: string
    type: 'video' | 'article' | 'group' | 'resource'
    is_locked: boolean
    image_url: string
    badge: string
    badge_color: string
}

interface ModuleModalProps {
    isOpen: boolean
    onClose: () => void
    moduleForm: ModuleForm
    setModuleForm: (form: ModuleForm) => void
    onSave: (e: React.FormEvent) => void
    editingModule: any
    onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function ModuleModal({
    isOpen,
    onClose,
    moduleForm,
    setModuleForm,
    onSave,
    editingModule,
    onImageSelect
}: ModuleModalProps) {
    if (!isOpen) return null

    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold">
                        {editingModule ? t('components.module_modal.edit_module') : t('components.module_modal.new_module')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={onSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('components.module_modal.module_image')}</label>
                        <div className="space-y-3">
                            {moduleForm.image_url && (
                                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#252941]">
                                    <img
                                        src={moduleForm.image_url}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setModuleForm({ ...moduleForm, image_url: '' })}
                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={onImageSelect}
                                className="w-full px-4 py-3 border border-[#252941] rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-teal-700 hover:file:bg-teal-100"
                            />
                            <p className="text-xs text-gray-500">{t('components.module_modal.paste_image_url')}</p>
                            <input
                                type="url"
                                value={moduleForm.image_url}
                                onChange={(e) => setModuleForm({ ...moduleForm, image_url: e.target.value })}
                                className="w-full p-3 border border-[#252941] rounded-lg"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.title')}</label>
                        <input
                            type="text"
                            value={moduleForm.title}
                            onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                            className="w-full p-3 border border-[#252941] rounded-lg"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.description')}</label>
                        <textarea
                            value={moduleForm.description}
                            onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                            rows={3}
                            className="w-full p-3 border border-[#252941] rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={moduleForm.is_locked}
                                onChange={(e) => setModuleForm({ ...moduleForm, is_locked: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-300">{t('components.module_modal.locked_module')}</span>
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
                            {editingModule ? t('components.module_modal.update_module') : t('components.module_modal.create_module')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}