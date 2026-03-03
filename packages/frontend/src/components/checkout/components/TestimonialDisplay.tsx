import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Testimonial, TestimonialSlot } from '../types'

interface TestimonialDisplayProps {
    testimonials?: Testimonial[]
    slot: TestimonialSlot
    isPreview?: boolean
    onClick?: (id: string) => void
    className?: string
    carouselMode?: boolean
    horizontalMode?: boolean
}

function StarRating({ stars }: { stars: number }) {
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

function TestimonialCard({ testimonial, onClick, isPreview }: { testimonial: Testimonial; onClick?: (id: string) => void; isPreview?: boolean }) {
    const { photo, text, stars, name, backgroundColor, textColor, horizontalMode } = testimonial

    if (horizontalMode) {
        return (
            <div
                className={`rounded-xl p-4 shadow-sm flex gap-4 items-center border border-gray-100 ${isPreview && onClick ? 'cursor-pointer' : ''}`}
                style={{ backgroundColor, color: textColor }}
                onClick={isPreview && onClick ? () => onClick(testimonial.id) : undefined}
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
                    <StarRating stars={stars} />
                    <p className="text-xs font-semibold mt-1.5" style={{ color: textColor, opacity: 0.65 }}>{name}</p>
                </div>
            </div>
        )
    }

    // Vertical mode (default)
    return (
        <div
            className={`rounded-xl p-5 shadow-sm text-center flex flex-col items-center gap-2 ${isPreview && onClick ? 'cursor-pointer' : ''}`}
            style={{ backgroundColor, color: textColor }}
            onClick={isPreview && onClick ? () => onClick(testimonial.id) : undefined}
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
            <StarRating stars={stars} />

            {/* Name */}
            <p className="text-xs font-semibold" style={{ color: textColor, opacity: 0.75 }}>{name}</p>
        </div>
    )
}

export default function TestimonialDisplay({ 
    testimonials, 
    slot, 
    isPreview, 
    onClick, 
    className = '', 
    carouselMode = false,
    horizontalMode = false
}: TestimonialDisplayProps) {
    const slotTestimonials = testimonials?.filter(t => t.slot === slot) || []
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (!carouselMode || slotTestimonials.length === 0) return

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slotTestimonials.length)
        }, 5000) // Troca a cada 5 segundos

        return () => clearInterval(interval)
    }, [carouselMode, slotTestimonials.length])

    if (slotTestimonials.length === 0) {
        return null
    }

    const nextTestimonial = () => {
        setCurrentIndex((prev) => (prev + 1) % slotTestimonials.length)
    }

    const prevTestimonial = () => {
        setCurrentIndex((prev) => (prev - 1 + slotTestimonials.length) % slotTestimonials.length)
    }

    // Carousel mode
    if (carouselMode) {
        const currentTestimonial = slotTestimonials[currentIndex]
        // Use global horizontal mode if provided, otherwise use testimonial's individual setting
        const testimonialWithMode = {
            ...currentTestimonial,
            horizontalMode: horizontalMode !== undefined ? horizontalMode : currentTestimonial.horizontalMode
        }
        
        return (
            <div className={`w-full px-4 py-4 ${className}`}>
                <div className="relative max-w-2xl mx-auto">
                    {/* Testimonial Card */}
                    <div className="transition-opacity duration-500">
                        <div
                            className={`${isPreview && onClick ? 'cursor-pointer' : ''}`}
                            onClick={isPreview && onClick ? () => onClick(currentTestimonial.id) : undefined}
                        >
                            <TestimonialCard testimonial={testimonialWithMode} onClick={onClick} isPreview={isPreview} />
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    {slotTestimonials.length > 1 && (
                        <>
                            <button
                                onClick={prevTestimonial}
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                                aria-label="Anterior"
                            >
                                <ChevronLeft size={20} className="text-gray-700" />
                            </button>
                            <button
                                onClick={nextTestimonial}
                                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                                aria-label="Próximo"
                            >
                                <ChevronRight size={20} className="text-gray-700" />
                            </button>
                        </>
                    )}

                    {/* Indicators */}
                    {slotTestimonials.length > 1 && (
                        <div className="flex justify-center gap-2 mt-4">
                            {slotTestimonials.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentIndex(index)}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        index === currentIndex
                                            ? 'bg-blue-500 w-6'
                                            : 'bg-gray-300 hover:bg-gray-400'
                                    }`}
                                    aria-label={`Ir para depoimento ${index + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Grid mode (default)
    const hasHorizontal = slotTestimonials.some(t => t.horizontalMode)
    const hasVertical = slotTestimonials.some(t => !t.horizontalMode)

    return (
        <div className={`w-full px-4 py-4 ${className}`}>
            {/* Vertical cards grid */}
            {hasVertical && (
                <div className={`grid gap-4 ${slotTestimonials.filter(t => !t.horizontalMode).length === 1
                    ? 'grid-cols-1 max-w-sm mx-auto'
                    : slotTestimonials.filter(t => !t.horizontalMode).length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    } ${hasHorizontal ? 'mb-4' : ''}`}
                >
                    {slotTestimonials.filter(t => !t.horizontalMode).map(t => (
                        <TestimonialCard key={t.id} testimonial={t} onClick={onClick} isPreview={isPreview} />
                    ))}
                </div>
            )}

            {/* Horizontal cards */}
            {hasHorizontal && (
                <div className="flex flex-col gap-4">
                    {slotTestimonials.filter(t => t.horizontalMode).map(t => (
                        <TestimonialCard key={t.id} testimonial={t} onClick={onClick} isPreview={isPreview} />
                    ))}
                </div>
            )}
        </div>
    )
}
