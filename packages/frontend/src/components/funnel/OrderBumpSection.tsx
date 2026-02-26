import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useOrderBumps, OrderBumpForm, OrderBumpList } from './order-bump'
import { useI18n } from '@/i18n'

interface OrderBumpSectionProps {
    funnelId: string
    onUpdate: () => void
}

export default function OrderBumpSection({ funnelId, onUpdate }: OrderBumpSectionProps) {
    const { t } = useI18n()
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingBumpId, setEditingBumpId] = useState<string | null>(null)

    const {
        products,
        filteredProducts,
        orderBumps,
        setOrderBumps,
        checkouts,
        loading,
        loadingCheckouts,
        mainProductId,
        mainProductType,
        fetchCheckouts,
        fetchOrderBumps,
        deleteOrderBump,
        reorderOrderBumps
    } = useOrderBumps({ funnelId, onUpdate })

    const handleFormSuccess = () => {
        setShowAddForm(false)
        setEditingBumpId(null)
        fetchOrderBumps()
        onUpdate()
    }

    const handleFormCancel = () => {
        setShowAddForm(false)
        setEditingBumpId(null)
    }

    const handleEdit = (bump: any) => {
        setEditingBumpId(bump.id)
        setShowAddForm(true)

        // Scroll para o formulário
        setTimeout(() => {
            const formElement = document.querySelector('[data-order-bump-form]')
            if (formElement) {
                formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        }, 100)
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteOrderBump(id)
        } catch (error) {
            alert(t('funnel_components.error_deleting_bump'))
        }
    }

    const handleReorder = async (reorderedBumps: any[]) => {
        setOrderBumps(reorderedBumps)

        try {
            await reorderOrderBumps(reorderedBumps)
        } catch (error) {
            console.error('Erro ao reordenar:', error)
            fetchOrderBumps()
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">{t('funnel_components.order_bump')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('funnel_components.order_bump_desc')}
                    </p>
                </div>
                {!showAddForm && (
                    <div className="flex items-center gap-3">
                        {orderBumps.length >= 3 && (
                            <span className="text-xs text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                                {t('funnel_components.max_limit_reached')}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setEditingBumpId(null)
                                setShowAddForm(true)
                            }}
                            disabled={orderBumps.length >= 3}
                            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-all text-sm"
                        >
                            <Plus size={16} />
                            {t('funnel_components.add')}{orderBumps.length > 0 && ` (${orderBumps.length}/3)`}
                        </button>
                    </div>
                )}
            </div>

            {showAddForm && (
                <div data-order-bump-form>
                    <OrderBumpForm
                        funnelId={funnelId}
                        products={products}
                        filteredProducts={filteredProducts}
                        checkouts={checkouts}
                        loadingCheckouts={loadingCheckouts}
                        mainProductId={mainProductId}
                        mainProductType={mainProductType}
                        orderBumps={orderBumps}
                        editingBumpId={editingBumpId}
                        onFetchCheckouts={fetchCheckouts}
                        onSuccess={handleFormSuccess}
                        onCancel={handleFormCancel}
                    />
                </div>
            )}

            <OrderBumpList
                orderBumps={orderBumps}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
            />
        </div>
    )
}
