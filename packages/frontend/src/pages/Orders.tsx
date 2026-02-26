import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input, Chip, Spinner, Pagination } from '@heroui/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OrderFilters from '@/components/orders/OrderFilters'
import OrdersTable from '@/components/orders/OrdersTable'
import { useOrders } from '@/hooks/useOrders'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/hooks/useDebounce'
import type { DateRange } from 'react-day-picker'

type TabType = 'all' | 'paid' | 'pending' | 'failed'

export default function Orders() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all')
    const [selectedProduct, setSelectedProduct] = useState<string>('all')
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 9

    const { orders, loading, stats } = useOrders({
        tab: activeTab,
        searchQuery: debouncedSearchQuery,
        paymentMethod: selectedPaymentMethod,
        dateRange,
        selectedProduct
    })

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: 'all', label: t('orders.tabs.all'), count: stats.all },
        { id: 'paid', label: t('orders.tabs.paid'), count: stats.paid },
        { id: 'pending', label: t('orders.tabs.pending'), count: stats.pending },
        { id: 'failed', label: t('orders.tabs.failed'), count: stats.failed }
    ]

    const totalPages = Math.max(1, Math.ceil(orders.length / ITEMS_PER_PAGE))
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return orders.slice(start, start + ITEMS_PER_PAGE)
    }, [orders, currentPage])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrders(new Set(orders.map(o => o.id)))
        } else {
            setSelectedOrders(new Set())
        }
    }

    const handleSelectOrder = (orderId: string, checked: boolean) => {
        const newSelected = new Set(selectedOrders)
        if (checked) {
            newSelected.add(orderId)
        } else {
            newSelected.delete(orderId)
        }
        setSelectedOrders(newSelected)
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
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {t('orders.title')}
                            </h1>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
                            <div className="flex gap-4 sm:gap-6 overflow-x-auto">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                            ? 'border-blue-500 text-gray-900 dark:text-gray-100'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <span className="font-medium text-sm">{tab.label}</span>
                                        <Chip size="sm" variant="flat" color={activeTab === tab.id ? 'secondary' : 'default'}>
                                            {tab.count}
                                        </Chip>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search and Actions */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <Input
                                    placeholder={t('orders.search_placeholder')}
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    startContent={<Search className="w-4 h-4 text-gray-400" />}
                                    variant="bordered"
                                    radius="md"
                                    classNames={{
                                        inputWrapper: 'bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-200 dark:border-white/10 hover:border-primary data-[focus=true]:border-primary',
                                        input: 'text-sm text-gray-900 dark:text-gray-100',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Filters */}
                        <OrderFilters
                            paymentMethod={selectedPaymentMethod}
                            onPaymentMethodChange={setSelectedPaymentMethod}
                            dateRange={dateRange}
                            onDateRangeChange={setDateRange}
                            selectedProduct={selectedProduct}
                            onProductChange={setSelectedProduct}
                        />

                        {/* Table */}
                        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <Spinner color="primary" label={t('orders.loading')} labelColor="foreground" />
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    {t('orders.empty')}
                                </div>
                            ) : (
                                <OrdersTable
                                    orders={paginatedOrders}
                                    selectedOrders={selectedOrders}
                                    onSelectAll={handleSelectAll}
                                    onSelectOrder={handleSelectOrder}
                                />
                            )}
                        </div>

                        {/* Pagination */}
                        {!loading && orders.length > 0 && (
                            <div className="flex justify-center mt-6">
                                <Pagination
                                    showControls
                                    page={currentPage}
                                    total={totalPages}
                                    onChange={(page) => { setCurrentPage(page); setSelectedOrders(new Set()) }}
                                    classNames={{
                                        cursor: 'bg-blue-600 text-white',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}