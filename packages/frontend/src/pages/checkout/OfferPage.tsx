import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, X, Loader2, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n'

const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

interface Offer {
    id: string
    offer_type: 'upsell' | 'downsell'
    offer_product_id: string
    offer_product_name: string
    offer_product_price: number
    offer_product_currency?: string
    offer_product_image?: string
    offer_product_description?: string
    custom_price?: number
    title?: string
    description?: string
}

export default function OfferPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { t } = useI18n()

    const checkoutId = searchParams.get('checkout')
    const purchaseId = searchParams.get('purchase')

    const [currentOffer, setCurrentOffer] = useState<Offer | null>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [showingDownsell, setShowingDownsell] = useState(false)
    const [acceptedOffers, setAcceptedOffers] = useState<string[]>([])

    useEffect(() => {
        loadNextOffer()
    }, [checkoutId])

    const loadNextOffer = async () => {
        if (!checkoutId) {
            navigate('/success')
            return
        }

        try {
            setLoading(true)

            // Fetch next offer
            const offerType = showingDownsell ? 'downsell' : 'upsell'

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/checkout_offers?checkout_id=eq.${checkoutId}&offer_type=eq.${offerType}&is_active=eq.true&select=*&order=offer_position.asc&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            )

            if (!response.ok) {
                navigate('/success')
                return
            }

            const [offer] = await response.json()

            if (!offer) {
                // No more offers, redirect to success
                navigate('/success')
                return
            }

            // Fetch product information based on product_type
            let product: any = null
            const productType = offer.product_type || 'member_area'
            const offerProductId = offer.product_id

            if (productType === 'application') {
                // It's an application - fetch from applications table
                const appResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/applications?id=eq.${offerProductId}&select=name,logo_url,description`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                )
                if (appResponse.ok) {
                    const [app] = await appResponse.json()
                    if (app) {
                        product = {
                            name: app.name,
                            price: offer.custom_price || 0,
                            currency: 'USD',
                            image_url: app.logo_url,
                            description: app.description
                        }
                    }
                }
            } else if (productType === 'app_product') {
                // It's a product inside an app - fetch from products table
                const prodResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/products?id=eq.${offerProductId}&select=name,description,image_url`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                )
                if (prodResponse.ok) {
                    const [prod] = await prodResponse.json()
                    if (prod) {
                        product = {
                            name: prod.name,
                            price: offer.custom_price || 0,
                            currency: 'USD',
                            image_url: prod.image_url,
                            description: prod.description
                        }
                    }
                }
            } else {
                // Default: member_area (marketplace_products)
                const productResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/marketplace_products?id=eq.${offerProductId}&select=name,price,currency,image_url,description`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                )
                if (productResponse.ok) {
                    const [prod] = await productResponse.json()
                    product = prod
                }
            }

            if (!product) {
                navigate('/success')
                return
            }

            setCurrentOffer({
                id: offer.id,
                offer_type: offer.offer_type,
                offer_product_id: offerProductId,
                offer_product_name: product.name,
                offer_product_price: product.price,
                offer_product_currency: product.currency,
                offer_product_image: product.image_url,
                offer_product_description: product.description,
                custom_price: offer.custom_price,
                title: offer.title,
                description: offer.description
            })
        } catch (error) {
            console.error('Error loading offer:', error)
            navigate('/success')
        } finally {
            setLoading(false)
        }
    }

    const handleAccept = async () => {
        if (!currentOffer || processing) return

        setProcessing(true)

        try {
            // TODO: Process offer payment
            // For now, just register analytics and add to accepted list

            // Register analytics
            await fetch(`${SUPABASE_URL}/rest/v1/offer_analytics`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    checkout_offer_id: currentOffer.id,
                    event_type: 'accepted'
                })
            })

            setAcceptedOffers([...acceptedOffers, currentOffer.id])

            // Redirect to success after accepting
            setTimeout(() => {
                navigate('/success')
            }, 1500)
        } catch (error) {
            console.error('Error accepting offer:', error)
            navigate('/success')
        } finally {
            setProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!currentOffer || processing) return

        setProcessing(true)

        try {
            // Register analytics
            await fetch(`${SUPABASE_URL}/rest/v1/offer_analytics`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    checkout_offer_id: currentOffer.id,
                    event_type: 'rejected'
                })
            })

            // If it was an upsell and was rejected, try showing downsell
            if (currentOffer.offer_type === 'upsell' && !showingDownsell) {
                setShowingDownsell(true)
                await loadNextOffer()
            } else {
                // If there's no downsell or it was already rejected, go to success
                navigate('/success')
            }
        } catch (error) {
            console.error('Error rejecting offer:', error)
            navigate('/success')
        } finally {
            setProcessing(false)
        }
    }

    const formatPrice = (price: number, currency: string = 'USD') => {
        const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(price)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 text-blue-500 animate-spin" />
                    <p className="text-gray-600">{t('checkout_pages.loading_offer')}</p>
                </div>
            </div>
        )
    }

    if (!currentOffer) {
        return null
    }

    const finalPrice = currentOffer.custom_price || currentOffer.offer_product_price
    const hasDiscount = currentOffer.custom_price && currentOffer.custom_price < currentOffer.offer_product_price
    const isUpsell = currentOffer.offer_type === 'upsell'

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Success Badge */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full mb-4">
                        <CheckCircle size={20} />
                        <span className="font-semibold">{t('checkout_pages.purchase_confirmed')}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isUpsell ? `🎉 ${t('checkout_pages.exclusive_offer')}` : `⚡ ${t('checkout_pages.last_chance')}`}
                    </h1>
                    <p className="text-gray-600">
                        {isUpsell
                            ? t('checkout_pages.upsell_desc')
                            : t('checkout_pages.downsell_desc')
                        }
                    </p>
                </div>

                {/* Offer Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-blue-200">
                    {/* Badge */}
                    <div className={`${isUpsell ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} py-3 px-6`}>
                        <div className="flex items-center justify-center gap-2 text-white">
                            {isUpsell ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            <span className="font-bold uppercase tracking-wide text-sm">
                                {isUpsell ? t('checkout_pages.special_upsell') : t('checkout_pages.final_offer')}
                            </span>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Product Image */}
                            {currentOffer.offer_product_image && (
                                <div className="md:w-1/3">
                                    <img
                                        src={currentOffer.offer_product_image}
                                        alt={currentOffer.offer_product_name}
                                        className="w-full h-auto rounded-lg shadow-md"
                                    />
                                </div>
                            )}

                            {/* Product Info */}
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                    {currentOffer.title || currentOffer.offer_product_name}
                                </h2>

                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    {currentOffer.description || currentOffer.offer_product_description}
                                </p>

                                {/* Price */}
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
                                    <div className="flex items-baseline gap-3 justify-center">
                                        {hasDiscount && (
                                            <span className=" text-xl text-gray-400 line-through">
                                                {formatPrice(currentOffer.offer_product_price, currentOffer.offer_product_currency)}
                                            </span>
                                        )}
                                        <span className="text-4xl font-bold text-blue-600">
                                            {formatPrice(finalPrice, currentOffer.offer_product_currency)}
                                        </span>
                                        {hasDiscount && (
                                            <span className="text-sm font-semibold bg-green-500 text-white px-3 py-1 rounded-full">
                                                {Math.round(((currentOffer.offer_product_price - finalPrice) / currentOffer.offer_product_price) * 100)}% OFF
                                            </span>
                                        )}
                                    </div>
                                    {!hasDiscount && (
                                        <p className="text-center text-sm text-gray-600 mt-2">{t('checkout_pages.limited_time')}</p>
                                    )}
                                </div>

                                {/* Guarantee */}
                                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200 mb-6">
                                    <ShieldCheck className="text-green-600 flex-shrink-0" size={24} />
                                    <div>
                                        <p className="text-sm font-semibold text-green-900">{t('checkout_pages.guarantee_7_day')}</p>
                                        <p className="text-xs text-green-700">{t('checkout_pages.money_back')}</p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handleAccept}
                                        disabled={processing}
                                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg text-lg"
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {t('checkout_pages.processing')}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={20} />
                                                {t('checkout_pages.upsell_accept')}
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleReject}
                                        disabled={processing}
                                        className="w-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <X size={18} />
                                        No, thanks
                                    </button>
                                </div>

                                <p className="text-center text-xs text-gray-500 mt-4">
                                    This offer is available only at this moment
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timer (optional) */}
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500">
                        {t('checkout_pages.offer_valid_session')}
                    </p>
                </div>
            </div>
        </div>
    )
}
