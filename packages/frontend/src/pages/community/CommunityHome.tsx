import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Home,
    LogOut,
    TrendingUp,
    Play,
    DollarSign,
    Users
} from 'lucide-react'
import { useI18n } from '@/i18n'

interface CommunityUser {
    id: string
    name: string
    email: string
    avatar_url?: string
}

interface ContentCard {
    id: string
    title: string
    image: string
    type: 'video' | 'course' | 'ebook'
    badge?: string
}

export default function CommunityHome() {
    const navigate = useNavigate()
    const { communitySlug } = useParams<{ communitySlug: string }>()
    const { t } = useI18n()

    const [user, setUser] = useState<CommunityUser | null>(null)

    // Mock data - substituir por dados reais da API
    const totalSales = 16983.07
    const newSignup = { value: 39.90 }

    const [modules, setModules] = useState<ContentCard[]>([])

    useEffect(() => {
        // Verificar autenticação
        const token = localStorage.getItem(`product_member_token_${communitySlug}`)
        const userData = localStorage.getItem(`product_member_data_${communitySlug}`)

        if (!token || !userData) {
            navigate(`/members-login/${communitySlug}`)
            return
        }

        setUser(JSON.parse(userData))
    }, [communitySlug, navigate])


    const handleLogout = () => {
        localStorage.removeItem(`product_member_token_${communitySlug}`)
        localStorage.removeItem(`product_member_data_${communitySlug}`)
        navigate(`/members-login/${communitySlug}`)
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-r from-blue-500 to-blue-600 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-black border-r border-gray-800 flex flex-col">
                {/* Logo */}
                <div className="h-20 border-b border-gray-800 flex items-center px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1a1d2e] rounded-lg flex items-center justify-center">
                            <Users className="text-black" size={24} />
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-sm">Comunitu</h1>
                            <p className="text-gray-400 text-xs">IA Milionária</p>
                        </div>
                    </div>
                </div>

                {/* User Info */}
                <div className="p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{t('community.hello')},</p>
                            <p className="text-sm text-gray-400 truncate">{user.name.split(' ')[0]}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800 text-white font-medium">
                        <Home size={20} />
                        <span>{t('common.home')}</span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:from-blue-600 hover:to-blue-700 hover:text-white transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span className="font-medium">{t('community.support')}</span>
                        <span className="ml-auto text-xs bg-gray-700 px-2 py-0.5 rounded">(Seg à Sex)</span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:from-blue-600 hover:to-blue-700 hover:text-white transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="font-medium">{t('community.refund')}</span>
                    </button>
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">{t('community.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto">
                    {/* Hero Banner */}
                    <div className="relative h-[400px] bg-gradient-to-r from-pink-600 via-blue-600 to-pink-500 overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute inset-0" style={{
                                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
                                backgroundSize: '40px 40px'
                            }}></div>
                        </div>

                        <div className="relative h-full max-w-7xl mx-auto px-8 flex items-center">
                            <div className="flex-1">
                                <h1 className="text-white text-4xl md:text-5xl font-bold mb-4 leading-tight">
                                    Make from <span className="text-pink-200">$5,000</span> to <span className="text-pink-200">$10,000</span> per<br />
                                    month with +18 content from AI-created<br />
                                    models!
                                </h1>
                                <p className="text-white/90 text-lg mb-8 max-w-2xl">
                                    The new wave of the digital market has already begun... and those who enter now will <span className="font-bold">profit BIG</span> with +18 content and artificial intelligence.
                                </p>

                                {/* Stats Cards */}
                                <div className="flex gap-4">
                                    <div className="bg-[#1a1d2e]/95 backdrop-blur-sm rounded-xl p-4 min-w-[200px]">
                                        <p className="text-gray-600 text-sm mb-1">Total sales</p>
                                        <p className="text-2xl font-bold text-gray-100">$ {totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-[#1a1d2e]0 to-blue-600 rounded-xl p-4 flex items-center gap-3 min-w-[200px]">
                                        <div className="w-10 h-10 bg-[#1a1d2e] rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-white/80 text-xs">New subscription!</p>
                                            <p className="text-white font-bold">Amount: $ {newSignup.value.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hero Image */}
                            <div className="hidden lg:block relative w-[500px] h-full">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[450px] h-[350px]">
                                    <img
                                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop"
                                        alt="Model 1"
                                        className="absolute left-0 w-[180px] h-[280px] object-cover rounded-2xl shadow-2xl transform -rotate-6 hover:rotate-0 transition-transform duration-300"
                                    />
                                    <img
                                        src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop"
                                        alt="Model 2"
                                        className="absolute left-[120px] w-[180px] h-[300px] object-cover rounded-2xl shadow-2xl z-10 hover:scale-105 transition-transform duration-300"
                                    />
                                    <img
                                        src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop"
                                        alt="Model 3"
                                        className="absolute right-0 w-[180px] h-[280px] object-cover rounded-2xl shadow-2xl transform rotate-6 hover:rotate-0 transition-transform duration-300"
                                    />
                                </div>

                                {/* Decorative Wave */}
                                <div className="absolute bottom-0 left-0 right-0">
                                    <svg viewBox="0 0 500 150" className="w-full text-pink-400" preserveAspectRatio="none">
                                        <path d="M0,50 Q125,0 250,50 T500,50 L500,150 L0,150 Z" fill="currentColor" opacity="0.3" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="max-w-7xl mx-auto px-8 py-12">
                        <div className="mb-8">
                            <h2 className="text-white text-2xl font-bold mb-2">MILLIONAIRE AI METHOD</h2>
                            <p className="text-gray-400">The step-by-step guide to profit from the new digital wave!</p>
                        </div>

                        {/* Content Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {modules.map((card) => (
                                <div
                                    key={card.id}
                                    className="group cursor-pointer"
                                    onClick={() => navigate(`/community/${communitySlug}/module/${card.id}`)}
                                >
                                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-pink-500 to-blue-600">
                                        <img
                                            src={card.image}
                                            alt={card.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />

                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/80 via-black/20 to-transparent"></div>

                                        {/* Badge */}
                                        {card.badge && (
                                            <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-pink-500 text-white">
                                                {card.badge}
                                            </div>
                                        )}

                                        {/* Play Button */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 bg-[#1a1d2e]/95 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                                                <Play className="text-pink-600 ml-1" size={28} fill="currentColor" />
                                            </div>
                                        </div>

                                        {/* Neon Border Effect */}
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-blue-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    </div>

                                    <h3 className="text-white font-semibold text-lg group-hover:text-pink-400 transition-colors">
                                        {card.title}
                                    </h3>
                                </div>
                            ))}
                        </div>

                        {/* CTA Section */}
                        <div className="mt-16 bg-gradient-to-r from-pink-600 to-blue-600 rounded-2xl p-8 text-center">
                            <h3 className="text-white text-2xl font-bold mb-4">
                                {t('community.ready_to_start')}
                            </h3>
                            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
                                Access all exclusive content and start profiting with artificial intelligence today!
                            </p>
                            <button className="bg-[#1a1d2e] text-pink-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-[#252941] transition-all hover:scale-105 shadow-xl">
                                {t('community.start_lesson')}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
