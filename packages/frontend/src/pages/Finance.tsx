import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Chip, Spinner, Pagination } from '@heroui/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import FinanceCard from '@/components/finance/FinanceCard'
import FinanceTable from '@/components/finance/FinanceTable'
import TransfersTable from '@/components/finance/TransfersTable'
import AnticipationsTable from '@/components/finance/AnticipationsTable'
import FinanceFilters from '@/components/finance/FinanceFilters'
import { useFinance } from '@/hooks/useFinance'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/hooks/useDebounce'

type TabType = 'extract' | 'transfers' | 'anticipations'

export default function Finance() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('extract')
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [selectedCurrency, setSelectedCurrency] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 9

    const { transactions, transfers, anticipations, loading, stats, statsByCurrency } = useFinance({
        tab: activeTab,
        searchQuery: debouncedSearchQuery,
        dateRange,
        selectedCurrency
    })

    const activeItems = activeTab === 'extract' ? transactions : activeTab === 'transfers' ? transfers : anticipations
    const totalPages = Math.max(1, Math.ceil(activeItems.length / ITEMS_PER_PAGE))

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return transactions.slice(start, start + ITEMS_PER_PAGE)
    }, [transactions, currentPage])

    const paginatedTransfers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return transfers.slice(start, start + ITEMS_PER_PAGE)
    }, [transfers, currentPage])

    const paginatedAnticipations = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return anticipations.slice(start, start + ITEMS_PER_PAGE)
    }, [anticipations, currentPage])

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: 'extract', label: t('finance.tabs.extract'), count: transactions.length },
        { id: 'transfers', label: t('finance.tabs.transfers'), count: transfers.length },
        { id: 'anticipations', label: t('finance.tabs.anticipations'), count: anticipations.length }
    ]

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        setCurrentPage(1)
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

                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {t('finance.title')}
                            </h1>
                        </div>

                        {/* Cards de Saldo */}
                        {selectedCurrency === 'all' ? (
                            <div className="space-y-4 mb-8">
                                {Object.entries(statsByCurrency).map(([currency, currStats]) => (
                                    <div key={currency} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FinanceCard
                                            type="available"
                                            value={currStats.availableBalance}
                                            currency={currency}
                                            onAction={() => { }}
                                        />
                                        <FinanceCard
                                            type="pending"
                                            value={currStats.pendingBalance}
                                            currency={currency}
                                            onAction={() => { }}
                                        />
                                        <FinanceCard
                                            type="anticipation"
                                            value={currStats.awaitingAnticipation}
                                            currency={currency}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <FinanceCard
                                    type="available"
                                    value={stats.availableBalance}
                                    currency={selectedCurrency}
                                    onAction={() => { }}
                                />
                                <FinanceCard
                                    type="pending"
                                    value={stats.pendingBalance}
                                    currency={selectedCurrency}
                                    onAction={() => { }}
                                />
                                <FinanceCard
                                    type="anticipation"
                                    value={stats.awaitingAnticipation}
                                    currency={selectedCurrency}
                                />
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
                            <div className="flex gap-6">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabChange(tab.id)}
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

                        {/* Search + Filtros */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder={t('finance.search_placeholder')}
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                                    className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20"
                                />
                            </div>
                            <FinanceFilters
                                dateRange={dateRange}
                                onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
                                selectedCurrency={selectedCurrency}
                                onCurrencyChange={(c) => { setSelectedCurrency(c); setCurrentPage(1) }}
                            />
                        </div>

                        {/* Tabela */}
                        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <Spinner color="primary" label={t('finance.loading')} labelColor="foreground" />
                                </div>
                            ) : activeTab === 'extract' ? (
                                <FinanceTable transactions={paginatedTransactions} />
                            ) : activeTab === 'transfers' ? (
                                <TransfersTable transfers={paginatedTransfers} />
                            ) : (
                                <AnticipationsTable anticipations={paginatedAnticipations} />
                            )}
                        </div>

                        {/* Paginação */}
                        {!loading && activeItems.length > ITEMS_PER_PAGE && (
                            <div className="flex justify-center mt-6">
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
                    </div>
                </main>
            </div>
        </div>
    )
}