import { useNavigate } from 'react-router-dom'
import { useCreateAppStore } from '@/stores/createAppStore'
import { GeneralDataStep } from '@/components/CreateApp/GeneralDataStep'
import { VisualStyleStep } from '@/components/CreateApp/VisualStyleStep'
import { SupportChannelsStep } from '@/components/CreateApp/SupportChannelsStep'
import { VisualizationStep } from '@/components/CreateApp/VisualizationStep'
import { ChevronLeft, ChevronRight, Check, ArrowLeft, CheckCircle } from 'lucide-react'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

export function CreateAppPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  const steps = [
    { id: 1, name: t('apps.create.step_general_info'), description: t('apps.create.step_general_info_desc') },
    { id: 2, name: t('apps.create.step_visual_style'), description: t('apps.create.step_visual_style_desc') },
    { id: 3, name: t('apps.create.step_support_channels'), description: t('apps.create.step_support_channels_desc') },
    { id: 4, name: t('apps.create.step_preview'), description: t('apps.create.step_preview_desc') },
  ]
  const { formData, currentStep, isLoading, setCurrentStep, nextStep, prevStep: _prevStep, resetForm, setIsLoading } =
    useCreateAppStore()

  const handleNext = async () => {
    // Validação do nome na primeira etapa
    if (currentStep === 1 && !formData.name.trim()) {
      alert(t('apps.create.enter_app_name_alert'))
      return
    }

    if (currentStep < 4) {
      nextStep()
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t('apps.create.enter_app_name_alert'))
      return
    }

    setIsLoading(true)
    try {
      const appData = {
        name: formData.name.trim(),
        slug: formData.name.toLowerCase().replace(/\s+/g, '-'),
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        showNames: formData.displayNames,
        highlightCommunity: !formData.disableCommunity,
        freeRegistration: formData.enableFreeRegistration,
        appType: mapAppType(formData.appType),
        language: formData.language,
        supportEmail: formData.supportEmail || '',
        whatsappNumber: formData.whatsappNumber || ''
      }



      const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': 'temp-user-id'
        },
        body: JSON.stringify(appData)
      })



      if (response.ok) {
        const data = await response.json()


        // Mostrar mensagem informando que o app está pendente de aprovação
        alert(`✅ ${t('apps.create.app_created_success')}\n\n⏳ ${t('apps.create.app_pending_review')}`)

        resetForm()
        navigate('/apps')
      } else {
        const errorData = await response.text()
        console.error('Error in response:', errorData)
        throw new Error(`HTTP ${response.status}: ${errorData}`)
      }
    } catch (error: any) {
      console.error('Error creating app:', error)

      // Mostrar erro mais específico
      const errorMessage = error.response?.data?.error || error.message || ''
      alert(`${t('apps.create.error_creating_app')}: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Map app type from frontend to backend format
  const mapAppType = (appType: string) => {
    switch (appType) {
      case 'Login completo':
        return 'login-complete'
      case 'Login Social':
        return 'login-social'
      case 'Sem Login':
        return 'no-login'
      default:
        return 'login-complete'
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="bg-[#1a1d2e] border-b border-[#1e2139]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5" />
              {t('apps.create.back')}
            </button>
            <h1 className="text-2xl font-bold text-gray-100">{t('apps.create.new_app')}</h1>
            <div className="w-24" /> {/* Spacer to align title to center */}
          </div>

          {/* Breadcrumb tabs */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    if (step.id < currentStep || step.id === currentStep) {
                      setCurrentStep(step.id)
                    }
                  }}
                  disabled={step.id > currentStep && currentStep !== 4}
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition ${step.id < currentStep
                    ? 'bg-gray-400 text-white hover:bg-[#0f1117]0'
                    : step.id === currentStep
                      ? 'bg-gray-400 text-white'
                      : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                    }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition ${step.id < currentStep ? 'bg-gray-400' : 'bg-gray-200'
                      }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-lg font-semibold text-gray-100">{steps[currentStep - 1].name}</h2>
            <p className="text-sm text-gray-500">{steps[currentStep - 1].description}</p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/10 shadow-black/5 p-8">
          {currentStep === 1 && <GeneralDataStep />}
          {currentStep === 2 && <VisualStyleStep />}
          {currentStep === 3 && <SupportChannelsStep />}
          {currentStep === 4 && <VisualizationStep />}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-16 gap-4">
          <button
            onClick={handleNext}
            disabled={currentStep === 1}
            className="px-6 py-2 text-gray-300 bg-[#252941] rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('apps.create.previous')}
          </button>

          <div className="flex gap-4">
            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="px-6 py-2 text-white bg-blue-500 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {t('apps.create.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-8 py-2 text-white bg-green-600 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {isLoading ? t('apps.create.saving') : t('apps.create.save_app')}
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
