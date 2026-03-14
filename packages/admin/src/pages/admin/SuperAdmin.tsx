import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { adminFetch } from './adminApi'
import { DashboardTab } from './DashboardTab'
import { ReviewsTab } from './ReviewsTab'
import { UsersTab } from './UsersTab'
import { VerificationsTab } from './VerificationsTab'
import { PlansTab } from './PlansTab'
import { FinanceiroTab } from './FinanceiroTab'
import { ProvidersTab } from './ProvidersTab'
import { ConfigTab } from './ConfigTab'
import { AuditTab } from './AuditTab'
import { BroadcastTab } from './BroadcastTab'
import { SupportTab } from './SupportTab'

export default function SuperAdmin() {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState('dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)
    const [verifyCount, setVerifyCount] = useState(0)

    useEffect(() => {
        if (!user?.id) return
        adminFetch('/bank-verifications', user.id)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setVerifyCount((d.verifications || []).filter((v: any) => v.verification_status === 'pending').length) })
        adminFetch('/all-apps', user.id)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setPendingCount((d.apps || []).filter((a: any) => a.review_status === 'pending_review').length) })
    }, [user?.id])

    const NAV_TABS = [
        {
            id: 'dashboard', label: 'Dashboard', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>,
        },
        {
            id: 'reviews', label: t('superadmin.products_tab'), badge: pendingCount,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
        },
        {
            id: 'users', label: t('superadmin.users'), badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
        {
            id: 'verifications', label: t('superadmin.bank_verifications'), badge: verifyCount,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        },
        {
            id: 'plans', label: 'Planos', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
        },
        {
            id: 'config', label: 'Config', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
        {
            id: 'financial', label: 'Financeiro', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            id: 'providers', label: 'Provedores', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            id: 'broadcast', label: 'Broadcasts', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
        },
        {
            id: 'support', label: 'Suporte', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        },
        {
            id: 'audit', label: 'Audit Log', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        },
    ]

    return (
        <div className="min-h-screen bg-[#030712] flex">
            {/* Overlay mobile */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 w-60 bg-[#040810] border-r border-white/[0.06] flex flex-col z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                {/* Brand */}
                <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-white font-bold text-sm leading-none">Clicknich</p>
                            <p className="text-gray-600 text-[11px] mt-0.5">Super Admin</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    {NAV_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all text-left group ${activeTab === tab.id
                                ? 'bg-gray-700/70 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
                                }`}
                        >
                            <span className={activeTab === tab.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-400 transition-colors'}>{tab.icon}</span>
                            <span className="truncate">{tab.label}</span>
                            {tab.badge > 0 && (
                                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold leading-none flex-shrink-0 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600/40'}`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* System status */}
                <div className="px-4 pt-3 pb-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-400 font-medium">Sistemas OK</span>
                    </div>
                    {pendingCount > 0 && (
                        <button
                            onClick={() => setActiveTab('reviews')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/50 border border-gray-600/30 text-xs text-gray-300 hover:bg-gray-700/50 transition-colors font-medium mt-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            {pendingCount} pendentes
                        </button>
                    )}
                </div>

                {/* User + Logout */}
                <div className="px-3 pb-4 pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/40 to-violet-500/40 border border-white/[0.12] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user?.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 truncate leading-none">{user?.email}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">Super Admin</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            const { supabase } = await import('@/services/supabase')
                            const { useAuthStore: store } = await import('@/stores/authStore')
                            await supabase.auth.signOut()
                            store.getState().setUser(null)
                            window.location.href = '/login'
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 bg-white/[0.03] hover:bg-gray-800/50 border border-white/[0.06] hover:border-gray-600/30 rounded-lg transition-all"
                    >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 lg:ml-60 min-h-screen">
                {/* Mobile header */}
                <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#040810]">
                    <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="text-sm font-semibold text-white">Super Admin</span>
                </div>

                <div className="max-w-screen-2xl mx-auto px-6 py-6">
                    {activeTab === 'dashboard' && <DashboardTab userId={user?.id ?? ''} onNavigate={setActiveTab} />}
                    {activeTab === 'reviews' && <ReviewsTab userId={user?.id ?? ''} onPendingCountChange={setPendingCount} />}
                    {activeTab === 'users' && <UsersTab userId={user?.id ?? ''} />}
                    {activeTab === 'verifications' && <VerificationsTab userId={user?.id ?? ''} onCountChange={setVerifyCount} />}
                    {activeTab === 'plans' && <PlansTab userId={user?.id ?? ''} />}
                    {activeTab === 'broadcast' && <BroadcastTab userId={user?.id ?? ''} />}
                    {activeTab === 'support' && <SupportTab userId={user?.id ?? ''} />}
                    {activeTab === 'financial' && <FinanceiroTab />}
                    {activeTab === 'providers' && <ProvidersTab userId={user?.id ?? ''} />}
                    {activeTab === 'config' && <ConfigTab userId={user?.id ?? ''} />}
                    {activeTab === 'audit' && <AuditTab userId={user?.id ?? ''} />}
                </div>
            </div>
        </div>
    )
}
