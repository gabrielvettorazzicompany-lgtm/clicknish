import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function Analytics() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-xl mx-auto px-4 lg:px-6 py-16">
                        <div className="flex flex-col items-center text-center">
                            {/* Icon */}
                            <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-[#1a1d2e] border border-gray-300 dark:border-[#2a2f45] flex items-center justify-center mb-6 transition-colors duration-200">
                                <BarChart3 className="w-8 h-8 text-gray-500 dark:text-gray-500" />
                            </div>

                            {/* Title */}
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
                                Analytics coming soon
                            </h1>

                            {/* Description */}
                            <p className="text-sm text-gray-600 dark:text-gray-500 max-w-sm transition-colors duration-200">
                                We're preparing complete dashboards for you to analyze your product performance.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}