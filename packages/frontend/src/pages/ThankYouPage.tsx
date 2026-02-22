import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface PurchaseData {
    id: string
    product_id: string
    application_id?: string
    user_id: string
    payment_id: string
    created_at: string
    purchase_type: 'application' | 'product'
    product_name?: string
    product_image?: string
    product_slug?: string
    application_slug?: string
}

interface ThankYouContent {
    title?: string
    subtitle?: string
    description?: string
    image?: string
    imageShape?: 'circle' | 'square'
    showButton?: boolean
    buttonText?: string
    buttonLink?: string
    backgroundColor?: string
    textColor?: string
    autoRedirect?: boolean
    redirectDelay?: number
    nextPageUrl?: string
    showUpsellSection?: boolean
    useDefaultRedirect?: boolean  // New option
}

interface ValidationResponse {
    valid: boolean
    viewsRemaining?: number
    expiresAt?: string
    purchase?: PurchaseData
    error?: string
    message?: string
}

export default function ThankYouPage() {
    const { purchaseId } = useParams<{ purchaseId: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [validationData, setValidationData] = useState<ValidationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [customContent, setCustomContent] = useState<ThankYouContent | null>(null)
    const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
    const [accessButtonCountdown, setAccessButtonCountdown] = useState<number>(3)
    const redirectStartedRef = useRef(false)
    const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const { t } = useI18n()

    useEffect(() => {
        validateAccess()
    }, [])

    // Auto redirect countdown - ONLY for upsell/downsell custom redirect
    useEffect(() => {
        if (!validationData?.purchase) return
        if (redirectStartedRef.current) return

        // Priority: URL ?redirect= param > funnel page nextPageUrl
        const urlRedirect = searchParams.get('redirect')
        const redirectTarget = urlRedirect || customContent?.nextPageUrl

        if (redirectTarget && (customContent?.autoRedirect || urlRedirect)) {
            redirectStartedRef.current = true
            const delay = customContent?.redirectDelay || 5
            const redirectUrl = redirectTarget

            setRedirectCountdown(delay)

            let remaining = delay
            redirectTimerRef.current = setInterval(() => {
                remaining -= 1
                setRedirectCountdown(remaining)
                if (remaining <= 0) {
                    if (redirectTimerRef.current) clearInterval(redirectTimerRef.current)
                    // Use replace to navigate to external URL
                    window.location.replace(redirectUrl)
                }
            }, 1000)
        }

        // Don't return cleanup - we want the redirect to complete even if component re-renders
    }, [customContent, validationData])

    // Countdown for access button (when useDefaultRedirect is enabled and no auto-redirect)
    useEffect(() => {
        if (!validationData || loading) return

        // Only start countdown if there's no auto-redirect active and useDefaultRedirect is enabled
        const showAccessButton = !customContent?.autoRedirect && customContent?.useDefaultRedirect !== false
        if (showAccessButton && redirectCountdown === null && accessButtonCountdown > 0) {
            const interval = setInterval(() => {
                setAccessButtonCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [validationData, loading, redirectCountdown])

    const fetchCustomContent = async (productId: string, applicatonId?: string) => {
        try {
            // Try to find funnel by product_id (can be marketplace_product id or application id)
            const searchIds = [productId]
            if (applicatonId && applicatonId !== productId) {
                searchIds.push(applicatonId)
            }

            const { data: funnelData } = await supabase
                .from('funnels')
                .select(`
                    id,
                    funnel_pages!inner (
                        id,
                        content,
                        page_type
                    )
                `)
                .in('product_id', searchIds)
                .eq('funnel_pages.page_type', 'thankyou')
                .limit(1)
                .single()

            if (funnelData?.funnel_pages?.[0]?.content) {
                setCustomContent(funnelData.funnel_pages[0].content)
            }
        } catch (error) {
            console.error('Error fetching custom content:', error)
            // Continue with default content
        }
    }

    const validateAccess = async () => {
        if (!token || !purchaseId) {
            setError(t('checkout_pages.invalid_access_link'))
            setLoading(false)
            return
        }

        try {
            setLoading(true)

            // Validate access
            const { data: validationResponse, error: validationError } = await supabase.functions.invoke(
                'validate-thankyou',
                {
                    body: { token, purchaseId, action: 'validate' },
                }
            )



            if (validationError) {
                // Try to read the error response body
                const errorBody = validationResponse || {}
                if (errorBody.message) {
                    setError(errorBody.message)
                } else {
                    throw new Error('Failed to validate access')
                }
                setLoading(false)
                return
            }

            if (!validationResponse.valid) {
                setError(validationResponse.message || 'Access denied')
                setLoading(false)
                return
            }

            setValidationData(validationResponse)

            // Fetch custom content if there is a product
            if (validationResponse.purchase?.product_id) {
                await fetchCustomContent(
                    validationResponse.purchase.product_id,
                    validationResponse.purchase.application_id
                )
            }

            // Increment view count
            supabase.functions.invoke('validate-thankyou', {
                body: { token, purchaseId, action: 'increment-view' },
            }).catch(err => console.error('Increment view error:', err))

        } catch (err: any) {
            console.error('Validation error:', err)
            setError(err.message || t('checkout_pages.failed_load_thankyou'))
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center"
                style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
            </div>
        )
    }

    // Error state
    if (error || !validationData) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4"
                style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
                <div className="text-center max-w-sm">
                    <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                        <AlertCircle className="text-red-500" size={28} />
                    </div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">{t('checkout_pages.access_denied')}</h1>
                    <p className="text-sm text-gray-500 mb-6">
                        {error || t('checkout_pages.link_invalid_expired')}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {t('common.go_to_home')}
                    </button>
                </div>
            </div>
        )
    }

    const { purchase } = validationData

    // Use custom content if available, otherwise use defaults
    const content = {
        title: customContent?.title || t('checkout_pages.thank_you_title'),
        subtitle: customContent?.subtitle || t('checkout_pages.order_confirmed_subtitle'),
        showButton: customContent?.showButton ?? false,
        buttonText: customContent?.buttonText || t('checkout_pages.access_your_product'),
        buttonLink: customContent?.buttonLink || '#',
        image: customContent?.image,
        imageShape: customContent?.imageShape || 'circle',
    }

    // Show access button only when useDefaultRedirect is enabled and no upsell redirect
    const showAccessButton = !customContent?.autoRedirect && customContent?.useDefaultRedirect !== false

    // Default product access URL based on purchase type and slug
    const productAccessUrl = purchase?.purchase_type === 'application' && purchase?.application_slug
        ? `/access/${purchase.application_slug}`
        : purchase?.product_slug
            ? `/members-login/${purchase.product_slug}`
            : purchase?.product_id
                ? `/members-login/${purchase.product_id}`
                : '#'

    return (
        <div
            className="min-h-screen bg-white flex flex-col items-center justify-center px-4"
            style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
            <div className="w-full max-w-md text-center">
                {/* Success Icon */}
                {content.image ? (
                    <div className={`w-20 h-20 mx-auto mb-6 overflow-hidden ${content.imageShape === 'square' ? 'rounded-lg' : 'rounded-full'}`}>
                        <img src={content.image} alt="Thank you" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-green-600" size={40} />
                    </div>
                )}

                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {content.title}
                </h1>

                {/* Subtitle */}
                <p className="text-gray-500 text-sm mb-8">
                    {content.subtitle}
                </p>

                {/* Auto Redirect Countdown - only for upsell/downsell */}
                {redirectCountdown !== null && (
                    <p className="text-xs text-gray-400 mb-6">
                        {t('checkout_pages.redirecting_in', { count: redirectCountdown })}
                    </p>
                )}

                {/* Access Button Countdown (when useDefaultRedirect is enabled) */}
                {redirectCountdown === null && showAccessButton && accessButtonCountdown > 0 && (
                    <p className="text-xs text-gray-400 mb-6">
                        {t('checkout_pages.access_available_in', { count: accessButtonCountdown })}
                    </p>
                )}

                {/* Access Button - show only when useDefaultRedirect is enabled and no upsell redirect */}
                {redirectCountdown === null && showAccessButton && content.showButton ? (
                    <button
                        onClick={() => {
                            if (content.buttonLink && content.buttonLink !== '#') {
                                window.location.href = content.buttonLink
                            } else {
                                navigate(productAccessUrl)
                            }
                        }}
                        disabled={accessButtonCountdown > 0}
                        className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {accessButtonCountdown > 0
                            ? t('checkout_pages.please_wait', { count: accessButtonCountdown })
                            : content.buttonText
                        }
                    </button>
                ) : redirectCountdown === null && showAccessButton ? (
                    <button
                        onClick={() => navigate(productAccessUrl)}
                        disabled={accessButtonCountdown > 0}
                        className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {accessButtonCountdown > 0
                            ? t('checkout_pages.please_wait', { count: accessButtonCountdown })
                            : t('checkout_pages.access_your_product')
                        }
                    </button>
                ) : null}

                {/* CTA Link (if custom) */}
                {content.showButton && content.buttonLink !== '#' && (
                    <a
                        href={content.buttonLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                    >
                        {content.buttonText}
                    </a>
                )}
            </div>
        </div>
    )
}
