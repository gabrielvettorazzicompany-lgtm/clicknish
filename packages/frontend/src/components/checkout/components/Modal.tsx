import React, { memo, ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    maxWidth?: string
}

const Modal = memo(({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-2xl'
}: ModalProps) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className={`bg-white rounded-2xl ${maxWidth} w-full max-h-[80vh] overflow-y-auto shadow-xl`}>
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-6 py-6">
                    {children}
                </div>
            </div>
        </div>
    )
})

Modal.displayName = 'Modal'

export default Modal