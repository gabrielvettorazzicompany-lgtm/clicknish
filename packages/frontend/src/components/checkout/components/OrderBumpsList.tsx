import React, { memo } from 'react'
import { OrderBumpCard } from '../OrderBumpCard'

interface OrderBumpsListProps {
    orderBumps: any[]
    selectedBumps: Set<string>
    toggleBump: (bumpId: string) => void
    isPreview?: boolean
    viewDevice?: 'desktop' | 'mobile'
    t: any
}

const OrderBumpsList = memo(({
    orderBumps,
    selectedBumps,
    toggleBump,
    isPreview = false,
    viewDevice = 'desktop',
    t
}: OrderBumpsListProps) => {
    if (orderBumps.length === 0) return null

    return (
        <div className={`${isPreview && viewDevice === 'mobile' ? 'px-3 py-3' : 'px-3 py-3 sm:px-4 sm:py-4 lg:px-0 lg:py-0'}`}>
            <div className="mb-2 sm:mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    {t.limitedOffers}
                </h3>
            </div>
            <div className="space-y-2 sm:space-y-3">
                {orderBumps.map((bump) => (
                    <OrderBumpCard
                        key={bump.id}
                        bump={bump}
                        isSelected={selectedBumps.has(bump.id)}
                        onToggle={toggleBump}
                        t={t}
                    />
                ))}
            </div>
        </div>
    )
})

OrderBumpsList.displayName = 'OrderBumpsList'

export default OrderBumpsList