import { useState, useEffect } from 'react'
import { CreditCard, User } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useOnboarding } from '@/contexts/OnboardingContext'

export default function Admin() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { currentStep, completeStep } = useOnboarding()

    // Detectar quando as configurações foram preenchidas
    const [hasPersonalInfo, setHasPersonalInfo] = useState(false)
    const [hasBankingInfo, setHasBankingInfo] = useState(false)

    useEffect(() => {
        // Quando ambas informações forem preenchidas, completa o step
        if (hasPersonalInfo && hasBankingInfo && currentStep === 'admin-config') {
            completeStep('admin-config')
        }
    }, [hasPersonalInfo, hasBankingInfo, currentStep])

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto mt-12">
                    <div className="max-w-5xl px-6 lg:px-8 py-10">


                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Admin Profile Card */}
                            <a
                                href="/admin/profile"
                                className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-lg border border-[#2a4060] p-5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                        <User className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-100">
                                        Admin Profile
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Configure your admin profile and personal information.
                                </p>
                            </a>

                            {/* Payments Card */}
                            <a
                                href="/admin/payments"
                                className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-lg border border-[#2a4060] p-5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                                        <CreditCard className="w-5 h-5 text-green-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-100">
                                        Payments
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Manage your payment details and payout settings.
                                </p>
                            </a>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}