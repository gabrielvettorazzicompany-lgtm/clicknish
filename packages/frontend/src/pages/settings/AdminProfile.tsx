import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Save, User, Mail, Phone, Calendar, Globe, DollarSign, Shield, Send, CheckCircle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/stores/authStore'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { supabase } from '@/services/supabase'
import { useI18n, type Language } from '@/i18n'

declare global {
  interface Window {
    refreshUserProfile?: () => void
  }
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'nl', label: 'Nederlands' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar Americano', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { value: 'BRL', label: 'BRL — Real Brasileiro', symbol: 'R$' },
  { value: 'CHF', label: 'CHF — Franco Suíço', symbol: 'Fr' },
]

export default function AdminProfile() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const { completeStep, currentStep } = useOnboarding()
  const { t, setLanguage } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [avatarUpdateKey, setAvatarUpdateKey] = useState(0)
  const [preferences, setPreferences] = useState<{ language: Language; currency: string }>({
    language: 'pt',
    currency: 'USD',
  })
  const [resetEmailLoading, setResetEmailLoading] = useState(false)
  const [resetEmailSuccess, setResetEmailSuccess] = useState(false)
  const [resetEmailError, setResetEmailError] = useState('')
  const [formData, setFormData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    phone: user?.user_metadata?.phone || '',
    location: user?.user_metadata?.location || '',
    bio: user?.user_metadata?.bio || '',
    avatar: user?.user_metadata?.avatar_url || ''
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadAdminProfile()
  }, [user, navigate])

  // Cleanup para URLs temporários quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (formData.avatar && formData.avatar.startsWith('blob:')) {
        URL.revokeObjectURL(formData.avatar)
      }
    }
  }, [formData.avatar])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return 'Data inválida'
    }
  }

  const loadAdminProfile = async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading admin profile:', error)
        return
      }

      if (data) {
        // Converter avatar_path para URL pública se necessário
        let avatarUrl = data.avatar_path || ''
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('blob:')) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(avatarUrl)
          avatarUrl = urlData.publicUrl
        }

        setFormData({
          fullName: data.full_name || '',
          email: user.email || '',
          phone: data.phone || '',
          location: '',
          bio: data.bio || '',
          avatar: avatarUrl
        })

        // Carregar preferências salvas
        const prefs = data.preferences || {}
        const savedLang = prefs.language as Language
        const lang: Language = ['pt', 'en', 'es', 'fr', 'de', 'nl'].includes(savedLang) ? savedLang : 'pt'
        const currency = prefs.currency || 'USD'
        setPreferences({ language: lang, currency })
        setLanguage(lang)
      }
    } catch (error) {
      console.error('Error loading admin profile:', error)
    }
  }

  const handleBack = () => {
    navigate('/admin')
  }

  const handleSave = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Verificar se já existe um perfil
      const { data: existingProfile } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const profileData = {
        user_id: user.id,
        full_name: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
        avatar_path: formData.avatar,
        preferences: { language: preferences.language, currency: preferences.currency }
      }

      let error
      if (existingProfile) {
        // Atualizar perfil existente
        const result = await supabase
          .from('admin_profiles')
          .update(profileData)
          .eq('user_id', user.id)
        error = result.error
      } else {
        // Criar novo perfil
        const result = await supabase
          .from('admin_profiles')
          .insert([profileData])
        error = result.error
      }

      if (error) throw error

      // Aplicar idioma imediatamente
      setLanguage(preferences.language)

      // Atualizar o user store para refletir as mudanças na UI
      if (user) {
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: formData.fullName,
            phone: formData.phone,
            bio: formData.bio,
            avatar_url: formData.avatar
          }
        }
        setUser(updatedUser)
      }

      alert(t('settings.admin_profile.profile_saved'))

      // Completar step 1 do onboarding se ainda não foi completado
      // Verifica se campos básicos estão preenchidos
      const hasBasicInfo = formData.fullName?.trim() && (formData.phone?.trim() || formData.bio?.trim())
      if (currentStep === 'admin-config' && hasBasicInfo) {
        try {
          await completeStep('admin-config')
        } catch (error) {
          console.error('Error completing onboarding step:', error)
        }
      }

      // Forçar refresh do UserProfileDropdown
      // @ts-ignore
      if (window.refreshUserProfile) {
        window.refreshUserProfile()
      }
    } catch (error: any) {
      console.error('Error saving admin profile:', error)
      alert(`${t('settings.admin_profile.error_saving')} ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendResetEmail = async () => {
    if (!user?.email) return
    setResetEmailLoading(true)
    setResetEmailSuccess(false)
    setResetEmailError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      if (error) throw error
      setResetEmailSuccess(true)
    } catch (err: any) {
      setResetEmailError(err.message || t('settings.admin_profile.reset_email_error'))
    } finally {
      setResetEmailLoading(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Preview imediato da imagem selecionada
    const previewUrl = URL.createObjectURL(file)
    setFormData(prev => ({ ...prev, avatar: previewUrl }))
    setAvatarUpdateKey(prev => prev + 1)

    setLoading(true)
    try {
      // Upload do arquivo para Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      // Obter URL pública da imagem
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl

      // Limpar URL temporário
      if (formData.avatar.startsWith('blob:')) {
        URL.revokeObjectURL(formData.avatar)
      }

      // Atualizar formData com URL para exibição
      setFormData(prev => ({ ...prev, avatar: avatarUrl }))
      setAvatarUpdateKey(prev => prev + 1)

      // Salvar no banco de dados imediatamente com o caminho relativo
      const profileData = {
        user_id: user.id,
        full_name: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
        avatar_path: fileName,
        updated_at: new Date().toISOString()
      }

      // Verificar se já existe um perfil para fazer upsert
      const { data: existingProfile } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingProfile) {
        await supabase
          .from('admin_profiles')
          .update(profileData)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('admin_profiles')
          .insert([profileData])
      }

      // Atualizar user store imediatamente
      if (user) {
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            avatar_url: avatarUrl
          }
        }
        setUser(updatedUser)

        // Forçar refresh do UserProfileDropdown
        // @ts-ignore
        if (window.refreshUserProfile) {
          window.refreshUserProfile()
        }
      }

    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      alert(`${t('settings.admin_profile.error_uploading')} ${error.message}`)

      // Fallback para base64 se o upload falhar
      const reader = new FileReader()
      reader.onload = (e) => {
        const newAvatar = e.target?.result as string
        setFormData(prev => ({ ...prev, avatar: newAvatar }))
        setAvatarUpdateKey(prev => prev + 1)

        if (user) {
          const updatedUser = {
            ...user,
            user_metadata: {
              ...user.user_metadata,
              avatar_url: newAvatar
            }
          }
          setUser(updatedUser)

          // Forçar refresh do UserProfileDropdown
          // @ts-ignore
          if (window.refreshUserProfile) {
            window.refreshUserProfile()
          }
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
        <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Navbar com Back Button */}
        <div className="sticky top-12 bg-white dark:bg-[#080b14]/80 dark:backdrop-blur-sm border-b border-gray-200 dark:border-white/10 z-[60] mt-12">
          <div className="px-6">
            <div className="flex items-center gap-4 py-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-xs font-medium"
              >
                <ArrowLeft size={16} />
                <span>{t('settings.admin_profile.back_to_admin')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-4">
            {/* Page Title */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('settings.admin_profile.title')}</h1>
              <p className="text-xs text-gray-600">{t('settings.admin_profile.subtitle')}</p>
            </div>

            {/* Profile Form */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] rounded-lg border border-gray-200 dark:border-[#2a4060] shadow-lg dark:shadow-2xl dark:shadow-black/20">
              <div className="p-2.5">
                {/* Avatar Section */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    {formData.avatar ? (
                      <img
                        key={avatarUpdateKey}
                        src={formData.avatar}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-3 border-gray-200 dark:border-[#1e2139]"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1a1d2e]0 to-blue-500 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {formData.fullName?.charAt(0).toUpperCase() || 'A'}
                        </span>
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full cursor-pointer transition-colors">
                      <Camera size={16} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('settings.admin_profile.profile_photo')}</h3>
                    <p className="text-gray-600 text-xs mb-1">{t('settings.admin_profile.upload_photo')}</p>
                    <p className="text-xs text-gray-500">{t('settings.admin_profile.photo_hint')}</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <User size={14} />
                      {t('settings.admin_profile.full_name')}
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full p-2 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder={t('settings.admin_profile.enter_full_name')}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <Mail size={16} />
                      {t('settings.admin_profile.email_address')}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      readOnly
                      className="w-full p-2 border border-gray-200 dark:border-[#1e2139] rounded-lg bg-gray-50 dark:bg-[#0f1117] text-gray-600 cursor-not-allowed text-sm"
                      placeholder={t('settings.admin_profile.enter_email')}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <Phone size={16} />
                      {t('settings.admin_profile.phone_number')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder={t('settings.admin_profile.enter_phone')}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.admin_profile.bio')}
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={2}
                    className="w-full p-2 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder={t('settings.admin_profile.bio_placeholder')}
                  />
                </div>

                {/* Account Info */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#1e2139]">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Calendar size={16} />
                    {t('settings.admin_profile.account_info')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">{t('settings.admin_profile.account_created')}</span>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('settings.admin_profile.last_sign_in')}</span>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : t('settings.admin_profile.never')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Preferences */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#1e2139]">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Globe size={16} />
                    {t('settings.admin_profile.dashboard_preferences')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Language */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('settings.admin_profile.dashboard_language')}
                      </label>
                      <select
                        value={preferences.language}
                        onChange={(e) => setPreferences(p => ({ ...p, language: e.target.value as Language }))}
                        className="w-full p-2 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white"
                      >
                        {LANGUAGES.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <DollarSign size={13} />
                        {t('settings.admin_profile.default_currency')}
                      </label>
                      <select
                        value={preferences.currency}
                        onChange={(e) => setPreferences(p => ({ ...p, currency: e.target.value }))}
                        className="w-full p-2 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white"
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.value} value={c.value}>{c.value}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#1e2139]">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Shield size={16} />
                    {t('settings.admin_profile.security')}
                  </h4>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('settings.admin_profile.reset_password_desc')}
                    </p>
                    {resetEmailSuccess ? (
                      <div className="flex items-center gap-2 text-green-500 text-sm">
                        <CheckCircle size={16} />
                        <span>{t('settings.admin_profile.reset_email_sent')}</span>
                      </div>
                    ) : (
                      <>
                        {resetEmailError && (
                          <p className="text-xs text-red-400">{resetEmailError}</p>
                        )}
                        <button
                          type="button"
                          onClick={handleSendResetEmail}
                          disabled={resetEmailLoading}
                          className="self-start flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          <Send size={14} />
                          {resetEmailLoading ? t('common.loading') : t('settings.admin_profile.send_reset_email')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="border-t border-gray-200 dark:border-[#1e2139] p-3 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  <Save size={16} />
                  {loading ? t('common.saving') : t('settings.save_changes')}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
