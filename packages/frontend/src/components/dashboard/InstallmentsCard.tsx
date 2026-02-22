import { useI18n } from '@/i18n'

interface InstallmentsCardProps {
    loading: boolean
}

export default function InstallmentsCard({ loading }: InstallmentsCardProps) {
    const { t } = useI18n()
    return (
        <div className="bg-white border border-blue-500/20 rounded-xl p-6 shadow-sm hover:shadow-blue-100 transition-shadow">
            <h3 className="text-base font-semibold text-gray-800 mb-4">{t('dashboard_components.installments_card')}</h3>
            <div className="h-44 flex items-center justify-center">
                {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                ) : (
                    <p className="text-sm text-gray-400">{t('dashboard_components.no_installment_data')}</p>
                )}
            </div>
        </div>
    )
}
