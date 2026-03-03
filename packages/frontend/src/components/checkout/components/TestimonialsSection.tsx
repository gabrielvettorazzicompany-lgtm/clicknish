import React from 'react'
import type { Testimonial, CheckoutImageBlock } from '../types'
import CheckoutImageDisplay from './CheckoutImageDisplay'
import ImageDropZone from './ImageDropZone'

export type { Testimonial }

interface TestimonialsSectionProps {
    testimonials: Testimonial[]
    isPreview?: boolean
    onClick?: (id: string) => void
    imageBlocks?: CheckoutImageBlock[]
    onPreviewAdd?: () => void
    isDragging?: boolean
    draggedComponentType?: string
    onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
    onDeleteImageBlock?: (id: string) => void
}

function StarRating({ stars, color }: { stars: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    viewBox="0 0 20 20"
                    fill={star <= stars ? '#f59e0b' : '#d1d5db'}
                    className="w-4 h-4"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
    const { photo, text, stars, name, backgroundColor, textColor, horizontalMode } = testimonial

    if (horizontalMode) {
        return (
            <div
                className="rounded-xl p-4 shadow-sm flex gap-4 items-center border border-gray-100"
                style={{ backgroundColor, color: textColor }}
            >
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {photo ? (
                        <img
                            src={photo}
                            alt={name}
                            className="w-16 h-16 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-gray-400" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug mb-2" style={{ color: textColor }}>{text}</p>
                    <StarRating stars={stars} color={textColor} />
                    <p className="text-xs font-semibold mt-1.5" style={{ color: textColor, opacity: 0.65 }}>{name}</p>
                </div>
            </div>
        )
    }

    // Vertical mode (default)
    return (
        <div
            className="rounded-xl p-5 shadow-sm text-center flex flex-col items-center gap-2"
            style={{ backgroundColor, color: textColor }}
        >
            {/* Avatar */}
            {photo ? (
                <img
                    src={photo}
                    alt={name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                />
            ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-gray-400" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
            )}

            {/* Text */}
            <p className="text-sm font-semibold leading-relaxed" style={{ color: textColor }}>{text}</p>

            {/* Stars */}
            <StarRating stars={stars} color={textColor} />

            {/* Name */}
            <p className="text-xs font-semibold" style={{ color: textColor, opacity: 0.75 }}>{name}</p>
        </div>
    )
}

export default function TestimonialsSection({ testimonials, isPreview, onClick, imageBlocks, onPreviewAdd, isDragging, draggedComponentType, onUpdateImageBlock, onDeleteImageBlock }: TestimonialsSectionProps) {
    if (!testimonials || testimonials.length === 0) return null

    const hasHorizontal = testimonials.some(t => t.horizontalMode)
    const hasVertical = testimonials.some(t => !t.horizontalMode)

    const wrapCard = (t: Testimonial) => (
        <div
            key={t.id}
            className={isPreview && onClick ? 'cursor-pointer' : ''}
            onClick={isPreview && onClick ? () => onClick(t.id) : undefined}
        >
            <TestimonialCard testimonial={t} />
        </div>
    )

    return (
        <div className="w-full px-4 py-6">
            {/* Vertical cards grid */}
            {hasVertical && (
                <div className={`grid gap-4 ${testimonials.filter(t => !t.horizontalMode).length === 1
                    ? 'grid-cols-1 max-w-sm mx-auto'
                    : testimonials.filter(t => !t.horizontalMode).length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    } ${hasHorizontal ? 'mb-4' : ''}`}
                >
                    {testimonials.filter(t => !t.horizontalMode).map(wrapCard)}
                </div>
            )}

            {/* Image block: between testimonials groups */}
            <ImageDropZone slot="between_testimonials" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType} />
            <CheckoutImageDisplay imageBlocks={imageBlocks} slot="between_testimonials" isPreview={isPreview} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={onDeleteImageBlock} />

            {/* Horizontal cards */}
            {hasHorizontal && (
                <div className="flex flex-col gap-4">
                    {testimonials.filter(t => t.horizontalMode).map(wrapCard)}
                </div>
            )}
        </div>
    )
}
