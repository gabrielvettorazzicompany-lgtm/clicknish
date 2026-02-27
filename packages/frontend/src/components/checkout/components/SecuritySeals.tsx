import React, { memo } from 'react'

interface SecuritySealsProps {
    isPreview?: boolean
    onClick?: () => void
    isDraggingOver?: boolean
}

const SecuritySeals = memo(({ isPreview, onClick, isDraggingOver }: SecuritySealsProps) => {
    return (
        <div
            className={`py-5 px-4 ${isPreview ? 'cursor-pointer' : ''} ${isDraggingOver ? 'ring-2 ring-blue-500 rounded-lg bg-blue-500/5' : ''}`}
            onClick={onClick}
        >
            <div className="grid grid-cols-3 divide-x divide-gray-200 max-w-xl mx-auto">

                {/* Seal 1: SSL Secured */}
                <div className="flex flex-col items-center justify-start gap-2 px-4 text-center">
                    <div className="w-[56px] h-[56px] flex-shrink-0">
                        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M26 2L6 10V26C6 37.05 14.74 47.35 26 50C37.26 47.35 46 37.05 46 26V10L26 2Z" fill="#22c55e" />
                            <path d="M26 4L8 11.6V26C8 36.2 16.06 45.68 26 48.2C35.94 45.68 44 36.2 44 26V11.6L26 4Z" fill="#16a34a" />
                            <rect x="19" y="21" width="14" height="13" rx="1.5" fill="white" />
                            <path d="M21 21V18C21 14.686 24.134 12 26 12C27.866 12 31 14.686 31 18V21" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <circle cx="26" cy="27.5" r="2" fill="#16a34a" />
                            <rect x="25.2" y="27.5" width="1.6" height="3" rx="0.8" fill="#16a34a" />
                        </svg>
                    </div>
                    <div>
                        <div className="font-bold text-[11px] text-gray-700 leading-tight tracking-wide uppercase">SSL Secured</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Encrypted checkout</div>
                    </div>
                </div>

                {/* Seal 2: Secure Payments */}
                <div className="flex flex-col items-center justify-start gap-2 px-4 text-center">
                    <div className="w-[56px] h-[56px] flex-shrink-0">
                        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="26" cy="26" r="24" fill="#b45309" />
                            <circle cx="26" cy="26" r="22" fill="#d97706" />
                            <circle cx="26" cy="26" r="20" fill="#f59e0b" />
                            <circle cx="26" cy="26" r="17" fill="#fde68a" />
                            <circle cx="26" cy="26" r="14" fill="#d97706" />
                            <text x="26" y="23.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Arial, sans-serif">100%</text>
                            <text x="26" y="32" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="600" fontFamily="Arial, sans-serif">SAFE</text>
                            <text x="13" y="27" textAnchor="middle" fill="#fde68a" fontSize="6">★</text>
                            <text x="39" y="27" textAnchor="middle" fill="#fde68a" fontSize="6">★</text>
                        </svg>
                    </div>
                    <div>
                        <div className="font-bold text-[11px] text-gray-700 leading-tight tracking-wide uppercase">Secure Payments</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">By verified providers</div>
                    </div>
                </div>

                {/* Seal 3: 100% Garantia */}
                <div className="flex flex-col items-center justify-start gap-2 px-4 text-center">
                    <div className="w-[56px] h-[56px] flex-shrink-0">
                        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M26 2L6 10V26C6 37.05 14.74 47.35 26 50C37.26 47.35 46 37.05 46 26V10L26 2Z" fill="#7c3aed" />
                            <path d="M26 4L8 11.6V26C8 36.2 16.06 45.68 26 48.2C35.94 45.68 44 36.2 44 26V11.6L26 4Z" fill="#8b5cf6" />
                            {/* Medal ribbon */}
                            <circle cx="26" cy="22" r="8" fill="white" opacity="0.2" />
                            <circle cx="26" cy="22" r="6" fill="white" opacity="0.9" />
                            {/* Star inside medal */}
                            <text x="26" y="26" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">★</text>
                            {/* Ribbon bottom */}
                            <path d="M20 30L26 34L32 30L30 42L26 39L22 42Z" fill="white" opacity="0.85" />
                        </svg>
                    </div>
                    <div>
                        <div className="font-bold text-[11px] text-gray-700 leading-tight tracking-wide uppercase">100% Garantia</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Compra 100% protegida</div>
                    </div>
                </div>

            </div>
        </div>
    )
})

SecuritySeals.displayName = 'SecuritySeals'

export default SecuritySeals
