import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Chip, Spinner, Pagination } from '@heroui/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import FinanceCard from '@/components/finance/FinanceCard'
import FinanceFilters from '@/components/finance/FinanceFilters'
import WithdrawalTable from '@/components/finance/WithdrawalTable'
import TransfersTable from '@/components/finance/TransfersTable'
import AnticipationsTable from '@/components/finance/AnticipationsTable'
import WithdrawModal from '@/components/finance/WithdrawModal'
import AnticipationModal from '@/components/finance/AnticipationModal'
import { useFinance } from '@/hooks/useFinance'
import { useI18n } from '@/i18n'
import { supabase } from '@/services/supabase'
import type { PayoutSchedule } from '@/components/finance/WithdrawModal'

type TabType = 'withdrawals' | 'transfers' | 'anticipations'

const PAYOUT_SCHEDULES: PayoutSchedule[] = ['D+2', 'D+5', 'D+12']

export default function Finance() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('withdrawals')
    const [selectedSchedule, setSelectedSchedule] = useState<PayoutSchedule>('D+2')
    const [scheduleOpen, setScheduleOpen] = useState(false)
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
    const [anticipationModalOpen, setAnticipationModalOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedCurrency, setSelectedCurrency] = useState<string>('all')
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const ITEMS_PER_PAGE = 9

    const { withdrawals, transfers, anticipations, loading, stats, statsByCurrency, refresh } = useFinance({
        tab: activeTab,
        searchQuery: '',
        dateRange,
        selectedCurrency
    })

    const activeItems = activeTab === 'withdrawals' ? withdrawals : activeTab === 'transfers' ? transfers : anticipations
    const totalPages = Math.max(1, Math.ceil(activeItems.length / ITEMS_PER_PAGE))

    const filteredWithdrawals = useMemo(() =>
        withdrawals.filter(w => w.payoutSchedule === selectedSchedule),
        [withdrawals, selectedSchedule]
    )

    const paginatedWithdrawals = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredWithdrawals.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredWithdrawals, currentPage])

    const paginatedTransfers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return transfers.slice(start, start + ITEMS_PER_PAGE)
    }, [transfers, currentPage])

    const paginatedAnticipations = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return anticipations.slice(start, start + ITEMS_PER_PAGE)
    }, [anticipations, currentPage])

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: 'withdrawals', label: t('finance.tabs.withdrawals'), count: withdrawals.length },
        { id: 'transfers', label: t('finance.tabs.transfers'), count: transfers.length },
        { id: 'anticipations', label: t('finance.tabs.anticipations'), count: anticipations.length }
    ]

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        setCurrentPage(1)
    }

    const handleWithdrawConfirm = async (amount: number, schedule: PayoutSchedule) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Não autenticado')

        const response = await fetch('https://api.clicknich.com/api/finance/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                amount,
                schedule,
                currency: selectedCurrency === 'all' ? 'USD' : selectedCurrency,
            }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao solicitar saque')

        await refresh()
    }

    const handleAnticipationConfirm = async (amount: number) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Não autenticado')

        const response = await fetch('https://api.clicknich.com/api/finance/anticipate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, amount, currency: selectedCurrency === 'all' ? 'USD' : selectedCurrency }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao solicitar antecipação')

        await refresh()
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Modal de saque */}
            <WithdrawModal
                isOpen={withdrawModalOpen}
                onClose={() => setWithdrawModalOpen(false)}
                availableBalance={stats.availableBalance}
                currency={selectedCurrency === 'all' ? 'USD' : selectedCurrency}
                onConfirm={handleWithdrawConfirm}
            />

            {/* Modal de antecipação */}
            <AnticipationModal
                isOpen={anticipationModalOpen}
                onClose={() => setAnticipationModalOpen(false)}
                pendingBalance={stats.pendingBalance}
                currency={selectedCurrency === 'all' ? 'USD' : selectedCurrency}
                onConfirm={handleAnticipationConfirm}
            />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">

                        {/* Header e Filtros */}
                        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    {t('finance.title')}
                                </h1>
                            </div>
                            <FinanceFilters
                                dateRange={dateRange}
                                onDateRangeChange={setDateRange}
                                selectedCurrency={selectedCurrency}
                                onCurrencyChange={setSelectedCurrency}
                            />
                        </div>

                        {/* Cards de Saldo */}
                        {Object.keys(statsByCurrency).length > 0 ? (
                            <div className="space-y-4 mb-8">
                                {Object.entries(statsByCurrency)
                                    .filter(([currency]) => selectedCurrency === 'all' || currency === selectedCurrency.toUpperCase())
                                    .map(([currency, currStats]) => (
                                        <div key={currency} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FinanceCard type="available" value={currStats.availableBalance} currency={currency} onAction={() => setWithdrawModalOpen(true)} />
                                            <FinanceCard type="pending" value={currStats.pendingBalance} currency={currency} onAction={() => setAnticipationModalOpen(true)} />
                                            <FinanceCard type="anticipation" value={currStats.awaitingAnticipation} currency={currency} />
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <FinanceCard type="available" value={stats.availableBalance} currency={selectedCurrency === 'all' ? 'USD' : selectedCurrency} onAction={() => setWithdrawModalOpen(true)} />
                                <FinanceCard type="pending" value={stats.pendingBalance} currency={selectedCurrency === 'all' ? 'USD' : selectedCurrency} onAction={() => setAnticipationModalOpen(true)} />
                                <FinanceCard type="anticipation" value={stats.awaitingAnticipation} currency={selectedCurrency === 'all' ? 'USD' : selectedCurrency} />
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="border-b border-gray-300 dark:border-gray-800 mb-6">
                            <div className="flex gap-4 sm:gap-6 overflow-x-auto">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabChange(tab.id)}
                                        className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                            ? 'border-blue-500 text-gray-900 dark:text-gray-100'
                                            : 'border-transparent text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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

                        {/* Seletor de prazo D+2/D+5/D+12 */}
                        <div className="mb-5 flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('finance.select_release_period')}</span>
                            <div className="relative">
                                <button
                                    onClick={() => setScheduleOpen(!scheduleOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    {selectedSchedule}
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                                {scheduleOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-24 bg-white dark:bg-[#0f1420] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg z-10 overflow-hidden">
                                        {PAYOUT_SCHEDULES.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => { setSelectedSchedule(s); setScheduleOpen(false) }}
                                                className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${selectedSchedule === s ? 'text-blue-500 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabela */}
                        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-300 dark:border-white/10 rounded-xl overflow-hidden">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <Spinner color="primary" label={t('finance.loading')} labelColor="foreground" />
                                </div>
                            ) : activeTab === 'withdrawals' ? (
                                <WithdrawalTable withdrawals={paginatedWithdrawals} />
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