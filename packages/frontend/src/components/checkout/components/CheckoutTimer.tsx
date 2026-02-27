import React, { memo } from 'react'
import { Clock } from 'lucide-react'
import { TimerComponent } from '../Timer'

interface TimerConfig {
    enabled: boolean
    minutes: number
    backgroundColor: string
    textColor: string
    activeText: string
    finishedText: string
}

interface CheckoutTimerProps {
    timerConfig?: TimerConfig
    onTimerClick?: () => void
    isPreview?: boolean
    viewDevice?: 'desktop' | 'mobile'
    isDragging?: boolean
    draggedComponentType?: string
    t?: any
}

const CheckoutTimer = memo(({
    timerConfig,
    onTimerClick,
    isPreview = false,
    viewDevice = 'desktop',
    isDragging = false,
    draggedComponentType,
    t
}: CheckoutTimerProps) => {
    if (timerConfig?.enabled) {
        return (
            <div className="w-full lg:max-w-7xl lg:mx-auto lg:px-4 mt-3 lg:mt-4">
                <div className="lg:rounded-lg overflow-hidden shadow-lg border border-slate-200">
                    <TimerComponent
                        config={timerConfig}
                        onClick={onTimerClick}
                        isPreview={isPreview}
                        compact={viewDevice === 'mobile'}
                    />
                </div>
            </div>
        )
    }

    if (isPreview && isDragging && draggedComponentType === 'timer') {
        return (
            <div
                className="w-full lg:max-w-7xl lg:mx-auto lg:px-4 mt-3 lg:mt-4"
                data-drop-zone="timer"
            >
                <div className="min-h-[60px] border border-dashed border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center transition-all">
                    <div className="text-center text-gray-500">
                        <Clock size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t?.('checkout_pages.drop_here_timer') || 'Drop timer here'}</p>
                    </div>
                </div>
            </div>
        )
    }

    return null
})

CheckoutTimer.displayName = 'CheckoutTimer'

export default CheckoutTimer