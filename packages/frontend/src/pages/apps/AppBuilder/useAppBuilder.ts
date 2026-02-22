import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import type { AppData } from './types'

const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1'
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

export function useAppBuilder() {
    const navigate = useNavigate()
    const { appId } = useParams()
    const location = useLocation()
    const { user } = useAuthStore()

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'general' | 'checkout' | 'products' | 'feed' | 'community' | 'notifications'>('general')
    const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<('credit_card' | 'paypal')[]>(['credit_card'])
    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'credit_card' | 'paypal'>('credit_card')

    const wizardState = location.state as {
        name?: string
        description?: string
        category?: string
        sales_page_url?: string
        support_email?: string
        support_whatsapp?: string
    } | null

    const [appData, setAppData] = useState<AppData>({
        name: wizardState?.name || '',
        slug: '',
        showNames: true,
        highlightCommunity: false,
        freeRegistration: false,
        supportEnabled: !!(wizardState?.support_email || wizardState?.support_whatsapp),
        appType: 'login-complete',
        language: 'en',
        theme: 'light',
        logo: null,
        banners: [],
        extraBannerLinks: ['', ''],
        supportIcon: null,
        supportEmail: wizardState?.support_email || '',
        whatsappNumber: wizardState?.support_whatsapp || '',
        primaryColor: '#6366f1',
        secondaryColor: '#ec4899',
        price: 0,
        currency: 'BRL',
    })

    useEffect(() => {
        if (appId) {
            loadAppData()
        }
    }, [appId])

    const loadAppData = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${SUPABASE_URL}/applications/${appId}`, {
                headers: {
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-user-id': user?.id || 'user-default',
                },
            })

            if (response.ok) {
                const data = await response.json()


                setAppData({
                    name: data.name || '',
                    slug: data.slug || '',
                    showNames: data.show_names ?? true,
                    highlightCommunity: data.highlight_community ?? false,
                    freeRegistration: data.free_registration ?? false,
                    supportEnabled: data.support_enabled ?? false,
                    appType: data.app_type || 'login-complete',
                    language: data.language || 'en',
                    theme: data.theme || 'light',
                    logo: data.logo_url || null,
                    banners: (data.app_banners || []).map((banner: any) => ({
                        id: banner.id || Date.now(),
                        image: banner.image_url || null,
                        link: banner.link_url || '',
                    })),
                    extraBannerLinks: data.extra_banner_links || ['', ''],
                    supportIcon: data.support_icon_url || null,
                    supportEmail: data.support_email || '',
                    whatsappNumber: data.whatsapp_number || '',
                    primaryColor: data.primary_color || '#6366f1',
                    secondaryColor: data.secondary_color || '#ec4899',
                    review_status: data.review_status,
                    price: 0,
                    currency: 'BRL',
                })

                const { data: defaultCheckout } = await supabase
                    .from('checkouts')
                    .select('custom_price')
                    .eq('application_id', appId)
                    .eq('is_default', true)
                    .single()

                if (defaultCheckout?.custom_price) {
                    setAppData(prev => ({ ...prev, price: defaultCheckout.custom_price }))
                }
            }
        } catch (error) {
            console.error('Erro ao carregar dados do app:', error)
        } finally {
            setLoading(false)
        }
    }

    const addBanner = () => {
        if (appData.banners.length < 3) {
            setAppData(prev => ({
                ...prev,
                banners: [...prev.banners, { id: Date.now(), link: '', image: null }],
            }))
        }
    }

    const removeBanner = (id: number) => {
        setAppData(prev => ({
            ...prev,
            banners: prev.banners.filter(banner => banner.id !== id),
        }))
    }

    const updateBanner = (id: number, field: 'link' | 'image', value: string) => {
        setAppData(prev => ({
            ...prev,
            banners: prev.banners.map(banner => (banner.id === id ? { ...banner, [field]: value } : banner)),
        }))
    }

    const togglePaymentMethod = (method: 'credit_card' | 'paypal') => {
        setSelectedPaymentMethods(prev => {
            if (prev.includes(method)) {
                if (prev.length === 1) return prev
                if (defaultPaymentMethod === method) {
                    const remaining = prev.filter(m => m !== method)
                    setDefaultPaymentMethod(remaining[0])
                }
                return prev.filter(m => m !== method)
            } else {
                return [...prev, method]
            }
        })
    }

    const handleSaveApp = async () => {
        try {
            setLoading(true)

            const url = appId ? `${SUPABASE_URL}/applications/${appId}` : `${SUPABASE_URL}/applications`
            const method = appId ? 'PUT' : 'POST'

            const requestBody = {
                name: appData.name,
                slug: appData.slug || appData.name.toLowerCase().replace(/\s+/g, '-'),
                logo_url: appData.logo,
                show_names: appData.showNames,
                highlight_community: appData.highlightCommunity,
                free_registration: appData.freeRegistration,
                support_enabled: appData.supportEnabled,
                app_type: appData.appType,
                language: appData.language,
                theme: appData.theme,
                support_icon_url: appData.supportIcon,
                support_email: appData.supportEmail,
                whatsapp_number: appData.whatsappNumber,
                extra_banner_links: appData.extraBannerLinks,
                primary_color: appData.primaryColor,
                secondary_color: appData.secondaryColor,
                banners: appData.banners,
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-user-id': user?.id || 'user-default',
                },
                body: JSON.stringify(requestBody),
            })

            if (response.ok) {
                const result = await response.json()
                const savedAppId = appId || result.id

                if (appData.price > 0) {
                    const { data: existing } = await supabase
                        .from('checkouts')
                        .select('id')
                        .eq('application_id', savedAppId)
                        .eq('is_default', true)
                        .single()

                    if (existing) {
                        await supabase.from('checkouts').update({ custom_price: appData.price }).eq('id', existing.id)
                    } else {
                        await supabase.from('checkouts').insert({
                            application_id: savedAppId,
                            name: 'Default',
                            is_default: true,
                            custom_price: appData.price,
                            banner_title: appData.name,
                        })
                    }
                }

                alert(appId ? 'App updated successfully!' : 'App created successfully!')

                if (!appId) {
                    navigate(`/app-builder/${result.id}`)
                }
            } else {
                const errorData = await response.text()
                console.error('❌ [AppBuilder] Error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorData,
                })

                let errorMessage: string
                try {
                    const errorObj = JSON.parse(errorData)
                    errorMessage = errorObj.error || errorObj.message || 'Unknown error'
                } catch {
                    errorMessage = errorData || 'Unknown error'
                }

                alert(`${appId ? 'Error updating' : 'Error creating'} app: ${errorMessage}`)
            }
        } catch (error) {
            console.error('💥 [AppBuilder] Exception caught:', error)
            alert(`Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    return {
        appId,
        appData,
        setAppData,
        loading,
        activeTab,
        setActiveTab,
        selectedPaymentMethods,
        defaultPaymentMethod,
        setDefaultPaymentMethod,
        addBanner,
        removeBanner,
        updateBanner,
        togglePaymentMethod,
        handleSaveApp,
    }
}
