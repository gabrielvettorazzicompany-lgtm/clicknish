import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
// ⚡ Analytics sem supabase — não puxa vendor-supabase (~200KB) no bundle do checkout
import { useCheckoutPageView, trackCheckoutEvent } from '@/services/checkout-analytics'
import type { CheckoutLanguage } from '@/components/checkout/translations'
import { getTranslations } from '@/components/checkout/translations'
// ⚡ PRELOAD: Stripe começa a carregar imediatamente — importação barata do singleton
// (não puxa o bundle inteiro de CheckoutDigital)
import { getStripePromise } from '@/lib/stripe-singleton'

// ⚡ LAZY: CheckoutDigital (~pesado) só é parsed/executado após o React hidratar.
// O download já começa agora (browser faz prefetch), mas não bloqueia o primeiro render.
const CheckoutDigital = lazy(() => import('@/components/checkout/CheckoutDigital'))

// ⚡ PRELOAD: inicia conexão com Stripe em paralelo com o fetch de dados
getStripePromise()

interface Product {
    id: string
    name: string
    price: number
    image_url?: string
    description?: string
    payment_methods?: string[]
    default_payment_method?: string
    dynamic_checkout?: boolean
    productType?: 'app' | 'marketplace'
    applicationId?: string
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
    custom_width?: number
    language?: CheckoutLanguage
    created_at: string
}

// ⚡ INSTANT BOOT: lê __CHECKOUT_DATA__ de forma síncrona antes do primeiro render
// Se os dados já estão no HTML (KV hit), o checkout abre sem nenhum skeleton
function consumePreRenderedData() {
    const raw = (window as any).__CHECKOUT_DATA__
    if (!raw || raw.error) return null
    try {
        const ck = raw.checkout
        const prod = raw.product
        if (!ck || !prod) return null
        delete (window as any).__CHECKOUT_DATA__
        delete (window as any).__checkoutDataPromise
        return raw
    } catch {
        return null
    }
}

function buildInitialState(raw: any) {
    if (!raw) return null
    const ck = raw.checkout
    const prod = raw.product
    const customFields = ck.custom_fields || {}
    const lang = (ck.language || 'en') as CheckoutLanguage
    const translations = getTranslations(lang)

    const product: Product = {
        id: prod.id,
        name: prod.name,
        price: prod.price || 0,
        image_url: prod.image_url,
        description: prod.description || '',
        productType: raw.productType,
        applicationId: prod.applicationId || undefined,
        payment_methods: (customFields.paymentMethods ?? prod.payment_methods) as ('credit_card' | 'paypal')[] | undefined,
        default_payment_method: prod.default_payment_method as 'credit_card' | 'paypal' | undefined,
    }
    const checkout: Checkout = {
        id: ck.id,
        name: ck.name,
        product_id: ck.member_area_id || ck.application_id,
        is_default: ck.is_default,
        custom_price: ck.custom_price,
        banner_image: ck.banner_image,
        banner_title: ck.banner_title,
        custom_height: ck.custom_height,
        custom_width: ck.custom_width,
        language: lang,
        created_at: ck.created_at,
    }
    const timerConfig = customFields.timer
        ? { ...customFields.timer, activeText: customFields.timer.activeText || translations.limitedTimeOffer, finishedText: customFields.timer.finishedText || translations.offerEnded }
        : { enabled: false, minutes: 15, backgroundColor: '#ef4444', textColor: '#ffffff', activeText: '', finishedText: '' }

    return {
        product,
        checkout,
        timerConfig,
        buttonColor: customFields.buttonColor || '#111827',
        buttonText: customFields.buttonText || '',
        securitySealsEnabled: customFields.securitySealsEnabled || false,
        testimonials: (customFields.testimonials || []).map((t: any) => ({ ...t, slot: t.slot || 'below_button' })),
        testimonialsCarouselMode: customFields.testimonialsCarouselMode || false,
        testimonialsHorizontalMode: customFields.testimonialsHorizontalMode || false,
        imageBlocks: customFields.imageBlocks || [],
        customPixels: customFields.customPixels || '',
        customUtms: customFields.customUtms || '',
        initialOrderBumps: raw.offers?.length > 0 ? raw.offers : undefined,
        initialAppProducts: raw.applicationProducts?.length > 0 ? raw.applicationProducts : undefined,
        preloadedRedirect: raw.redirectConfig?.success_url ? { url: raw.redirectConfig.success_url } : { url: null },
        checkoutId: ck.id,
        stripePublishableKey: raw.stripe_publishable_key || undefined,
    }
}

