import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface CreatePageModalProps {
    isOpen: boolean
    creating: boolean
    onClose: () => void
    onSubmit: (data: { name: string; pageType: string }) => Promise<boolean>
}

const PAGE_TYPES = [
    { value: 'upsell', labelKey: 'funnel_components.upsell_label', descKey: 'funnel_components.upsell_desc' },
    { value: 'downsell', labelKey: 'funnel_components.downsell_label', descKey: 'funnel_components.downsell_desc' }
]

export default function CreatePageModal({
    isOpen,
    creating,
    onClose,
    onSubmit
}: CreatePageModalProps) {
    const { t } = useI18n()
    const [formData, setFormData] = useState({
        name: '',
        pageType: ''
    })
    const [templateMode, setTemplateMode] = useState<'template' | 'scratch'>('template')

    useEffect(() => {
        if (!isOpen) {
            setFormData({ name: '', pageType: '' })
            setTemplateMode('template')
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim() || !formData.pageType) return

        const success = await onSubmit(formData)
        if (success) {
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#18181b] rounded-lg max-w-2xl w-full p-6 border border-gray-200 dark:border-[#27272a]">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('funnel_components.create_step')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        disabled={creating}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Nome */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('common.name')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={t('funnel_components.name_placeholder')}
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-[#27272a] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500 dark:focus:border-[#52525b]"
                            disabled={creating}
                            required
                        />
                    </div>

                    {/* Tipo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('common.type')} <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={formData.pageType}
                                onChange={(e) => setFormData(prev => ({ ...prev, pageType: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-[#27272a] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#52525b] appearance-none"
                                disabled={creating}
                                required
                            >
                                <option value="">{t('funnel_components.choose_step_type')}</option>
                                {PAGE_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {t(type.labelKey)}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>


                    </div>

                    {/* Botão Salvar */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#27272a]">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={creating}
                            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={creating || !formData.name.trim() || !formData.pageType}
                            className="px-6 py-2.5 bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] text-gray-900 dark:text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm border border-gray-300 dark:border-[#52525b] hover:border-gray-400 dark:hover:border-[#71717a]"
                        >
                            {creating ? t('funnel_components.creating') : t('funnel_components.create_step_btn')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
