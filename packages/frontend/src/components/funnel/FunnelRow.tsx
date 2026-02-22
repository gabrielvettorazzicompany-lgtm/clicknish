/**
 * Individual funnel row component for the funnels table
 */

import { Trash2, Copy, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { Funnel, FunnelActions } from '@/types/funnel'
import { formatDate, getStatusLabel } from '@/utils/funnelUtils'
import { useI18n } from '@/i18n'

interface FunnelRowProps {
    funnel: Funnel
    actions?: FunnelActions
}

export default function FunnelRow({ funnel, actions }: FunnelRowProps) {
    const navigate = useNavigate()
    const { t } = useI18n()
    const [productName, setProductName] = useState<string>('')

    useEffect(() => {
        if (funnel.product_id) {
            fetchProductName()
        }
    }, [funnel.product_id])

    const fetchProductName = async () => {
        if (!funnel.product_id) return

        try {
            // Try fetching from member_areas first
            const { data: memberArea } = await supabase
                .from('member_areas')
                .select('name')
                .eq('id', funnel.product_id)
                .single()

            if (memberArea?.name) {
                setProductName(memberArea.name)
                return
            }

            // If not found, try in applications
            const { data: application } = await supabase
                .from('applications')
                .select('name')
                .eq('id', funnel.product_id)
                .single()

            if (application?.name) {
                setProductName(application.name)
            }
        } catch (error) {
            console.error('Error fetching product name:', error)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-500'
            case 'paused': return 'bg-yellow-500'
            case 'draft': return 'bg-gray-500'
            default: return 'bg-gray-500'
        }
    }

    const handleRowClick = () => {
        navigate(`/admin/funnels/${funnel.id}`)
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            case 'paused': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            case 'draft': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
            default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
        }
    }

    return (
        <tr
            className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
            onClick={handleRowClick}
        >
            <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                    <div>
                        <p className="text-gray-900 dark:text-gray-100 text-sm font-medium">{funnel.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{productName || funnel.domain || t('funnels.product_not_defined')}</p>
                    </div>
                </div>
            </td>
            <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(funnel.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(funnel.status)}`} />
                    {getStatusLabel(funnel.status)}
                </span>
            </td>
            <td className="py-3 px-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(funnel.created_at)}
                </span>
            </td>
            <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                    <button
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-100 transition-colors p-1.5 hover:bg-white/10 rounded-lg"
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/funnels/${funnel.id}`)
                        }}
                        title={t('common.edit')}
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        className="text-gray-400 dark:text-gray-500 hover:text-blue-400 transition-colors p-1.5 hover:bg-blue-500/10 rounded-lg"
                        onClick={(e) => {
                            e.stopPropagation()
                            actions?.onDuplicate?.(funnel)
                        }}
                        title={t('funnels.duplicate_funnel')}
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        className="text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors p-1.5 hover:bg-red-500/10 rounded-lg"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(t('funnels.confirm_delete_funnel', { name: funnel.name }))) {
                                actions?.onDelete?.(funnel)
                            }
                        }}
                        title={t('funnels.delete_funnel')}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}