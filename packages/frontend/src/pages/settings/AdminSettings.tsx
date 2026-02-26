import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, User } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

function AdminSettings() {
    const navigate = useNavigate()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const handlePaymentsClick = () => {
        navigate('/admin/payments')
    }

    const handleProfileClick = () => {
        navigate('/admin/profile')
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-1.5">


                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Admin Profile Card */}
                            <button
                                onClick={handleProfileClick}
                                className="bg-white dark:bg-[#1a1d2e] rounded-xl border border-gray-200 dark:border-[#1e2139] p-3 text-left hover:shadow-2xl hover:shadow-blue-500/10 transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 transition-colors">
                                            Admin Profile
                                        </h3>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            Configure your admin profile and personal information.
                                        </p>
                                    </div>
                                </div>
                            </button>
                            {/* Payments Card */}
                            <button
                                onClick={handlePaymentsClick}
                                className="bg-white dark:bg-[#1a1d2e] rounded-xl border border-gray-200 dark:border-[#1e2139] p-3 text-left hover:shadow-2xl hover:shadow-blue-500/10 transition-all group"
                            >
                                <div className="flex items-start gap-3">

                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-400 transition-colors">
                                            Payments
                                        </h3>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            Manage your payment details and payout settings.
                                        </p>
                                    </div>
                                </div>
                            </button>




                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default AdminSettings
