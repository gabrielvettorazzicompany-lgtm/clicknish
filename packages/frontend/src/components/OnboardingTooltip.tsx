import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface OnboardingTooltipProps {
    children: ReactNode
    title: string
    description: string
    position?: 'top' | 'right' | 'bottom' | 'left'
    onComplete?: () => void
    showPulse?: boolean
}

export default function OnboardingTooltip({
    children,
    title,
    description,
    position = 'right',
    onComplete,
    showPulse = true
}: OnboardingTooltipProps) {
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2'
    }

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-blue-600',
        right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-blue-600',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-blue-600',
        left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-blue-600'
    }

    return (
        <div className="relative inline-block">
            {/* Pulse Effect */}
            {showPulse && (
                <div className="absolute inset-0 rounded-lg animate-pulse-slow pointer-events-none z-10">
                    <div className="absolute inset-0 rounded-lg bg-blue-500/100/30 animate-ping"></div>
                    <div className="absolute inset-0 rounded-lg bg-blue-500/100/20"></div>
                </div>
            )}

            {/* Content */}
            <div className="relative z-20">
                {children}
            </div>

            {/* Tooltip */}
            <div className={`absolute z-[9999] ${positionClasses[position]} w-72`}>
                <div className="bg-blue-500 text-white rounded-lg shadow-xl p-4">
                    {/* Arrow */}
                    <div className={`absolute w-0 h-0 border-8 ${arrowClasses[position]}`}></div>

                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm">{title}</h3>
                        {onComplete && (
                            <button
                                onClick={onComplete}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-white/90 mb-3">{description}</p>

                    {/* Action Button */}
                    {onComplete && (
                        <button
                            onClick={onComplete}
                            className="w-full bg-[#1a1d2e] text-blue-400 font-medium text-sm py-2 px-4 rounded-md hover:bg-blue-500/10 transition-colors"
                        >
                            Got it
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
