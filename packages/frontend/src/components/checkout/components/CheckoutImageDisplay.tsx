import React, { memo } from 'react'
import type { CheckoutImageBlock, ImageBlockSlot } from '../types'

interface CheckoutImageDisplayProps {
    imageBlocks?: CheckoutImageBlock[]
    slot: ImageBlockSlot
    className?: string
    isPreview?: boolean
    onPreviewClick?: () => void
}

const widthClassMap: Record<NonNullable<CheckoutImageBlock['width']>, string> = {
    full: 'w-full',
    large: 'max-w-2xl mx-auto w-full',
    medium: 'max-w-md mx-auto w-full',
    small: 'max-w-xs mx-auto w-full',
}

const CheckoutImageDisplay = memo(({ imageBlocks, slot, className = '' }: CheckoutImageDisplayProps) => {
    const blocks = imageBlocks?.filter(b => b.slot === slot && b.url)
    if (!blocks || blocks.length === 0) return null

    return (
        <>
            {blocks.map(block => {
                const widthClass = widthClassMap[block.width ?? 'full']
                const img = (
                    <img
                        src={block.url}
                        alt=""
                        className={`${widthClass} rounded-lg object-contain`}
                        loading="lazy"
                    />
                )
                return (
                    <div key={block.id} className={`py-3 px-4 ${className}`}>
                        {img}
                    </div>
                )
            })}
        </>
    )
})

CheckoutImageDisplay.displayName = 'CheckoutImageDisplay'

export default CheckoutImageDisplay
