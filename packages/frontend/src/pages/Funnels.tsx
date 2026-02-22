/**
 * Main Funnels page with refactored components
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import TabNav from '@/components/funnel/TabNav'
import FunnelsTab from '@/components/funnel/tabs/FunnelsTab'
import ScriptsTab from '@/components/funnel/tabs/ScriptsTab'
import OffersConfiguration from '@/components/funnel/OffersConfiguration'
import CreateFunnelModal from '@/components/funnel/modals/CreateFunnelModal'
import { useFunnels } from '@/hooks/useFunnels'

export default function Funnels() {
    const navigate = useNavigate()
    const {
        funnels,
        filteredFunnels,
        loading,
        creating,
        searchTerm,
        statusFilter,
        activeTab,
        setSearchTerm,
        setStatusFilter,
        setActiveTab,
        fetchFunnels,
        createFunnel,
        deleteFunnel,
        duplicateFunnel
    } = useFunnels()

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const handleCreateFunnel = async (createData: any) => {
        const funnelId = await createFunnel(createData)
        if (funnelId) {
            navigate(`/admin/funnels/${funnelId}`)
        }
        return !!funnelId
    }

    const handleDeleteFunnel = async (funnel: any) => {
        await deleteFunnel(funnel.id)
    }

    const handleDuplicateFunnel = async (funnel: any) => {
        await duplicateFunnel(funnel.id)
    }

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'funnels':
                return (
                    <FunnelsTab
                        funnels={filteredFunnels}
                        loading={loading}
                        filters={{ searchTerm, statusFilter }}
                        onFiltersChange={{
                            setSearchTerm,
                            setStatusFilter
                        }}
                        onCreateClick={() => setShowCreateModal(true)}
                        onDeleteFunnel={handleDeleteFunnel}
                        onDuplicateFunnel={handleDuplicateFunnel}
                    />
                )
            case 'scripts':
                return <ScriptsTab />
            case 'offers':
                return (
                    <OffersConfiguration
                        funnels={funnels}
                        onRefresh={fetchFunnels}
                    />
                )
            default:
                return null
        }
    }

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
                    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
                        <TabNav
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                        />

                        <div className="mt-6">
                            {renderActiveTab()}
                        </div>
                    </div>
                </main>
            </div>

            {/* Create Funnel Modal */}
            <CreateFunnelModal
                isOpen={showCreateModal}
                creating={creating}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateFunnel}
            />
        </div>
    )
}
