import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/services/supabase'
import { useCheckoutPageView, trackCheckoutEvent } from '@/services/checkouts'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'
import type { CheckoutLanguage } from '@/components/checkout/translations'
import { getTranslations } from '@/components/checkout/translations'

const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

interface Product {
    id: string
    name: string
    price: number
    image_url?: string
    description?: string
}

interface Checkout {
    id: string
    name: string
    product_id: string
    is_default: boolean
    custom_price?: number
    banner_image?: string
    banner_title?: string
    custom_height?: number
    language?: CheckoutLanguage
    created_at: string
}

export default function CheckoutPublic() {
    const { productId, checkoutId, shortId } = useParams<{ productId?: string; checkoutId?: string; shortId?: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [product, setProduct] = useState<Product | null>(null)
    const [checkout, setCheckout] = useState<Checkout | null>(null)
    const [finalCheckoutId, setFinalCheckoutId] = useState<string | null>(null)
    const [timerConfig, setTimerConfig] = useState({
        enabled: false,
        minutes: 15,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
        activeText: '',
        finishedText: ''
    })
    const [paymentResult, setPaymentResult] = useState<{ purchaseId: string, thankyouToken: string } | null>(null)
    const paymentResultRef = useRef<{ purchaseId: string, thankyouToken: string } | null>(null)
    const leadDataRef = useRef<{ email: string; name: string; phone: string } | null>(null)
    const abandonedFiredRef = useRef(false)
    const [buttonColor, setButtonColor] = useState('#111827')
    const [preloadedRedirect, setPreloadedRedirect] = useState<{ url: string | null } | null>(null)

    // Capture UTM params once from the URL when the checkout opens
    const utmParams = useRef<Record<string, string | null>>({
        src: null,
        sck: null,
        utm_source: null,
        utm_campaign: null,
        utm_medium: null,
        utm_content: null,
        utm_term: null,
    })
    useEffect(() => {
        const p = new URLSearchParams(window.location.search)
        utmParams.current = {
            src: p.get('src'),
            sck: p.get('sck'),
            utm_source: p.get('utm_source'),
            utm_campaign: p.get('utm_campaign'),
            utm_medium: p.get('utm_medium'),
            utm_content: p.get('utm_content'),
            utm_term: p.get('utm_term'),
        }
    }, [])

    // Track page view when checkout ID is determined
    useCheckoutPageView(finalCheckoutId || '')

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            let finalProductId = productId
            let finalCheckoutId = checkoutId

            // If it's a short URL, fetch real IDs
            if (shortId) {
                const { data: urlData, error: urlError } = await supabase
                    .from('checkout_urls')
                    .select('member_area_id, application_id, checkout_id')
                    .eq('id', shortId)
                    .single()

                if (urlError || !urlData) {
                    throw new Error('URL not found')
                }

                finalProductId = urlData.member_area_id || urlData.application_id
                finalCheckoutId = urlData.checkout_id
                setFinalCheckoutId(finalCheckoutId ?? null)
            } else if (productId && checkoutId) {
                finalCheckoutId = checkoutId
                setFinalCheckoutId(finalCheckoutId ?? null)

                // If it's a long URL, try finding existing short URL and redirect
                const { data: existingUrl, error: searchError } = await supabase
                    .from('checkout_urls')
                    .select('id')
                    .eq('member_area_id', productId)
                    .eq('checkout_id', checkoutId)
                    .single()

                if (existingUrl && !searchError) {
                    // Redirect to short URL
                    navigate(`/checkout/${existingUrl.id}`, { replace: true })
                    return
                } else {
                    // Create new short URL automatically
                    const { data: newUrl, error: insertError } = await supabase
                        .from('checkout_urls')
                        .insert({
                            member_area_id: productId,
                            checkout_id: checkoutId
                        })
                        .select('id')
                        .single()

                    if (!insertError && newUrl) {
                        // Redirect to the new short URL
                        navigate(`/checkout/${newUrl.id}`, { replace: true })
                        return
                    }
                }
            }

            // Paralelizar checkout + marketplace_products (para marketplace, já temos o finalProductId)
            const [checkoutQueryResult, productQueryResult] = await Promise.all([
                supabase.from('checkouts').select('*').eq('id', finalCheckoutId).single(),
                finalProductId
                    ? supabase.from('marketplace_products').select('*').eq('id', finalProductId).single()
                    : Promise.resolve({ data: null, error: null }),
            ])

            const { data: checkoutData, error: checkoutError } = checkoutQueryResult

            if (checkoutError) throw checkoutError
            if (!checkoutData) throw new Error('Checkout not found')

            let fetchedProduct: Product
            let productType: 'app' | 'marketplace' = 'marketplace'
            let applicationId: string | undefined

            // Check if it's app or marketplace
            if (checkoutData.application_id) {
                // It's an app checkout - but might be for a specific product inside the app
                productType = 'app'
                applicationId = checkoutData.application_id

                // Only look up offer product name if this is an upsell/downsell redirect (nobumps=1)
                const urlParams = new URLSearchParams(window.location.search)
                const isUpsellCheckout = urlParams.get('nobumps') === '1'

                let resolvedProductName: string | null = null
                let resolvedProductImage: string | undefined = undefined
                let resolvedProductDesc = ''
                let resolvedProductId = checkoutData.application_id

                if (isUpsellCheckout) {
                    // Try to find the specific product name from checkout_offers
                    // Only for upsell/downsell types, NOT order bumps
                    const { data: offerData } = await supabase
                        .from('checkout_offers')
                        .select('product_id, product_type, application_id, product_name, offer_product_image')
                        .eq('checkout_id', finalCheckoutId)
                        .in('offer_type', ['upsell', 'downsell'])
                        .limit(1)
                        .maybeSingle()



                    // Also try checkout_offer_id (migration 058)
                    const offerRow = offerData || (await (async () => {
                        const { data } = await supabase
                            .from('checkout_offers')
                            .select('product_id, product_type, application_id, product_name, offer_product_image')
                            .eq('checkout_offer_id', finalCheckoutId)
                            .in('offer_type', ['upsell', 'downsell'])
                            .limit(1)
                            .maybeSingle()

                        return data
                    })())

                    if (offerRow) {
                        // 1. Direct product_name from checkout_offers (fastest)
                        if (offerRow.product_name) {
                            resolvedProductName = offerRow.product_name
                            resolvedProductImage = offerRow.offer_product_image || undefined
                        }

                        // 2. Try products table (app_product)
                        if (!resolvedProductName && offerRow.product_id) {
                            const { data: appProd } = await supabase
                                .from('products')
                                .select('id, name, description, image_url')
                                .eq('id', offerRow.product_id)
                                .maybeSingle()

                            if (appProd) {
                                resolvedProductName = appProd.name
                                resolvedProductImage = appProd.image_url
                                resolvedProductDesc = appProd.description || ''
                                resolvedProductId = appProd.id
                            }
                        }

                        // 3. Try marketplace_products table (member_area)
                        if (!resolvedProductName && offerRow.product_id) {
                            const { data: mpProd } = await supabase
                                .from('marketplace_products')
                                .select('id, name, description, image_url')
                                .eq('id', offerRow.product_id)
                                .maybeSingle()

                            if (mpProd) {
                                resolvedProductName = mpProd.name
                                resolvedProductImage = mpProd.image_url
                                resolvedProductDesc = mpProd.description || ''
                                resolvedProductId = mpProd.id
                            }
                        }
                    }
                }

                if (resolvedProductName) {
                    fetchedProduct = {
                        id: resolvedProductId,
                        name: resolvedProductName,
                        price: 0,
                        image_url: resolvedProductImage,
                        description: resolvedProductDesc
                    }
                } else {
                    // Fallback: use app name
                    const { data: appData, error: appError } = await supabase
                        .from('applications')
                        .select('*')
                        .eq('id', checkoutData.application_id)
                        .single()

                    if (appError) throw appError
                    if (!appData) throw new Error('App not found')

                    fetchedProduct = {
                        id: appData.id,
                        name: appData.name,
                        price: 0,
                        image_url: appData.logo,
                        description: appData.description || ''
                    }
                }
            } else {
                // It's a marketplace product — resultado já disponível da query paralelizada
                const { data: productData, error: productError } = productQueryResult

                if (productError) throw productError
                if (!productData) throw new Error('Product not found')

                fetchedProduct = {
                    id: productData.id,
                    name: productData.name,
                    price: productData.price,
                    image_url: productData.image_url,
                    description: productData.description
                }
            }

            const fetchedCheckout: Checkout = {
                id: checkoutData.id,
                name: checkoutData.name,
                product_id: checkoutData.member_area_id || checkoutData.application_id,
                is_default: checkoutData.is_default,
                custom_price: checkoutData.custom_price,
                banner_image: checkoutData.banner_image,
                banner_title: checkoutData.banner_title,
                custom_height: checkoutData.custom_height,
                language: checkoutData.language || 'en',
                created_at: checkoutData.created_at
            }

            setProduct(fetchedProduct)
            setCheckout(fetchedCheckout)

            // Save type and applicationId in state to pass to CheckoutDigital
            if (productType === 'app') {
                // Store app data to pass to checkout
                (fetchedProduct as any).productType = 'app';
                (fetchedProduct as any).applicationId = applicationId
            }

            // Load timer settings if they exist
            const customFields = checkoutData.custom_fields || {}
            const checkoutLang = checkoutData.language || 'en'
            const translations = getTranslations(checkoutLang as CheckoutLanguage)
            if (customFields.timer) {
                setTimerConfig({
                    ...customFields.timer,
                    activeText: customFields.timer.activeText || translations.limitedTimeOffer,
                    finishedText: customFields.timer.finishedText || translations.offerEnded
                })
            }

            // Load button color
            if (customFields.buttonColor) {
                setButtonColor(customFields.buttonColor)
            }

            // Pré-carregar config de redirect enquanto o usuário preenche o formulário
            const isUpsellCheckout = new URLSearchParams(window.location.search).get('nobumps') === '1'
            fetchRedirectConfig(
                checkoutData.id,
                checkoutData.application_id || checkoutData.member_area_id,
                isUpsellCheckout
            )
        } catch (error) {
            console.error('Error loading data:', error)
            // Redirect to error page or 404
            navigate('/404')
        } finally {
            setLoading(false)
        }
    }, [productId, checkoutId, shortId, navigate])

    const fetchRedirectConfig = useCallback(async (
        checkoutId: string,
        productOwnerId: string | undefined,
        isUpsell: boolean
    ) => {
        try {
            if (!isUpsell) {
                // Strategy 1: funnel_page linkado diretamente ao checkout
                const pageRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/funnel_pages?checkout_id=eq.${checkoutId}&select=id,settings,page_type`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                let pages = await pageRes.json()

                // Strategy 2: product -> funnels -> funnel_pages
                if (!pages?.length || !pages[0]?.settings?.post_purchase_page_id) {
                    if (productOwnerId) {
                        const funnelRes = await fetch(
                            `${SUPABASE_URL}/rest/v1/funnels?product_id=eq.${productOwnerId}&select=id`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        const funnels = await funnelRes.json()

                        if (funnels?.[0]?.id) {
                            const allPagesRes = await fetch(
                                `${SUPABASE_URL}/rest/v1/funnel_pages?funnel_id=eq.${funnels[0].id}&select=id,name,page_type,checkout_id,settings`,
                                { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                            )
                            const allPages = await allPagesRes.json()

                            const checkoutPage = allPages?.find((p: any) =>
                                p.page_type === 'checkout' ||
                                p.checkout_id === checkoutId ||
                                p.settings?.post_purchase_page_id
                            )

                            if (checkoutPage) pages = [checkoutPage]
                        }
                    }
                }

                const settings = pages?.[0]?.settings

                if (settings?.post_purchase_redirect_url) {
                    setPreloadedRedirect({ url: settings.post_purchase_redirect_url })
                    return
                }

                if (settings?.post_purchase_page_id) {
                    const targetRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/funnel_pages?id=eq.${settings.post_purchase_page_id}&select=external_url,page_type`,
                        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                    )
                    const targetData = await targetRes.json()
                    const target = targetData?.[0]
                    if (target?.external_url) {
                        setPreloadedRedirect({ url: target.external_url })
                        return
                    }
                }
            } else {
                // Fluxo upsell
                const offerRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/checkout_offers?checkout_id=eq.${checkoutId}&is_active=eq.true&offer_type=neq.order_bump&select=page_id`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const offers = await offerRes.json()

                if (offers?.[0]?.page_id) {
                    const pageRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/funnel_pages?id=eq.${offers[0].page_id}&select=settings`,
                        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                    )
                    const pageData = await pageRes.json()
                    const settings = pageData?.[0]?.settings

                    if (settings?.accept_redirect_url) {
                        setPreloadedRedirect({ url: settings.accept_redirect_url })
                        return
                    }

                    if (settings?.accept_page_id) {
                        const targetRes = await fetch(
                            `${SUPABASE_URL}/rest/v1/funnel_pages?id=eq.${settings.accept_page_id}&select=external_url,page_type`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        const targetData = await targetRes.json()
                        const target = targetData?.[0]
                        if (target?.external_url) {
                            setPreloadedRedirect({ url: target.external_url })
                            return
                        }
                    }
                }
            }

            // Nenhum redirect configurado
            setPreloadedRedirect({ url: null })
        } catch (e) {
            console.error('Error pre-loading redirect config:', e)
            setPreloadedRedirect({ url: null })
        }
    }, [])

    useEffect(() => {
        if ((productId && checkoutId) || shortId) {
            fetchData()
        } else {
            setLoading(false)
        }
    }, [productId, checkoutId, shortId, fetchData])

    const lang = checkout?.language || 'en'
    const t = getTranslations(lang as CheckoutLanguage)

    // Abandonment tracking — fired when user leaves with a captured lead but no payment
    const fireAbandonedEvent = useCallback(() => {
        if (abandonedFiredRef.current || !leadDataRef.current || !finalCheckoutId) return
        abandonedFiredRef.current = true
        const payload = JSON.stringify({
            checkoutId: finalCheckoutId,
            productId: product?.id,
            customerEmail: leadDataRef.current.email,
            customerName: leadDataRef.current.name,
            customerPhone: leadDataRef.current.phone,
            trackingParameters: utmParams.current,
        })
        fetch(`${SUPABASE_URL}/functions/v1/utmify-abandoned`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: payload,
            keepalive: true,
        }).catch(() => { /* fire-and-forget */ })
    }, [finalCheckoutId, product?.id])

    useEffect(() => {
        const handleUnload = () => fireAbandonedEvent()
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') fireAbandonedEvent()
        }
        window.addEventListener('beforeunload', handleUnload)
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            window.removeEventListener('beforeunload', handleUnload)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [fireAbandonedEvent])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">{t.loadingCheckout}</p>
                </div>
            </div>
        )
    }

    if (!product || !checkout) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-100 mb-4">{t.checkoutNotFound}</h1>
                    <p className="text-gray-600">{t.checkoutNotFoundDescription}</p>
                </div>
            </div>
        )
    }

    const handleProcessPayment = async (paymentData: { formData: { name: string; email: string; phone: string }, selectedOrderBumps: any[], totalAmount: number }) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/process-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    productId: product!.id,
                    productType: (product as any).productType,
                    applicationId: (product as any).applicationId,
                    checkoutId: checkout!.id,
                    customerEmail: paymentData.formData.email,
                    customerName: paymentData.formData.name,
                    customerPhone: paymentData.formData.phone,
                    selectedOrderBumps: paymentData.selectedOrderBumps,
                    totalAmount: paymentData.totalAmount,
                    trackingParameters: utmParams.current,
                }),
            })

            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error || 'Payment failed')
            }

            // Store result for redirect — used directly in onPaymentSuccess
            if (result.purchaseId && result.thankyouToken) {
                paymentResultRef.current = {
                    purchaseId: result.purchaseId,
                    thankyouToken: result.thankyouToken
                }
            }

            return { success: true }
        } catch (error: any) {
            throw new Error(error.message || 'Payment processing failed')
        }
    }

    return (
        <CheckoutDigital
            productId={product.id}
            productName={product.name}
            productPrice={checkout.custom_price || product.price}
            productImage={product.image_url}
            productDescription={product.description}
            productType={(product as any).productType}
            applicationId={(product as any).applicationId}
            checkoutId={checkout.id}
            language={checkout.language}
            customBanner={{
                image: checkout.banner_image,
                title: checkout.banner_title,
                customHeight: checkout.custom_height
            }}
            timerConfig={timerConfig}
            isPreview={false}
            buttonColor={buttonColor}
            onProcessPayment={handleProcessPayment}
            onLeadCapture={(data) => {
                leadDataRef.current = data
                abandonedFiredRef.current = false
            }}
            onPaymentSuccess={async (paymentResult) => {
                // Pagamento confirmado — cancelar envio de abandono
                abandonedFiredRef.current = true
                // Track conversion event
                if (finalCheckoutId) {
                    try {
                        await trackCheckoutEvent(finalCheckoutId, 'conversion', {
                            purchase_id: paymentResult?.purchaseId || paymentResultRef.current?.purchaseId,
                            thankyou_token: paymentResult?.thankyouToken || paymentResultRef.current?.thankyouToken,
                            timestamp: new Date().toISOString()
                        })
                    } catch (error) {
                        console.warn('Failed to track conversion:', error)
                    }
                }

                const result = paymentResult || paymentResultRef.current
                if (!result?.purchaseId) return

                const urlParams = new URLSearchParams(window.location.search)
                const postPurchaseRedirect = urlParams.get('redirect')

                // Redirect explícito via query param
                if (postPurchaseRedirect) {
                    setTimeout(() => { window.location.href = postPurchaseRedirect }, 1500)
                    return
                }

                // Usar config pré-carregada enquanto o usuário preenchia o formulário
                if (preloadedRedirect?.url) {
                    const baseUrl = preloadedRedirect.url
                    const finalUrl = baseUrl.includes('?')
                        ? `${baseUrl}&purchase_id=${result.purchaseId}&token=${result.thankyouToken}`
                        : `${baseUrl}?purchase_id=${result.purchaseId}&token=${result.thankyouToken}`
                    setTimeout(() => { window.location.href = finalUrl }, 1500)
                    return
                }

            }}
        />
    )
}