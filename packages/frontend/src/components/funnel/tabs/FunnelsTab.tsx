/**
 * Tab component for displaying and managing funnels list
 */

import { Plus, Search } from 'lucide-react'
import { Spinner } from '@heroui/react'
import { Funnel, FunnelFilters, StatusFilter } from '@/types/funnel'
import FunnelRow from '../FunnelRow'
import { useI18n } from '@/i18n'

interface FunnelsTabProps {
    funnels: Funnel[]
    loading: boolean
    filters: FunnelFilters
    onFiltersChange: {
        setSearchTerm: (term: string) => void
        setStatusFilter: (filter: StatusFilter) => void
    }
    onCreateClick: () => void
    onDeleteFunnel?: (funnel: Funnel) => void
    onDuplicateFunnel?: (funnel: Funnel) => void
}

export default function FunnelsTab({
    funnels,
    loading,
    filters,
    onFiltersChange,
    onCreateClick,
    onDeleteFunnel,
    onDuplicateFunnel
}: FunnelsTabProps) {
    const { t } = useI18n()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('funnels.heading')}
                </h1>
                <button
                    onClick={onCreateClick}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                >
                    <Plus size={15} />
                    {t('funnels.new_funnel')}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder={t('funnels.search_placeholder')}
                        value={filters.searchTerm}
                        onChange={(e) => onFiltersChange.setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-gray-200 dark:focus:border-white/10"
                    />
                </div>
                <select
                    value={filters.statusFilter}
                    onChange={(e) => onFiltersChange.setStatusFilter(e.target.value as StatusFilter)}
                    className="px-3 py-2 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                    <option value="all">{t('funnels.status.all')}</option>
                    <option value="active">{t('funnels.status.active')}</option>
                    <option value="draft">{t('funnels.status.draft')}</option>
                    <option value="paused">{t('funnels.status.paused')}</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Spinner size="md" color="primary" />
                    </div>
                ) : funnels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 dark:border-white/[0.06]">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('funnels.table.name')}</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('funnels.table.status')}</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('funnels.table.created_at')}</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('funnels.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {funnels.map((funnel) => (
                                    <FunnelRow
                                        key={funnel.id}
                                        funnel={funnel}
                                        actions={{
                                            onDelete: onDeleteFunnel,
                                            onDuplicate: onDuplicateFunnel
                                        }}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}