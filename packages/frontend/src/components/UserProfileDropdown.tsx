import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    DropdownSection,
} from '@heroui/react'

export default function UserProfileDropdown() {
    const { user, logout } = useAuthStore()
    const { t } = useI18n()
    const [adminProfile, setAdminProfile] = useState<{ full_name?: string; avatar_path?: string } | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const navigate = useNavigate()

    const refreshProfile = () => setRefreshKey(prev => prev + 1)

    useEffect(() => {
        // @ts-ignore
        window.refreshUserProfile = refreshProfile
        return () => { // @ts-ignore
            delete window.refreshUserProfile
        }
    }, [])

    useEffect(() => {
        const loadAdminProfile = async () => {
            if (!user?.id) return
            try {
                const { data, error } = await supabase
                    .from('admin_profiles')
                    .select('full_name, avatar_path')
                    .eq('user_id', user.id)
                    .single()

                if (data && !error) {
                    let profileData = { ...data }
                    if (data.avatar_path && !data.avatar_path.startsWith('http') && !data.avatar_path.startsWith('blob:')) {
                        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.avatar_path)
                        profileData.avatar_path = urlData.publicUrl
                    }
                    setAdminProfile(profileData)
                }
            } catch (e) {
                console.error('Error loading admin profile:', e)
            }
        }
        loadAdminProfile()
    }, [user?.id, refreshKey])

    const displayName = adminProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'
    const profileImage = adminProfile?.avatar_path || user?.user_metadata?.avatar_url || null
    const email = user?.email || ''

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    const handleAction = (key: React.Key) => {
        if (key === 'settings') navigate('/admin/profile')
        if (key === 'logout') { logout(); navigate('/') }
    }

    return (
        <Dropdown placement="bottom-end" radius="lg" shadow="lg">
            <DropdownTrigger>
                <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252941] transition-colors outline-none">
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 overflow-hidden flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 flex-shrink-0">
                        {profileImage ? (
                            <img
                                src={profileImage}
                                alt={displayName}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        ) : (
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {getInitials(displayName)}
                            </span>
                        )}
                    </div>
                    <span className="hidden sm:block text-xs font-medium text-gray-900 dark:text-gray-100 max-w-[100px] truncate">
                        {displayName}
                    </span>
                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </DropdownTrigger>

            <DropdownMenu
                aria-label="Perfil"
                onAction={handleAction}
                className="w-56 p-1"
                classNames={{
                    base: 'bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-[#2a2f45] rounded-2xl',
                }}
                itemClasses={{
                    base: 'gap-2 rounded-lg text-gray-700 dark:text-gray-300 data-[hover=true]:bg-gray-100 dark:data-[hover=true]:bg-[#252941]',
                    title: 'text-xs font-medium',
                }}
            >
                <DropdownSection showDivider aria-label={t('common.profile')} classNames={{ divider: 'bg-gray-200 dark:bg-[#2a2f45]' }}>
                    <DropdownItem
                        key="profile"
                        isReadOnly
                        className="opacity-100 cursor-default data-[hover=true]:bg-transparent dark:data-[hover=true]:bg-transparent"
                        textValue={displayName}
                    >
                        <div className="flex items-center gap-2 px-1 py-0.5">
                            <div className="w-8 h-8 rounded-full border-2 border-blue-500 overflow-hidden flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 flex-shrink-0">
                                {profileImage ? (
                                    <img
                                        src={profileImage}
                                        alt={displayName}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                ) : (
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        {getInitials(displayName)}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
                            </div>
                        </div>
                    </DropdownItem>
                </DropdownSection>

                <DropdownSection aria-label={t('common.actions')}>
                    <DropdownItem
                        key="settings"
                        startContent={<Settings size={14} className="text-blue-500" />}
                        className="text-xs text-gray-700 dark:text-gray-300"
                    >
                        {t('components.user_profile.manage_account')}
                    </DropdownItem>
                    <DropdownItem
                        key="logout"
                        startContent={<LogOut size={14} />}
                        color="danger"
                        className="text-xs text-danger data-[hover=true]:bg-red-50 dark:data-[hover=true]:bg-red-900/20"
                    >
                        {t('components.user_profile.logout')}
                    </DropdownItem>
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    )
}

