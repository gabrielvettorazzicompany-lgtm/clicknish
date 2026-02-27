import React, { memo } from 'react'

interface PrivacyPolicyContentProps {
    t: any
    onClose: () => void
}

const PrivacyPolicyContent = memo(({ t, onClose }: PrivacyPolicyContentProps) => {
    return (
        <>
            <div className="space-y-4 text-sm text-gray-500">
                <p className="text-[11px] text-gray-400">{t.privacyLastUpdated}</p>

                <div>
                    <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection1Title}</h3>
                    <p className="text-[13px] leading-relaxed">{t.privacySection1Text}</p>
                </div>

                <div>
                    <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection2Title}</h3>
                    <p className="text-[13px] leading-relaxed">{t.privacySection2Text}</p>
                </div>

                <div>
                    <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection3Title}</h3>
                    <p className="text-[13px] leading-relaxed">{t.privacySection3Text}</p>
                </div>

                <div>
                    <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection4Title}</h3>
                    <p className="text-[13px] leading-relaxed">{t.privacySection4Text}</p>
                </div>

                <div>
                    <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection5Title}</h3>
                    <p className="text-[13px] leading-relaxed">{t.privacySection5Text}</p>
                </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl mt-6 -mx-6 -mb-6">
                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                    {t.close}
                </button>
            </div>
        </>
    )
})

PrivacyPolicyContent.displayName = 'PrivacyPolicyContent'

export default PrivacyPolicyContent