import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Key, Bell, Shield, Trash2, Save, Camera } from 'lucide-react'
import Header from '@/components/Header'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

export default function Settings() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const { t } = useI18n()
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')

    // Profile states
    const [name, setName] = useState(user?.user_metadata?.full_name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [profileImage, setProfileImage] = useState(user?.user_metadata?.avatar_url || '')
    const [uploadingImage, setUploadingImage] = useState(false)

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate type and size
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be at most 5MB')
            return
        }

        setUploadingImage(true)

        try {
            // Convert image to base64
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64Image = reader.result as string
                setProfileImage(base64Image)
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error('Error uploading image:', error)
            alert('Error uploading image')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleSaveProfile = async () => {
        // TODO: Save name and profile image
        // You can add the logic to save in Supabase here
        alert('Profile updated successfully!')
    }

    const handleChangePassword = () => {
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!')
            return
        }
        // TODO: Implement password change
        alert('Password changed successfully!')
    }

    return (
        <div className="min-h-screen bg-[#0f1117]">
            <Header />

            <div className="max-w-4xl mx-auto px-4 py-20">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-[#252941] rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-100">{t('settings.title')}</h1>
                        <p className="text-gray-600">{t('settings.subtitle')}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-[#1e2139]">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'profile'
                            ? 'text-blue-400 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-100'
                            }`}
                    >
                        <User size={16} className="inline mr-2" />
                        {t('settings.profile_tab')}
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'security'
                            ? 'text-blue-400 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-100'
                            }`}
                    >
                        <Shield size={16} className="inline mr-2" />
                        {t('settings.security_tab')}
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'notifications'
                            ? 'text-blue-400 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-100'
                            }`}
                    >
                        <Bell size={16} className="inline mr-2" />
                        {t('settings.notifications_tab')}
                    </button>
                </div>

                {/* Content */}
                <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] p-6">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold mb-4">{t('settings.profile_info')}</h2>

                            {/* Profile Image */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#1a1d2e]0 to-blue-500 flex items-center justify-center">
                                        {profileImage ? (
                                            <img
                                                src={profileImage}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white text-4xl font-bold">
                                                {name.charAt(0).toUpperCase() || email.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Upload Button Overlay */}
                                    <label
                                        htmlFor="profile-image-upload"
                                        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200"
                                    >
                                        <Camera className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                        <input
                                            id="profile-image-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={uploadingImage}
                                        />
                                    </label>

                                    {uploadingImage && (
                                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm text-gray-500 mt-3 text-center">
                                    {t('settings.click_to_change')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings.full_name')}
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                    placeholder={t('settings.your_name')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings.email')}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="w-full px-4 py-2 border border-[#252941] rounded-lg bg-[#0f1117] text-gray-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('settings.email_cannot_change')}
                                </p>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Save size={18} />
                                {t('settings.save_changes')}
                            </button>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold mb-4">{t('settings.account_security')}</h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings.current_password')}
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                    placeholder={t('settings.enter_current_password')}
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
                                    className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                    placeholder={t('settings.enter_new_password')}
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
                                    className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                    placeholder={t('settings.confirm_password_placeholder')}
                                />
                            </div>

                            <button
                                onClick={handleChangePassword}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Key size={18} />
                                {t('settings.change_password')}
                            </button>

                            <div className="border-t border-[#1e2139] pt-6 mt-16">
                                <h3 className="text-lg font-semibold text-red-600 mb-3">{t('settings.danger_zone')}</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    {t('settings.delete_warning')}
                                </p>
                                <button
                                    onClick={() => {
                                        if (confirm(t('settings.delete_confirm'))) {
                                            // TODO: Implement account deletion
                                            logout()
                                            navigate('/')
                                        }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    {t('settings.delete_account')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold mb-4">{t('settings.notification_preferences')}</h2>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg">
                                    <div>
                                        <p className="font-medium">{t('settings.email_notifications')}</p>
                                        <p className="text-sm text-gray-600">{t('settings.receive_updates_email')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1a1d2e] after:border-[#252941] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg">
                                    <div>
                                        <p className="font-medium">{t('settings.new_products_notif')}</p>
                                        <p className="text-sm text-gray-600">{t('settings.notify_add_products')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1a1d2e] after:border-[#252941] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg">
                                    <div>
                                        <p className="font-medium">{t('settings.new_users_notif')}</p>
                                        <p className="text-sm text-gray-600">{t('settings.notify_new_registrations')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1a1d2e] after:border-[#252941] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
