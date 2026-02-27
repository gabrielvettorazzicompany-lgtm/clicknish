import React, { memo } from 'react'
import { ArrowLeft } from 'lucide-react'

interface CheckoutHeaderProps {
    onBack?: () => void
    t: any
}

const CheckoutHeader = memo(({ onBack, t }: CheckoutHeaderProps) => {
    if (!onBack) return null

    return (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">{t.back}</span>
                    </button>
                </div>
            </div>
        </header>
    )
})

CheckoutHeader.displayName = 'CheckoutHeader'

export default CheckoutHeader