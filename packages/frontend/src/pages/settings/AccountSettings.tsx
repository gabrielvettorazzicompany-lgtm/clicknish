import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Shield, Trash2, Upload, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import UserProfileDropdown from '@/components/UserProfileDropdown'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

function AccountSettings() {
    const { user, logout, setUser } = useAuthStore()
    const navigate = useNavigate()
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('profile')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Profile form states
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Security form states
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const tabs = [
        { id: 'profile', label: t('settings.profile_tab'), icon: User },
        { id: 'security', label: t('settings.security_tab'), icon: Shield },
        { id: 'danger', label: t('settings.danger_zone'), icon: Trash2 },
    ]

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 5000)
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            if (!validTypes.includes(file.type)) {
                showMessage('error', t('settings.invalid_file_type'))
                return
            }

            // Validate size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showMessage('error', t('settings.file_too_large'))
                return
            }

            setAvatarFile(file)

            // Create preview
            const reader = new FileReader()
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveProfile = async () => {
        if (!user) return

        setLoading(true)
        try {
            let avatarPath = null

            // 1. Upload avatar if exists
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop()
                const fileName = `${user.id}-${Date.now()}.${fileExt}`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('admin-avatars')
                    .upload(fileName, avatarFile, {
                        cacheControl: '3600',
                        upsert: true
                    })

                if (uploadError) {
                    throw new Error(`Error uploading avatar: ${uploadError.message}`)
                }

                avatarPath = uploadData.path
            }

            // 2. Update admin_profiles
            const updateData: any = {}
            if (fullName) updateData.full_name = fullName
            if (avatarPath) updateData.avatar_path = avatarPath

            const { error: profileError } = await supabase
                .from('admin_profiles')
                .upsert({
                    user_id: user.id,
                    ...updateData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })

            if (profileError) {
                throw new Error(`Error updating profile: ${profileError.message}`)
            }

            // 3. Update user_metadata in auth
            const { data: updatedUser, error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            })

            if (authError) {
                throw new Error(`Error updating authentication: ${authError.message}`)
            }

            // 4. Update local state
            if (updatedUser.user) {
                setUser(updatedUser.user)
            }

            showMessage('success', t('settings.profile_updated'))
            setAvatarFile(null)
            setAvatarPreview(null)

        } catch (error: any) {
            console.error('Error saving profile:', error)
            showMessage('error', error.message || t('settings.error_saving'))
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            showMessage('error', t('settings.fill_password_fields'))
            return
        }

        if (newPassword !== confirmPassword) {
            showMessage('error', t('settings.passwords_mismatch'))
            return
        }

        if (newPassword.length < 6) {
            showMessage('error', t('settings.password_min_length'))
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) {
                throw new Error(error.message)
            }

            showMessage('success', t('settings.password_updated'))
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')

        } catch (error: any) {
            console.error('Error updating password:', error)
            showMessage('error', error.message || t('settings.error_updating_password'))
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!confirm(t('settings.delete_confirm'))) {
            return
        }

        const confirmText = prompt(t('settings.type_delete_confirm'))
        if (confirmText !== 'DELETE') {
            showMessage('error', t('settings.incorrect_confirmation'))
            return
        }

        setLoading(true)
        try {
            // Here you should implement deletion logic
            // Normally this would be done through a backend function
            showMessage('error', t('settings.under_development'))
        } catch (error: any) {
            showMessage('error', error.message || t('settings.error_deleting_account'))
        } finally {
            setLoading(false)
        }
    }

    const getAvatarUrl = () => {
        if (avatarPreview) return avatarPreview

        // Fetch avatar from storage if exists
        // For now, returns null to use initials
        return null
    }

    const avatarUrl = getAvatarUrl()

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-14 bg-[#1a1d2e] border-b border-[#1e2139] flex items-center justify-between px-3 lg:px-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-100"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">{t('common.back')}</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <UserProfileDropdown />
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8">
                        <h1 className="text-3xl font-bold text-gray-100 mb-2">{t('settings.account_settings')}</h1>
                        <p className="text-gray-600 mb-8">
                            {t('settings.manage_info')}
                        </p>

                        {/* Message Alert */}
                        {message && (
                            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                                ? 'bg-green-50 border border-green-200 text-green-700'
                                : 'bg-red-50 border border-red-200 text-red-700'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Sidebar Tabs */}
                            <div className="lg:w-64 flex-shrink-0">
                                <div className="bg-[#1a1d2e] rounded-xl border border-[#1e2139] p-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                                    ? 'bg-blue-500/10 text-blue-400'
                                                    : 'text-gray-300 hover:bg-[#0f1117]'
                                                    }`}
                                            >
                                                <Icon size={18} />
                                                <span>{tab.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                <div className="bg-[#1a1d2e] rounded-xl border border-[#1e2139] p-6">
                                    {activeTab === 'profile' && (
                                        <div className="space-y-6">
                                            <h2 className="text-xl font-semibold text-gray-100">{t('settings.profile_info')}</h2>

                                            <div className="flex items-center gap-4">
                                                {avatarUrl ? (
                                                    <img
                                                        src={avatarUrl}
                                                        alt="Avatar"
                                                        className="w-20 h-20 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-20 h-20 bg-gradient-to-br from-[#1a1d2e]0 to-blue-600 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-2xl font-bold">
                                                            {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                                        onChange={handleAvatarChange}
                                                        className="hidden"
                                                    />
                                                    <button
                                                        onClick={handleAvatarClick}
                                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2"
                                                    >
                                                        <Upload size={16} />
                                                        {t('settings.change_photo')}
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-1">{t('settings.photo_hint')}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.full_name')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={fullName}
                                                        onChange={(e) => setFullName(e.target.value)}
                                                        className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                        placeholder={t('settings.your_full_name')}
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.email')}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={18} className="text-gray-400" />
                                                        <input
                                                            type="email"
                                                            value={user?.email || ''}
                                                            disabled
                                                            className="flex-1 px-4 py-2 border border-[#252941] rounded-lg bg-[#0f1117] text-gray-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.user_id')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={user?.id || ''}
                                                        disabled
                                                        className="w-full px-4 py-2 border border-[#252941] rounded-lg bg-[#0f1117] text-gray-500 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleSaveProfile}
                                                disabled={loading}
                                                className="w-full sm:w-auto px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin" />
                                                        {t('common.saving')}
                                                    </>
                                                ) : (
                                                    t('settings.save_changes')
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {activeTab === 'security' && (
                                        <div className="space-y-6">
                                            <h2 className="text-xl font-semibold text-gray-100">{t('settings.security_tab')}</h2>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.current_password')}
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                        placeholder="••••••••"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.new_password')}
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                        placeholder="••••••••"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {t('settings.confirm_new_password')}
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleChangePassword}
                                                disabled={loading}
                                                className="w-full sm:w-auto px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin" />
                                                        {t('settings.updating')}
                                                    </>
                                                ) : (
                                                    t('settings.update_password')
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {activeTab === 'danger' && (
                                        <div className="space-y-6">
                                            <h2 className="text-xl font-semibold text-red-600">{t('settings.danger_zone')}</h2>

                                            <div className="border border-red-200 rounded-lg p-6 bg-red-50">
                                                <h3 className="font-semibold text-gray-100 mb-2">{t('settings.delete_account')}</h3>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    {t('settings.irreversible_warning')}
                                                </p>
                                                <button
                                                    onClick={handleDeleteAccount}
                                                    disabled={loading}
                                                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {t('settings.delete_my_account')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default AccountSettings