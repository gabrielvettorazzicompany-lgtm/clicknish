import { create } from 'zustand'

export interface AppCreationData {
  // Dados Gerais
  name: string
  displayNames: boolean
  disableCommunity: boolean
  enableFreeRegistration: boolean
  language: string
  appType: string

  // Estilo Visual
  primaryColor: string
  secondaryColor: string
  logo?: File | null
  logoPreview?: string

  // Canais de Suporte
  supportEmail?: string
  whatsappNumber?: string

  // Visualização (calculada)
  preview?: {
    logoUrl?: string
    bannerUrl?: string
  }
}

export interface AppFormStore {
  formData: AppCreationData
  currentStep: number
  isLoading: boolean
  error?: string

  // Actions
  setFormData: (data: Partial<AppCreationData>) => void
  setCurrentStep: (step: number) => void
  setIsLoading: (loading: boolean) => void
  setError: (error?: string) => void
  resetForm: () => void
  nextStep: () => void
  prevStep: () => void
}

const initialData: AppCreationData = {
  name: '',
  displayNames: true,
  disableCommunity: false,
  enableFreeRegistration: false,
  language: 'pt',
  appType: 'Login Completo - E-mail e Senha',
  primaryColor: '#0052CC',
  secondaryColor: '#FF4081',
  logo: null,
  logoPreview: undefined,
  supportEmail: '',
  whatsappNumber: '',
}

export const useCreateAppStore = create<AppFormStore>((set) => ({
  formData: initialData,
  currentStep: 1,
  isLoading: false,
  error: undefined,

  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
      error: undefined,
    })),

  setCurrentStep: (step) => set({ currentStep: step }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  resetForm: () =>
    set({
      formData: initialData,
      currentStep: 1,
      isLoading: false,
      error: undefined,
    }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, 4),
    })),

  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 1),
    })),
}))
