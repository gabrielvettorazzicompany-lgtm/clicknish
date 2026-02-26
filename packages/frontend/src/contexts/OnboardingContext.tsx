import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'

type OnboardingStep = 'admin-config' | 'create-product' | 'completed'

interface OnboardingContextType {
    currentStep: OnboardingStep | null
    completeStep: (step: OnboardingStep) => Promise<void>
    isLoading: boolean
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthStore()
    const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (user) {
            loadOnboardingProgress()
        }
    }, [user])

    const loadOnboardingProgress = async () => {
        try {
            setIsLoading(true)

            // Verificar se a conta é muito antiga (mais de 7 dias) para não mostrar onboarding
            if (user?.created_at) {
                const accountAge = new Date().getTime() - new Date(user.created_at).getTime()
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24)

                // Se conta tem mais de 7 dias, marcar como completa automaticamente
                if (daysSinceCreation > 7) {
                    setCurrentStep('completed')
                    setIsLoading(false)
                    return
                }
            }

            const { data, error } = await supabase
                .from('user_settings')
                .select('onboarding_step')
                .eq('user_id', user?.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = not found, é esperado para novos usuários
                throw error
            }

            if (!data) {
                // Criar registro inicial para novo usuário
                const { error: insertError } = await supabase
                    .from('user_settings')
                    .insert({
                        user_id: user?.id,
                        onboarding_step: 'admin-config'
                    })

                if (insertError) throw insertError
                setCurrentStep('admin-config')
            } else {
                const step = data?.onboarding_step as OnboardingStep | null
                setCurrentStep(step || 'admin-config')
            }
            setIsLoading(false)
        } catch (error) {
            console.error('Error loading onboarding progress:', error)
            setIsLoading(false)
        }
    }

    const completeStep = async (step: OnboardingStep) => {
        try {
            let nextStep: OnboardingStep | null = null

            if (step === 'admin-config') {
                nextStep = 'create-product'
            } else if (step === 'create-product') {
                nextStep = 'completed'
            }

            // Atualiza no banco
            const { error } = await supabase
                .from('user_settings')
                .update({
                    onboarding_step: nextStep,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user?.id)

            if (error) throw error

            // Atualiza o estado local
            setCurrentStep(nextStep)
        } catch (error) {
            console.error('Error completing onboarding step:', error)
            throw error
        }
    }

    return (
        <OnboardingContext.Provider value={{ currentStep, completeStep, isLoading }}>
            {children}
        </OnboardingContext.Provider>
    )
}

export function useOnboarding() {
    const context = useContext(OnboardingContext)
    if (context === undefined) {
        throw new Error('useOnboarding must be used within OnboardingProvider')
    }
    return context
}
