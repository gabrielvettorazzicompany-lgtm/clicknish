import React, { memo } from 'react'
import { ShieldCheck } from 'lucide-react'

interface CheckoutFooterProps {
    t: any
    onPrivacyClick: (e: React.MouseEvent) => void
}

const CheckoutFooter = memo(({ t, onPrivacyClick }: CheckoutFooterProps) => {
    return (
        <div className="py-6 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Secure Purchase */}
                <div className="flex justify-center mb-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-green-500" size={14} />
                        <span className="text-[11px] text-gray-500">{t.securePurchase} &middot; {t.dataProtected}</span>
                    </div>
                </div>

                {/* ClickNich */}
                <div className="text-center mb-3">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t.paymentProcessedBy}</p>
                    <span className="font-semibold text-gray-600 text-[13px]">ClickNich</span>
                </div>

                {/* Footer Text */}
                <div className="text-center space-y-1">
                    <p className="text-[10px] text-gray-500">{t.footerCopyright}</p>
                    <p className="text-[10px] text-gray-500">
                        {t.footerConsent}{' '}
                        <button
                            onClick={onPrivacyClick}
                            className="text-blue-500 hover:underline"
                        >
                            {t.termsOfPurchase}
                        </button>
                        {' '}{t.and}{' '}
                        <button
                            onClick={onPrivacyClick}
                            className="text-blue-500 hover:underline"
                        >
                            {t.privacyTerms}
                        </button>.
                    </p>
                </div>
            </div>
        </div>
    )
})

CheckoutFooter.displayName = 'CheckoutFooter'

export default CheckoutFooter