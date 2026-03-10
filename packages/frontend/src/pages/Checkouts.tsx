import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, Spinner, Pagination } from '@heroui/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CheckoutsTable from '@/components/checkouts/CheckoutsTable'
import { useCheckouts, Checkout } from '@/hooks/useCheckouts'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

export default function Checkouts() {
    const { t } = useI18n()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 9

    const { checkouts, loading, error, stats, removeCheckout } = useCheckouts({
        searchQuery: '',
        statusFilter: 'all',
        productFilter: 'all',
        refreshKey
    })

    const totalPages = Math.max(1, Math.ceil(checkouts.length / ITEMS_PER_PAGE))
    const paginatedCheckouts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return checkouts.slice(start, start + ITEMS_PER_PAGE)
    }, [checkouts, currentPage])

    const handleCreateCheckout = () => {
        setCreateModalOpen(true)
    }

    const handleCheckoutCreated = () => {
        setRefreshKey(k => k + 1)
    }

    const handleDelete = async (checkout: Checkout) => {
        if (!confirm(t('checkouts.confirm_delete', { name: checkout.name }))) return
        try {
            const { error } = await supabase
                .from('checkouts')
                .delete()
                .eq('id', checkout.id)
            if (error) throw error
            removeCheckout(checkout.id)
        } catch (err) {
            console.error('Erro ao deletar checkout:', err)
            alert(t('checkouts.error_delete'))
        }
    }

    const getCheckoutShortUrl = async (checkout: Checkout): Promise<string | null> => {
        try {
            const { data: existingUrl } = await supabase
                .from('checkout_urls')
                .select('id')
                .eq('checkout_id', checkout.id)
                .maybeSingle()

            let shortId = existingUrl?.id

            if (!shortId) {
                const insertData = checkout.product_type === 'application'
                    ? { checkout_id: checkout.id, application_id: checkout.product_id }
                    : { checkout_id: checkout.id, member_area_id: checkout.product_id }

                const { data: newUrl, error } = await supabase
                    .from('checkout_urls')
                    .insert(insertData)
                    .select('id')
                    .single()
                if (error) throw error
                shortId = newUrl.id
            }

            return `${window.location.origin}/checkout/${shortId}`
        } catch (e) {
            console.error('Error generating checkout URL:', e)
            return null
        }
    }

    const handleCopyLink = async (checkout: Checkout) => {
        const url = await getCheckoutShortUrl(checkout)
        if (!url) return alert(t('checkouts.error_generate_link'))
        await navigator.clipboard.writeText(url)
        alert(t('checkouts.link_copied'))
    }

    const handleViewPage = async (checkout: Checkout) => {
        const url = await getCheckoutShortUrl(checkout)
        if (!url) return alert(t('checkouts.error_generate_link'))
        window.open(url, '_blank')
    }

    const handleEdit = (checkout: Checkout) => {
        navigate(`/checkout-builder/${checkout.product_id}/${checkout.id}`)
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            {/* Background glow orbs (dark mode) */}
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
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    {t('checkouts.title')}
                                </h1>
                            </div>
                        </div>

                        {/* Tabela */}
                        <div className="bg-white dark:bg-white/[0.04] dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                            {/* Header bar da tabela */}
                            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
                                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('checkouts.table.your_checkouts')}
                                    {!loading && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500">
                                            {checkouts.length}
                                        </span>
                                    )}
                                </h2>
                            </div>
                            {error ? (
                                <div className="p-12 text-center">
                                    <p className="text-danger mb-2 text-sm">{error}</p>
                                    <Button size="sm" variant="light" color="primary" onPress={() => window.location.reload()}>
                                        {t('checkouts.try_again')}
                                    </Button>
                                </div>
                            ) : loading ? (
                                <div className="p-12 flex justify-center">
                                    <Spinner color="primary" label={t('checkouts.loading')} labelColor="foreground" />
                                </div>
                            ) : (
                                <>
                                    <CheckoutsTable
                                        checkouts={paginatedCheckouts}
                                        onDelete={handleDelete}
                                        onCopyLink={handleCopyLink}
                                        onViewPage={handleViewPage}
                                        onEdit={handleEdit}
                                    />
                                    {checkouts.length > ITEMS_PER_PAGE && (
                                        <div className="flex justify-center py-4">
                                            <Pagination
                                                showControls
                                                page={currentPage}
                                                total={totalPages}
                                                onChange={(page) => setCurrentPage(page)}
                                                classNames={{
                                                    cursor: 'bg-blue-600 text-white',
                                                }}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>


        </div>
    )
}
