import { memo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, Package, DollarSign, Users, BarChart3, Store, Settings, Zap, CreditCard, Percent } from 'lucide-react'

function UtmifyIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Top node */}
            <circle cx="12" cy="3" r="2" fill="currentColor" />
            {/* Bottom-left node */}
            <circle cx="5" cy="19" r="2" fill="currentColor" />
            {/* Bottom-right node */}
            <circle cx="19" cy="19" r="2" fill="currentColor" />
            {/* Vertical stem: top node down to fork */}
            <line x1="12" y1="5" x2="12" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Left branch */}
            <line x1="12" y1="11" x2="5" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Right branch */}
            <line x1="12" y1="11" x2="19" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}
import { useI18n } from '@/i18n'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { usePrefetch } from '@/hooks/usePrefetch'

interface SidebarProps {
    isOpen?: boolean
    onClose?: () => void
}

const Sidebar = memo(function Sidebar({ isOpen, onClose }: SidebarProps) {
    const location = useLocation()
    const { t } = useI18n()
    const { currentStep, completeStep } = useOnboarding()
    const { prefetch } = usePrefetch()

    const menuItems = [
        { path: '/dashboard', icon: Home, label: t('sidebar.dashboard') },
        { path: '/customers', icon: Users, label: t('sidebar.customers') },
        { path: '/orders', icon: ShoppingCart, label: t('sidebar.orders') },
        { path: '/products', icon: Package, label: t('sidebar.products') },
        { path: '/checkouts', icon: CreditCard, label: t('sidebar.checkouts') },
        { path: '/funnels', icon: Zap, label: t('sidebar.funnels') },
        { path: '/finance', icon: DollarSign, label: t('sidebar.finance') },
        { path: '/taxes', icon: Percent, label: t('sidebar.taxes') },
        { path: '/integrations', icon: UtmifyIcon, label: t('sidebar.integrations') },
    ]

    const salesChannels = [
        { path: '/marketplace', icon: Store, label: t('sidebar.marketplace') },
    ]

    const isActive = (path: string) => {
        // Feed, Notifications, Community, App Builder and Checkout Builder pages should highlight Products
        if (path === '/products' && (
            location.pathname.startsWith('/feed/') ||
            location.pathname.startsWith('/notifications/') ||
            location.pathname.startsWith('/community/') ||
            location.pathname.startsWith('/app-builder/') ||
            location.pathname.startsWith('/checkout-builder/')
        )) {
            return true
        }
        // Funnel editor pages should highlight Funnels menu item, not Admin
        if (path === '/funnels' && location.pathname.startsWith('/admin/funnels/')) {
            return true
        }
        // Admin item should NOT be active when in funnel editor
        if (path === '/admin' && location.pathname.startsWith('/admin/funnels/')) {
            return false
        }
        return location.pathname === path || location.pathname.startsWith(path + '/')
    }

    return (
        <>
            {/* Overlay para mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed lg:sticky top-0 left-0 h-screen bg-white dark:bg-[#080b14]/90 dark:backdrop-blur-xl border-r border-gray-200 dark:border-white/10 z-50 group overflow-visible
          transform transition-all duration-300 ease-in-out pt-12
          ${isOpen ? 'w-44 translate-x-0' : 'w-12 lg:w-12 lg:hover:w-44 -translate-x-full lg:translate-x-0'}
        `}
            >
                <div className="flex flex-col h-full overflow-visible">
                    {/* Menu Items */}
                    <nav className="flex-1 overflow-y-auto py-2 px-1 overflow-x-visible">
                        <div className="space-y-0.5">
                            {menuItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.path)

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        onMouseEnter={() => prefetch(item.path)}
                                        className={`
                      flex items-center justify-center group-hover:justify-start group-hover:gap-2 px-1 py-1.5 rounded-lg transition-colors relative
                      ${active
                                                ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/30'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1d2e] hover:text-gray-900 dark:hover:text-gray-200'
                                            }
                    `}
                                    >
                                        <Icon size={20} className={`flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`} />
                                        <span className="text-xs font-medium w-0 overflow-hidden group-hover:w-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>

                        {/* Sales Channels */}
                        <div className="mt-3">
                            <div className="px-2 mb-1.5">
                                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    {t('sidebar.sales_channels')}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {salesChannels.map((item) => {
                                    const Icon = item.icon
                                    const active = isActive(item.path)

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={onClose}
                                            onMouseEnter={() => prefetch(item.path)}
                                            className={`
                        flex items-center justify-center group-hover:justify-start group-hover:gap-2 px-1 py-1.5 rounded-lg transition-colors
                        ${active
                                                    ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/30'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1d2e] hover:text-gray-900 dark:hover:text-gray-200'
                                                }
                      `}
                                        >
                                            <Icon size={20} className={`flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`} />
                                            <span className="text-xs font-medium w-0 overflow-hidden group-hover:w-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{item.label}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Admin Section - Fixo no final */}
                        <div className="border-t border-gray-200 dark:border-[#1e2139] p-1.5 flex-shrink-0 mt-auto relative overflow-visible">
                            <Link
                                to="/admin"
                                onClick={onClose}
                                onMouseEnter={() => prefetch('/admin')}
                                className={`
                      flex items-center justify-center group-hover:justify-start group-hover:gap-2 px-1 py-1.5 rounded-lg transition-colors relative
                      ${isActive('/admin')
                                        ? 'bg-gradient-to-r from-blue-500/20 to-[#252941]/20 text-blue-400 font-medium border border-blue-500/30'
                                        : 'text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200'
                                    }
                    `}
                            >
                                {/* Pulse Effect para onboarding */}
                                {currentStep === 'admin-config' && (
                                    <div className="absolute inset-0 rounded-lg animate-pulse-slow pointer-events-none z-0">
                                        <div className="absolute inset-0 rounded-lg bg-blue-500/30 animate-ping"></div>
                                        <div className="absolute inset-0 rounded-lg bg-blue-500/20"></div>
                                    </div>
                                )}

                                <Settings size={20} className={`flex-shrink-0 relative z-10 ${isActive('/admin') ? 'text-blue-400' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium w-0 overflow-hidden group-hover:w-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap relative z-10">{t('sidebar.admin')}</span>
                            </Link>
                        </div>
                    </nav>
                </div>
            </aside>
        </>
    )
})

export default Sidebar
