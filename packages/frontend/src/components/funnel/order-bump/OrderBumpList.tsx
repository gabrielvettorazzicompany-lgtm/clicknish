import { useState } from 'react'
import type { OrderBump } from './types'
import OrderBumpCard from './OrderBumpCard'
import { useI18n } from '@/i18n'

interface OrderBumpListProps {
    orderBumps: OrderBump[]
    loading: boolean
    onEdit: (bump: OrderBump) => void
    onDelete: (id: string) => void
    onReorder: (reorderedBumps: OrderBump[]) => void
}

export default function OrderBumpList({
    orderBumps,
    loading,
    onEdit,
    onDelete,
    onReorder
}: OrderBumpListProps) {
    const { t } = useI18n()
    const [draggedItem, setDraggedItem] = useState<string | null>(null)
    const [draggedOver, setDraggedOver] = useState<string | null>(null)

    const handleDragStart = (e: React.DragEvent, bumpId: string) => {
        setDraggedItem(bumpId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent, bumpId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDraggedOver(bumpId)
    }

    const handleDragLeave = () => {
        setDraggedOver(null)
    }

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault()

        if (!draggedItem || draggedItem === targetId) {
            setDraggedItem(null)
            setDraggedOver(null)
            return
        }

        const draggedIndex = orderBumps.findIndex(b => b.id === draggedItem)
        const targetIndex = orderBumps.findIndex(b => b.id === targetId)

        if (draggedIndex === -1 || targetIndex === -1) return

        // Reordenar array
        const newOrderBumps = [...orderBumps]
        const [draggedBump] = newOrderBumps.splice(draggedIndex, 1)
        newOrderBumps.splice(targetIndex, 0, draggedBump)

        onReorder(newOrderBumps)

        setDraggedItem(null)
        setDraggedOver(null)
    }

    const handleDragEnd = () => {
        setDraggedItem(null)
        setDraggedOver(null)
    }

    const handleDeleteClick = async (id: string) => {
        if (!confirm(t('funnel_components.confirm_remove_bump'))) return
        onDelete(id)
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            </div>
        )
    }

    if (orderBumps.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400 text-sm">
                {t('funnel_components.no_bumps_added')}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {orderBumps.map((bump, index) => {
                const isBeingDragged = draggedItem === bump.id
                const isDraggedOver = draggedOver === bump.id

                return (
                    <OrderBumpCard
                        key={bump.id}
                        bump={bump}
                        index={index}
                        isBeingDragged={isBeingDragged}
                        isDraggedOver={isDraggedOver}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        onEdit={onEdit}
                        onDelete={handleDeleteClick}
                    />
                )
            })}

            {orderBumps.length > 1 && (
                <div className="text-center pt-2">
                    <p className="text-xs text-gray-500">
                        ↕️ {t('funnel_components.drag_to_reorder')}
                    </p>
                </div>
            )}
        </div>
    )
}