const _preRendered = consumePreRenderedData()
const _initial = buildInitialState(_preRendered)
// Flag para garantir que _initial só é usado uma vez (evita dados stale em navegações SPA)
let _initialUsed = false

export default function CheckoutPublic() {
    const { productId, checkoutId, shortId } = useParams<{ productId?: string; checkoutId?: string; shortId?: string }>()
    const navigate = useNavigate()

    // ⚡ Consome _initial apenas uma vez — evita dados stale em navegações SPA
    const snap = useState(() => {
        if (_initial && !_initialUsed) {
            _initialUsed = true
            return _initial
        }
        return null
    })[0]

    // ⚡ Se dados já disponíveis no HTML, começa sem loading (zero skeleton)
    const [loading, setLoading] = useState(!snap)
    const [fetchError, setFetchError] = useState(false)
    const [product, setProduct] = useState<Product | null>(snap?.product ?? null)
    const [checkout, setCheckout] = useState<Checkout | null>(snap?.checkout ?? null)
    const [finalCheckoutId, setFinalCheckoutId] = useState<string | null>(snap?.checkoutId ?? null)

    const [timerConfig, setTimerConfig] = useState(snap?.timerConfig ?? {
        enabled: false,
        minutes: 15,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
        activeText: '',
        finishedText: ''
    })
    const paymentResultRef = useRef<{ purchaseId: string; thankyouToken: string; redirectUrl?: string } | null>(null)
    const leadDataRef = useRef<{ email: string; name: string; phone: string } | null>(null)
    const abandonedFiredRef = useRef(false)
    const [buttonColor, setButtonColor] = useState(snap?.buttonColor ?? '#111827')
    const [buttonText, setButtonText] = useState(snap?.buttonText ?? '')
    const [customPixels, setCustomPixels] = useState(snap?.customPixels ?? '')
    const [customUtms, setCustomUtms] = useState(snap?.customUtms ?? '')
    const [securitySealsEnabled, setSecuritySealsEnabled] = useState(snap?.securitySealsEnabled ?? false)
    const [testimonials, setTestimonials] = useState<any[]>(snap?.testimonials ?? [])
    const [testimonialsCarouselMode, setTestimonialsCarouselMode] = useState(snap?.testimonialsCarouselMode ?? false)
    const [testimonialsHorizontalMode, setTestimonialsHorizontalMode] = useState(snap?.testimonialsHorizontalMode ?? false)
    const [imageBlocks, setImageBlocks] = useState<any[]>(snap?.imageBlocks ?? [])
    const [preloadedRedirect, setPreloadedRedirect] = useState<{ url: string | null } | null>(snap?.preloadedRedirect ?? null)
    const [initialOrderBumps, setInitialOrderBumps] = useState<any[] | undefined>(snap?.initialOrderBumps)
    const [initialAppProducts, setInitialAppProducts] = useState<any[] | undefined>(snap?.initialAppProducts)
    const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null)
    const [mollieEnabledMethods, setMollieEnabledMethods] = useState<Array<{ id: string; label: string; description?: string; icon_url?: string }>>([])
    const [mollieVerifying, setMollieVerifying] = useState(false)
    const [stripePublishableKey, setStripePublishableKey] = useState<string | undefined>(snap?.stripePublishableKey)

    // Capture UTM params once from the URL when the checkout opens
    // Persiste por 30 dias no localStorage (igual Hotmart/PerfectPay)
    const UTM_STORAGE_KEY = 'clicknich_utm'
    const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

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
        const fromUrl = {
            src: p.get('src'),
            sck: p.get('sck'),
            utm_source: p.get('utm_source'),
            utm_campaign: p.get('utm_campaign'),
            utm_medium: p.get('utm_medium'),
            utm_content: p.get('utm_content'),
            utm_term: p.get('utm_term'),
        }

        const hasUrlParams = Object.values(fromUrl).some(v => v !== null)

        if (hasUrlParams) {
            // Chegou com UTMs na URL → salva no localStorage com expiração
            try {
                localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify({
                    params: fromUrl,
                    expires_at: Date.now() + UTM_TTL_MS
                }))
            } catch { }
            utmParams.current = fromUrl
        } else {
            // Sem UTMs na URL → tenta recuperar do localStorage
            try {
                const stored = localStorage.getItem(UTM_STORAGE_KEY)
                if (stored) {
                    const parsed = JSON.parse(stored)
                    if (parsed.expires_at > Date.now()) {
                        utmParams.current = parsed.params
                    } else {
                        localStorage.removeItem(UTM_STORAGE_KEY) // expirou
                    }
                }
            } catch { }
        }
    }, [])

    // Track page view when checkout ID is determined
    useCheckoutPageView(finalCheckoutId || '')

    // Verificar retorno do Mollie (redirect flow)
    useEffect(() => {
        const p = new URLSearchParams(window.location.search)
        const mollieReturn = p.get('mollie_return')
        const molliePaymentId = p.get('paymentId')
        if (mollieReturn !== '1' || !molliePaymentId) return

        setMollieVerifying(true)
        fetch('https://api.clicknich.com/api/process-mollie-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', paymentId: molliePaymentId }),
        })
            .then(r => r.json())
            .then((result: any) => {
                if (result.success) {
                    // Limpar params da URL sem recarregar
                    const cleanUrl = window.location.pathname
                    window.history.replaceState({}, '', cleanUrl)
                    if (result.redirectUrl) {
                        window.location.href = result.redirectUrl
                    }
                } else {
                    setMollieVerifying(false)
                }
            })
            .catch(() => setMollieVerifying(false))
    }, [])

    // Buscar métodos Mollie habilitados — filtros dependem do modo
    useEffect(() => {
        const isDynamic = product?.dynamic_checkout ?? false
        let url: string
        if (isDynamic) {
            // Modo dinâmico: filtro por país + top 2 por popularidade
            url = 'https://api.clicknich.com/api/mollie/methods?dynamic=1'
        } else {
            // Modo manual: todos os métodos habilitados (sem filtro de país)
            url = 'https://api.clicknich.com/api/mollie/methods?all=1'
        }
        fetch(url)
            .then(r => r.json())
            .then((d: any) => { if (d.methods?.length > 0) setMollieEnabledMethods(d.methods) })
            .catch(() => { })
    }, [product?.dynamic_checkout])

    const fetchData = useCallback(async () => {
        try {
            const urlParams = new URLSearchParams(window.location.search)
            const isUpsellCheckout = urlParams.get('nobumps') === '1'

            // ═══════════════════════════════════════════
            // OPTIMIZED PATH: Edge-cached RPC → All data  
            // ═══════════════════════════════════════════
            if (shortId && !isUpsellCheckout) {
                // ⚡ INSTANT PATH: dados já disponíveis via pre-render do index.html
                // Quando KV hit (<5ms), os dados chegam antes do React montar — zero fetch
                const preRendered = (window as any).__CHECKOUT_DATA__
                if (preRendered) {
                    delete (window as any).__CHECKOUT_DATA__
                    delete (window as any).__checkoutDataPromise
                }

                // ⚡ FAST PATH: promise já em voo iniciada no index.html
                const rpcResult = preRendered ?? await (
                    (window as any).__checkoutDataPromise
                    ?? fetch(`https://api.clicknich.com/api/checkout-data/${shortId}`).then((r: Response) => r.json())
                )

                if ((window as any).__checkoutDataPromise) {
                    delete (window as any).__checkoutDataPromise
                }


                if (rpcResult && !rpcResult.error) {
                    const ck = rpcResult.checkout
                    const prod = rpcResult.product

                    setFinalCheckoutId(ck.id)

                    const fetchedProduct: Product = {
                        id: prod.id,
                        name: prod.name,
                        price: prod.price || 0,
                        image_url: prod.image_url,
                        description: prod.description || '',
                        productType: rpcResult.productType,
                        applicationId: prod.applicationId || undefined,
                        payment_methods: prod.payment_methods || ['credit_card'],
                        default_payment_method: prod.default_payment_method || 'credit_card',
                        dynamic_checkout: prod.dynamic_checkout || false,
                    }

                    const fetchedCheckout: Checkout = {
                        id: ck.id,
                        name: ck.name,
                        product_id: ck.member_area_id || ck.application_id,
                        is_default: ck.is_default,
                        custom_price: ck.custom_price,
                        banner_image: ck.banner_image,
                        banner_title: ck.banner_title,
                        custom_height: ck.custom_height,
                        custom_width: ck.custom_width,
                        language: ck.language || 'en',
                        created_at: ck.created_at
                    }

                    setProduct(fetchedProduct)
                    setCheckout(fetchedCheckout)

                    // ✅ Order bumps already resolved by RPC
                    if (rpcResult.offers?.length > 0) {
                        setInitialOrderBumps(rpcResult.offers)
                    }

                    // ✅ Application products already resolved by RPC  
                    if (rpcResult.applicationProducts?.length > 0) {
                        setInitialAppProducts(rpcResult.applicationProducts)
                    }

                    // ✅ Redirect config already resolved by RPC
                    if (rpcResult.redirectConfig?.success_url) {
                        setPreloadedRedirect({ url: rpcResult.redirectConfig.success_url })
                    } else {
                        setPreloadedRedirect({ url: null })
                    }

                    // Timer & button color from custom_fields
                    const customFields = ck.custom_fields || {}
                    const translations = getTranslations((ck.language || 'en') as CheckoutLanguage)
                    if (customFields.timer) {
                        setTimerConfig({
                            ...customFields.timer,
                            activeText: customFields.timer.activeText || translations.limitedTimeOffer,
                            finishedText: customFields.timer.finishedText || translations.offerEnded
                        })
                    }
                    if (customFields.buttonColor) {
                        setButtonColor(customFields.buttonColor)
                    }
                    if (customFields.buttonText) {
                        setButtonText(customFields.buttonText)
                    }
                    if (customFields.securitySealsEnabled !== undefined) {
                        setSecuritySealsEnabled(customFields.securitySealsEnabled)
                    }
                    if (customFields.testimonials) {
                        setTestimonials(customFields.testimonials.map((t: any) => ({ ...t, slot: t.slot || 'below_button' })))
                    }
                    if (customFields.testimonialsCarouselMode !== undefined) {
                        setTestimonialsCarouselMode(customFields.testimonialsCarouselMode)
                    }
                    if (customFields.testimonialsHorizontalMode !== undefined) {
                        setTestimonialsHorizontalMode(customFields.testimonialsHorizontalMode)
                    }
                    if (customFields.imageBlocks) {
                        setImageBlocks(customFields.imageBlocks)
                    }
                    if (customFields.customPixels) {
                        setCustomPixels(customFields.customPixels)
                    }
                    if (customFields.customUtms) {
                        setCustomUtms(customFields.customUtms)
                    }
                    if (rpcResult.stripe_publishable_key) {
                        setStripePublishableKey(rpcResult.stripe_publishable_key)
                    }

                    // Criar sessão KV em background: pré-carrega todos os dados para o processo
                    // de pagamento, eliminando as 8 queries do worker na hora do clique em "Pagar".
                    // ⚡ setLoading(false) junto com os outros setState — batched pelo React 18
                    // Faz skeleton → checkout em 1 render só, ao invés de 2
                    setLoading(false)

                    fetch('https://api.clicknich.com/api/checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            checkoutId: ck.id,
                            productId: prod.id,
                            productType: rpcResult.productType,
                            applicationId: prod.applicationId || undefined,
                        }),
                    })
                        .then(r => r.json())
                        .then((data: any) => { if (data.sessionId) setCheckoutSessionId(data.sessionId) })
                        .catch(() => { /* silent — payment faz fallback */ })

                    return
                }
                // RPC failed — fall through to legacy path
            }

            // ═══════════════════════════════════════════
            // LEGACY PATH: Long URL or upsell checkout
            // ═══════════════════════════════════════════
            // ⚡ usa checkout-supabase (chunk isolado, sem contaminação do hero-ui)
            const { checkoutSupabase: supabase } = await import('@/services/checkout-supabase')
            let finalProductId = productId
            let finalCheckoutId = checkoutId
            let knownIsApp: boolean | null = null

            if (shortId) {
                // RPC failed, fallback for short URL
                const { data: urlData, error: urlError } = await supabase
                    .from('checkout_urls')
                    .select('member_area_id, application_id, checkout_id')
                    .eq('id', shortId)
                    .single()

                if (urlError || !urlData) throw new Error('URL not found')

                finalProductId = urlData.member_area_id || urlData.application_id
                finalCheckoutId = urlData.checkout_id
                knownIsApp = !!urlData.application_id
                setFinalCheckoutId(finalCheckoutId ?? null)
            } else if (productId && checkoutId) {
                finalCheckoutId = checkoutId
                setFinalCheckoutId(finalCheckoutId ?? null)
            }

            const productTable = knownIsApp ? 'applications' : 'marketplace_products'
            const [checkoutQueryResult, productQueryResult] = await Promise.all([
                supabase.from('checkouts').select('*').eq('id', finalCheckoutId).single(),
                finalProductId
                    ? supabase.from(productTable).select('*').eq('id', finalProductId).single()
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
                const isUpsellCheckout = urlParams.get('nobumps') === '1'

                let resolvedProductName: string | null = null
                let resolvedProductImage: string | undefined = undefined
                let resolvedProductDesc = ''
                let resolvedProductId = checkoutData.application_id

                if (isUpsellCheckout) {
                    // Single query: search by checkout_id OR checkout_offer_id
                    const { data: offerRow } = await supabase
                        .from('checkout_offers')
                        .select('product_id, product_type, application_id, product_name, offer_product_image')
                        .or(`checkout_id.eq.${finalCheckoutId},checkout_offer_id.eq.${finalCheckoutId}`)
                        .in('offer_type', ['upsell', 'downsell'])
                        .limit(1)
                        .maybeSingle()

                    if (offerRow) {
                        // 1. Direct product_name from checkout_offers (fastest)
                        if (offerRow.product_name) {
                            resolvedProductName = offerRow.product_name
                            resolvedProductImage = offerRow.offer_product_image || undefined
                        }

                        // 2. Use product_type to query the right table directly (no waterfall)
                        if (!resolvedProductName && offerRow.product_id) {
                            const table = offerRow.product_type === 'app_product' ? 'products' : 'marketplace_products'
                            const { data: prod } = await supabase
                                .from(table)
                                .select('id, name, description, image_url')
                                .eq('id', offerRow.product_id)
                                .maybeSingle()

                            if (prod) {
                                resolvedProductName = prod.name
                                resolvedProductImage = prod.image_url
                                resolvedProductDesc = prod.description || ''
                                resolvedProductId = prod.id
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
                        description: resolvedProductDesc,
                        payment_methods: ['credit_card', 'paypal'],
                        default_payment_method: 'credit_card'
                    }
                } else {
                    // App data: already fetched in parallel when knownIsApp, otherwise fetch now
                    let appData = (knownIsApp && productQueryResult.data) ? productQueryResult.data : null
                    if (!appData) {
                        const { data, error: appError } = await supabase
                            .from('applications')
                            .select('*')
                            .eq('id', checkoutData.application_id)
                            .single()
                        if (appError) throw appError
                        if (!data) throw new Error('App not found')
                        appData = data
                    }

                    fetchedProduct = {
                        id: appData.id,
                        name: appData.name,
                        price: 0,
                        image_url: appData.logo_url,
                        description: appData.description || '',
                        payment_methods: appData.payment_methods,
                        default_payment_method: appData.default_payment_method,
                        dynamic_checkout: appData.dynamic_checkout ?? false
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
                    description: productData.description,
                    payment_methods: productData.payment_methods,
                    default_payment_method: productData.default_payment_method,
                    dynamic_checkout: productData.dynamic_checkout ?? false
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
                custom_width: checkoutData.custom_width,
                language: checkoutData.language || 'en',
                created_at: checkoutData.created_at
            }

            setProduct(fetchedProduct)
            setCheckout(fetchedCheckout)

            // Save type and applicationId in state to pass to CheckoutDigital
            if (productType === 'app') {
                fetchedProduct.productType = 'app'
                fetchedProduct.applicationId = applicationId
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
            if (customFields.buttonText) {
                setButtonText(customFields.buttonText)
            }

            // Load security seals
            if (customFields.securitySealsEnabled !== undefined) {
                setSecuritySealsEnabled(customFields.securitySealsEnabled)
            }

            // Load testimonials and image blocks
            if (customFields.testimonials) {
                setTestimonials(customFields.testimonials.map((t: any) => ({ ...t, slot: t.slot || 'below_button' })))
            }
            if (customFields.testimonialsCarouselMode !== undefined) {
                setTestimonialsCarouselMode(customFields.testimonialsCarouselMode)
            }
            if (customFields.testimonialsHorizontalMode !== undefined) {
                setTestimonialsHorizontalMode(customFields.testimonialsHorizontalMode)
            }
            if (customFields.imageBlocks) {
                setImageBlocks(customFields.imageBlocks)
            }

            // Aplicar override de métodos de pagamento por checkout
            if (customFields.paymentMethods && Array.isArray(customFields.paymentMethods)) {
                fetchedProduct.payment_methods = customFields.paymentMethods as ('credit_card' | 'paypal')[]
                // Atualiza o produto no estado com o override
                setProduct({ ...fetchedProduct })
            }

            // Load pixels e UTMs personalizados
            if (customFields.customPixels) {
                setCustomPixels(customFields.customPixels)
            }
            if (customFields.customUtms) {
                setCustomUtms(customFields.customUtms)
            }

            // Pré-carregar config de redirect enquanto o usuário preenche o formulário
            fetchRedirectConfig(
                checkoutData.id,
                checkoutData.application_id || checkoutData.member_area_id,
                isUpsellCheckout
            )

            // Long URL: create short URL in background and update address bar (no redirect/remount)
            if (!shortId && productId && checkoutId) {
                const col = checkoutData.application_id ? 'application_id' : 'member_area_id'
                    ; (async () => {
                        try {
                            const { data: existing } = await supabase.from('checkout_urls')
                                .select('id').eq(col, productId).eq('checkout_id', checkoutId).single()
                            if (existing?.id) {
                                window.history.replaceState(null, '', `/checkout/${existing.id}${window.location.search}`)
                                return
                            }
                            const { data: created } = await supabase.from('checkout_urls')
                                .insert({ [col]: productId, checkout_id: checkoutId }).select('id').single()
                            if (created?.id) {
                                window.history.replaceState(null, '', `/checkout/${created.id}${window.location.search}`)
                            }
                        } catch { /* silent */ }
                    })()
            }
        } catch (error) {
            console.error('Error loading data:', error)
            setFetchError(true)
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
            // ⚡ usa checkout-supabase (chunk isolado, sem contaminação do hero-ui)
            const { checkoutSupabase: supabase } = await import('@/services/checkout-supabase')
            if (!isUpsell) {
                // Strategy 1: funnel_page linked directly to checkout
                let { data: pages } = await supabase
                    .from('funnel_pages')
                    .select('id, settings, page_type')
                    .eq('checkout_id', checkoutId)

                // Strategy 2: product -> funnels -> funnel_pages
                if (!pages?.length || !(pages[0] as any)?.settings?.post_purchase_page_id) {
                    if (productOwnerId) {
                        const { data: funnels } = await supabase
                            .from('funnels')
                            .select('id')
                            .eq('product_id', productOwnerId)
                            .limit(1)

                        if (funnels?.[0]?.id) {
                            const { data: allPages } = await supabase
                                .from('funnel_pages')
                                .select('id, name, page_type, checkout_id, settings')
                                .eq('funnel_id', funnels[0].id)

                            const checkoutPage = allPages?.find((p: any) =>
                                p.page_type === 'checkout' ||
                                p.checkout_id === checkoutId ||
                                p.settings?.post_purchase_page_id
                            )

                            if (checkoutPage) pages = [checkoutPage]
                        }
                    }
                }

                const settings = (pages?.[0] as any)?.settings

                if (settings?.post_purchase_redirect_url) {
                    setPreloadedRedirect({ url: settings.post_purchase_redirect_url })
                    return
                }

                if (settings?.post_purchase_page_id) {
                    const { data: target } = await supabase
                        .from('funnel_pages')
                        .select('external_url, page_type')
                        .eq('id', settings.post_purchase_page_id)
                        .maybeSingle()

                    if (target?.external_url) {
                        setPreloadedRedirect({ url: target.external_url })
                        return
                    }
                }
            } else {
                // Upsell flow
                const { data: offers } = await supabase
                    .from('checkout_offers')
                    .select('page_id')
                    .eq('checkout_id', checkoutId)
                    .eq('is_active', true)
                    .neq('offer_type', 'order_bump')
                    .limit(1)

                if (offers?.[0]?.page_id) {
                    const { data: pageData } = await supabase
                        .from('funnel_pages')
                        .select('settings')
                        .eq('id', offers[0].page_id)
                        .maybeSingle()

                    const settings = (pageData as any)?.settings

                    if (settings?.accept_redirect_url) {
                        setPreloadedRedirect({ url: settings.accept_redirect_url })
                        return
                    }

                    if (settings?.accept_page_id) {
                        const { data: target } = await supabase
                            .from('funnel_pages')
                            .select('external_url, page_type')
                            .eq('id', settings.accept_page_id)
                            .maybeSingle()

                        if (target?.external_url) {
                            setPreloadedRedirect({ url: target.external_url })
                            return
                        }
                    }
                }
            }

            setPreloadedRedirect({ url: null })
        } catch (e) {
            console.error('Error pre-loading redirect config:', e)
            setPreloadedRedirect({ url: null })
        }
    }, [])

    useEffect(() => {
        // ⚡ Se dados já foram carregados sincronicamente (KV hit), pula o fetchData
        if (snap) {
            // Ainda precisamos criar a sessão para otimizar o pagamento
            fetch('https://api.clicknich.com/api/checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkoutId: snap.checkoutId,
                    productId: snap.product.id,
                    productType: snap.product.productType,
                    applicationId: snap.product.applicationId || undefined,
                }),
            })
                .then(r => r.json())
                .then((data: any) => { if (data.sessionId) setCheckoutSessionId(data.sessionId) })
                .catch(() => { })
            return
        }
        if ((productId && checkoutId) || shortId) {
            fetchData()
        } else {
            setLoading(false)
        }
    }, [productId, checkoutId, shortId, fetchData, loading]) // loading: re-executa ao clicar "Tentar novamente"

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
        fetch('https://api.clicknich.com/api/utmify-abandoned', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

    // Injetar scripts personalizados (pixels + UTMs) no <head> da página
    useEffect(() => {
        const allCustomHtml = [customPixels, customUtms]
            .filter(html => html && html.trim())
            .join('\n\n')

        if (!allCustomHtml) return

        const injected: HTMLElement[] = []

        // Cria um container temporário para parsear o HTML
        const container = document.createElement('div')
        container.innerHTML = allCustomHtml

        // Move cada nó filho para o <head>
        Array.from(container.childNodes).forEach((node) => {
            // Re-criar scripts para garantir execução
            if ((node as HTMLElement).tagName === 'SCRIPT') {
                const original = node as HTMLScriptElement
                const script = document.createElement('script')
                Array.from(original.attributes).forEach(attr => script.setAttribute(attr.name, attr.value))
                script.textContent = original.textContent
                document.head.appendChild(script)
                injected.push(script)
            } else {
                const el = node.cloneNode(true) as HTMLElement
                document.head.appendChild(el)
                injected.push(el)
            }
        })

        return () => {
            injected.forEach(el => el.parentNode?.removeChild(el))
        }
    }, [customPixels, customUtms])

    if (fetchError) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-gray-400 text-sm mb-4">Não foi possível carregar o checkout.</p>
                    <button
                        onClick={() => { setFetchError(false); setLoading(true) }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
                <div className="w-full max-w-md space-y-4 animate-pulse">
                    {/* Banner skeleton */}
                    <div className="h-40 bg-[#1a1f2e] rounded-xl" />
                    {/* Product info */}
                    <div className="space-y-2">
                        <div className="h-6 bg-[#1a1f2e] rounded w-3/4" />
                        <div className="h-4 bg-[#1a1f2e] rounded w-1/2" />
                    </div>
                    {/* Form fields */}
                    <div className="space-y-3">
                        <div className="h-12 bg-[#1a1f2e] rounded-lg" />
                        <div className="h-12 bg-[#1a1f2e] rounded-lg" />
                        <div className="h-12 bg-[#1a1f2e] rounded-lg" />
                    </div>
                    {/* Card fields */}
                    <div className="space-y-3">
                        <div className="h-12 bg-[#1a1f2e] rounded-lg" />
                        <div className="flex gap-3">
                            <div className="h-12 bg-[#1a1f2e] rounded-lg flex-1" />
                            <div className="h-12 bg-[#1a1f2e] rounded-lg flex-1" />
                        </div>
                    </div>
                    {/* Button */}
                    <div className="h-14 bg-[#1a1f2e] rounded-xl" />
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

    const handleProcessPayment = async (paymentData: { formData: { name: string; email: string; phone: string; paymentMethod?: string }, selectedOrderBumps: any[], totalAmount: number, installments?: number }) => {
        try {
            const paymentMethod = (paymentData.formData as any).paymentMethod || 'credit_card'

            // ── Mollie redirect flow ──────────────────────────────────────────────
            if (paymentMethod.startsWith('mollie_')) {
                const mollieMethod = paymentMethod.replace('mollie_', '')
                const response = await fetch('https://api.clicknich.com/api/process-mollie-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: product!.id,
                        productType: product!.productType,
                        applicationId: product!.applicationId,
                        checkoutId: checkout!.id,
                        customerEmail: paymentData.formData.email,
                        customerName: paymentData.formData.name,
                        customerPhone: paymentData.formData.phone,
                        mollieMethod,
                        totalAmount: paymentData.totalAmount,
                        selectedOrderBumps: paymentData.selectedOrderBumps,
                        sessionId: checkoutSessionId || undefined,
                        trackingParameters: utmParams.current,
                    }),
                })
                const result = await response.json()
                if (result.checkoutUrl) {
                    window.location.href = result.checkoutUrl
                    return { success: false } // página vai redirecionar
                }
                if (!result.success) throw new Error(result.error || 'Mollie payment failed')
                return { success: true, purchaseId: result.purchaseId, thankyouToken: result.thankyouToken, redirectUrl: result.redirectUrl }
            }

            // ── Stripe / PayPal flow ─────────────────────────────────────────────
            const paymentProvider = paymentMethod === 'paypal' ? 'paypal' : 'stripe'

            const response = await fetch('https://api.clicknich.com/api/process-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productId: product!.id,
                    productType: product!.productType,
                    applicationId: product!.applicationId,
                    checkoutId: checkout!.id,
                    customerEmail: paymentData.formData.email,
                    customerName: paymentData.formData.name,
                    customerPhone: paymentData.formData.phone,
                    paymentProvider,
                    selectedOrderBumps: paymentData.selectedOrderBumps,
                    totalAmount: paymentData.totalAmount,
                    installments: paymentData.installments ?? 1,
                    sessionId: checkoutSessionId || undefined,
                    trackingParameters: utmParams.current,
                }),
            })

            const result = await response.json()

            // Checar redirecionamento PayPal ANTES do check de success
            if (result.requiresApproval && result.approvalUrl) {
                window.location.href = result.approvalUrl
                return { success: false }
            }

            if (!result.success) {
                throw new Error(result.error || 'Payment failed')
            }

            // Store result for redirect — used directly in onPaymentSuccess
            if (result.purchaseId && result.thankyouToken) {
                paymentResultRef.current = {
                    purchaseId: result.purchaseId,
                    thankyouToken: result.thankyouToken,
                    redirectUrl: result.redirectUrl || undefined
                }
            }

            return {
                success: true,
                purchaseId: result.purchaseId,
                thankyouToken: result.thankyouToken,
                redirectUrl: result.redirectUrl
            }
        } catch (error: any) {
            throw new Error(error.message || 'Payment processing failed')
        }
    }

    return (
        // Suspense necessário pelo lazy(). Na prática o bundle já foi baixado
        // durante o loading dos dados, então este fallback raramente aparece.
        <Suspense fallback={null}>
            <CheckoutDigital
                productId={product.id}
                productName={product.name}
                productPrice={checkout.custom_price || product.price}
                productImage={product.image_url}
                productDescription={product.description}
                selectedPaymentMethods={(() => {
                    if (product.dynamic_checkout && mollieEnabledMethods.length > 0) {
                        // Modo dinâmico: credit_card sempre + top 2 métodos Mollie do país
                        const top2 = mollieEnabledMethods.slice(0, 2).map(m => `mollie_${m.id}`)
                        return ['credit_card', ...top2]
                    }
                    return product.payment_methods || ['credit_card']
                })()}
                defaultPaymentMethod={product.default_payment_method || 'credit_card'}
                productType={product.productType}
                applicationId={product.applicationId}
                checkoutId={checkout.id}
                sessionId={checkoutSessionId || undefined}
                trackingParameters={utmParams.current}
                language={checkout.language}
                initialOrderBumps={initialOrderBumps}
                initialAppProducts={initialAppProducts}
                customBanner={{
                    image: checkout.banner_image,
                    title: checkout.banner_title,
                    customHeight: checkout.custom_height,
                    customWidth: checkout.custom_width
                }}
                timerConfig={timerConfig}
                isPreview={false}
                buttonColor={buttonColor}
                buttonText={buttonText || undefined}
                securitySealsEnabled={securitySealsEnabled}
                testimonials={testimonials}
                testimonialsCarouselMode={testimonialsCarouselMode}
                testimonialsHorizontalMode={testimonialsHorizontalMode}
                imageBlocks={imageBlocks}
                onProcessPayment={handleProcessPayment}
                mollieEnabledMethods={(() => {
                    if (product.dynamic_checkout) {
                        // Modo dinâmico: passar todos os métodos geo-filtrados sem restrição adicional
                        return mollieEnabledMethods.length > 0 ? mollieEnabledMethods : undefined
                    }
                    // Modo manual: filtrar pelos métodos que o owner selecionou
                    const selected = product.payment_methods || []
                    const mollieSelected = selected
                        .filter(m => m.startsWith('mollie_'))
                        .map(m => m.slice(7))
                    if (mollieSelected.length === 0 || mollieEnabledMethods.length === 0) return mollieEnabledMethods.length > 0 ? mollieEnabledMethods : undefined
                    const filtered = mollieEnabledMethods.filter(m => mollieSelected.includes(m.id))
                    return filtered.length > 0 ? filtered : mollieEnabledMethods
                })()}
                stripePublishableKey={stripePublishableKey}
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
                    if (!result) return

                    const urlParams = new URLSearchParams(window.location.search)
                    const postPurchaseRedirect = urlParams.get('redirect')

                    // Redirect explícito via query param
                    if (postPurchaseRedirect) {
                        setTimeout(() => { window.location.href = postPurchaseRedirect }, 150)
                        return
                    }

                    // Usar config pré-carregada enquanto o usuário preenchia o formulário
                    if (preloadedRedirect?.url) {
                        const baseUrl = preloadedRedirect.url
                        const finalUrl = baseUrl.includes('?')
                            ? `${baseUrl}&purchase_id=${result.purchaseId}&token=${result.thankyouToken}`
                            : `${baseUrl}?purchase_id=${result.purchaseId}&token=${result.thankyouToken}`
                        setTimeout(() => { window.location.href = finalUrl }, 150)
                        return
                    }

                    // Usar redirectUrl do backend (upsell ou login)
                    if (result.redirectUrl) {
                        const url = result.redirectUrl
                        setTimeout(() => { window.location.href = url }, 150)
                        return
                    }

                }}
            />
        </Suspense>
    )
}