import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/stores/authStore'
import StatCard from '@/components/dashboard/StatCard'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import FinancialSummary from '@/components/dashboard/FinancialSummary'
import PaymentMethods from '@/components/dashboard/PaymentMethods'
import DailySalesChart from '@/components/dashboard/DailySalesChart'
import InstallmentsCard from '@/components/dashboard/InstallmentsCard'
import WorldMapHighcharts from '@/components/dashboard/WorldMapHighcharts'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useSalesGeolocation } from '@/hooks/useSalesGeolocation'
import { useI18n } from '@/i18n'
import { supabase } from '@/services/supabase'
import type { CombinedItem } from '@/types/customers'

function Dashboard() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState('BRL')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [hideValues, setHideValues] = useState(false)
  const [selectedApp, setSelectedApp] = useState<string>('')
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('')
  const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([])

  // Buscar aplicações e produtos do marketplace
  useEffect(() => {
    const fetchAppsAndMarketplace = async () => {
      if (!user?.id) return

      try {
        // Buscar aplicações
        const { data: apps } = await supabase
          .from('applications')
          .select('id, name')
          .eq('user_id', user.id)

        // Buscar produtos do marketplace
        const { data: marketplace } = await supabase
          .from('marketplace_products')
          .select('id, name')
          .eq('user_id', user.id)

        const combined: CombinedItem[] = [
          ...(apps || []).map(app => ({ id: app.id, name: app.name, type: 'app' as const })),
          ...(marketplace || []).map(p => ({ id: p.id, name: p.name, type: 'marketplace' as const }))
        ]
        setCombinedItems(combined)
      } catch (error) {
        console.error('Error fetching apps and marketplace:', error)
      }
    }

    fetchAppsAndMarketplace()
  }, [user?.id])

  const { stats, loading: loadingStats } = useDashboardStats(
    user?.id,
    dateRange,
    selectedApp,
    selectedMarketplace,
    selectedCurrency
  )

  // Conectar aos dados de vendas com localização da tabela sale_locations
  const { countries, loading: loadingGeolocation } = useSalesGeolocation(user?.id)

  const formatCurrency = (value: number) => {
    if (hideValues) return `${selectedCurrency} •••`
    const locale = selectedCurrency === 'BRL' ? 'pt-BR' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: selectedCurrency
    }).format(value)
  }

  const formatPercent = (value: number) => {
    if (hideValues) return '••%'
    return `${value.toFixed(1)}%`
  }

  const ticketMedio = stats.salesCount > 0 ? stats.totalSales / stats.salesCount : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
      {/* Background glow orbs para efeito blur nos cards (dark mode) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
        <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto pt-14 px-4 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto mt-2 space-y-6">
            {/* Saudação personalizada */}


            {/* Filtros */}
            <div className="flex justify-end">
              <DashboardFilters
                selectedCurrency={selectedCurrency}
                dateRange={dateRange}
                hideValues={hideValues}
                combinedItems={combinedItems}
                selectedApp={selectedApp}
                selectedMarketplace={selectedMarketplace}
                onCurrencyChange={setSelectedCurrency}
                onDateRangeChange={setDateRange}
                onToggleValues={() => setHideValues(!hideValues)}
                onAppChange={(value) => {
                  const item = combinedItems.find(item => item.id === value)
                  if (item?.type === 'app') {
                    setSelectedApp(value)
                    setSelectedMarketplace('')
                  } else if (item?.type === 'marketplace') {
                    setSelectedMarketplace(value)
                    setSelectedApp('')
                  } else {
                    setSelectedApp('')
                    setSelectedMarketplace('')
                  }
                }}
              />
            </div>

            {/* Row 1: 3 stat cards principais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title={t('dashboard.total_sales')}
                value={formatCurrency(stats.totalSales)}
                subtitle={t('dashboard.during_period')}
                color="indigo"
                loading={loadingStats}
              />
              <StatCard
                title={t('dashboard.avg_ticket')}
                value={formatCurrency(ticketMedio)}
                subtitle={t('dashboard.sales_count', { count: stats.salesCount })}
                color="violet"
                loading={loadingStats}
              />
              <StatCard
                title={t('dashboard.to_receive')}
                value={formatCurrency(stats.pendingAmount)}
                subtitle={t('dashboard.processing_payments')}
                color="emerald"
                loading={loadingStats}
              />
            </div>

            {/* Row 2: Mapa Mundial + Resumo Financeiro */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <WorldMapHighcharts
                  data={countries}
                  loading={loadingGeolocation}
                />
              </div>
              <div className="flex flex-col gap-4">
                <FinancialSummary
                  conversionRate={stats.conversionRate}
                  chargebackRate={stats.chargebackRate}
                  refundCount={stats.refundCount}
                  hideValues={hideValues}
                  formatPercent={formatPercent}
                  loading={loadingStats}
                />
                <PaymentMethods
                  methods={stats.paymentMethods}
                  loading={loadingStats}
                  hideValues={hideValues}
                />
              </div>
            </div>

            {/* Row 3: Vendas Diárias */}
            <div className="grid grid-cols-1 gap-4">
              <DailySalesChart
                data={stats.dailySales}
                loading={loadingStats}
                formatCurrency={formatCurrency}
                selectedCurrency={selectedCurrency}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
