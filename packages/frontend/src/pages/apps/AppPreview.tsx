import { useParams } from 'react-router-dom'
import { Loader } from 'lucide-react'
import { useI18n } from '@/i18n'

export default function AppPreview() {
  const { appSlug } = useParams()
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <Loader className="animate-spin mx-auto mb-4 text-blue-400" size={32} />
        <h2 className="text-xl font-semibold text-gray-100">{t('common.loading')} {appSlug}</h2>
        <p className="text-gray-600 mt-2">{t('apps.app_being_prepared')}</p>
      </div>
    </div>
  )
}
