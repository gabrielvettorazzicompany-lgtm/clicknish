import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, supabaseFetch } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { App, MarketplaceProduct, Product, Customer, CombinedItem, CustomerFormData } from '@/types/customers'
import { useDebounce } from './useDebounce'

export type { App, MarketplaceProduct, Product, Customer, CombinedItem, CustomerFormData }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Retorna o Bearer token da sessão atual (ou volta para anon key) */
async function getAuthToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || SUPABASE_ANON_KEY
}

export const ALL_ITEMS_ID = '__all__'

export function useCustomers() {
    const { user } = useAuthStore()
    const currentUserId = user?.id || ''

    const [customers, setCustomers] = useState<Customer[]>([])
    const [apps, setApps] = useState<App[]>([])
    const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [reloading, setReloading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedApp, setSelectedApp] = useState<string>(ALL_ITEMS_ID)
    const [selectedMarketplace, setSelectedMarketplace] = useState<string>('')
    const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([])
    const [showModal, setShowModal] = useState(false)
    const [showAccessModal, setShowAccessModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
    const [customerProducts, setCustomerProducts] = useState<Record<string, boolean>>({})
    const [formData, setFormData] = useState<CustomerFormData>({
        name: '', email: '', phone: '', selectedProducts: []
    })

    // Reagir ao user.id: quando o usuário autentica, buscar apps e produtos
    useEffect(() => {
        if (!currentUserId) {
            setLoading(false)
            return
        }
        fetchApps()
        fetchMarketplaceProducts()
    }, [currentUserId])

    useEffect(() => {
        const combined: CombinedItem[] = [
            ...apps.map(app => ({ id: app.id, name: app.name, type: 'app' as const })),
            ...marketplaceProducts.map(p => ({ id: p.id, name: p.name, type: 'marketplace' as const }))
        ]
        setCombinedItems(combined)
        // Quando os dados carregam e o filtro é "Todos", buscar todos automaticamente
        if (selectedApp === ALL_ITEMS_ID && combined.length > 0) {
            fetchAllCustomers()
        }
    }, [apps, marketplaceProducts])

    useEffect(() => {
        if (selectedApp === ALL_ITEMS_ID) {
            if (apps.length > 0 || marketplaceProducts.length > 0) {
                fetchAllCustomers()
            }
            setProducts([])
        } else if (selectedApp) {
            fetchCustomers(selectedApp, 'app')
            fetchProducts(selectedApp)
        } else if (selectedMarketplace) {
            fetchCustomers(selectedMarketplace, 'marketplace')
            setProducts([])
        } else {
            setCustomers([])
            setProducts([])
        }
    }, [selectedApp, selectedMarketplace])

    // Debounce da busca para evitar filtros excessivos
    const debouncedSearchTerm = useDebounce(searchTerm, 300)

    // Memoização dos filtros para otimizar performance
    const filteredCustomers = useMemo(() => {
        let filtered = customers

        if (debouncedSearchTerm) {
            const s = debouncedSearchTerm.toLowerCase()
            filtered = filtered.filter(c =>
                c.email.toLowerCase().includes(s) ||
                c.full_name?.toLowerCase().includes(s) ||
                c.phone?.toLowerCase().includes(s)
            )
        }

        if (selectedDate) {
            filtered = filtered.filter(c => {
                if (!c.created_at) return false
                const d = new Date(c.created_at)
                return d.getFullYear() === selectedDate.getFullYear() &&
                    d.getMonth() === selectedDate.getMonth() &&
                    d.getDate() === selectedDate.getDate()
            })
        }

        return filtered
    }, [customers, debouncedSearchTerm, selectedDate])

    const getCurrentUserId = async (): Promise<string | null> => {
        return currentUserId || null
    }

    const fetchAllCustomers = async () => {
        try {
            setLoading(true)
            setError(null)
            const token = await getAuthToken()

            const allResults: Customer[] = []

            // Buscar de todos os apps
            for (const app of apps) {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/app_users?application_id=eq.${app.id}&select=id,user_id,email,application_id,full_name,phone,status,last_login,created_at&order=created_at.desc`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    allResults.push(...data.map((c: Customer) => ({
                        id: c.id, user_id: c.user_id, email: c.email || 'Email not available',
                        application_id: c.application_id, full_name: c.full_name, phone: c.phone,
                        status: c.status, last_login: c.last_login, created_at: c.created_at
                    })))
                }
            }

            // Buscar de todos os marketplaces
            for (const mp of marketplaceProducts) {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/member_profiles?product_id=eq.${mp.id}&select=id,email,name,phone,created_at,last_login_at&order=created_at.desc`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    allResults.push(...data.map((m: any) => ({
                        id: m.id, user_id: m.id, email: m.email || 'Email not available',
                        application_id: mp.id, full_name: m.name, phone: m.phone,
                        status: 'active', last_login: m.last_login_at, created_at: m.created_at
                    })))
                }
            }

            // Deduplicar por email
            const seen = new Set<string>()
            setCustomers(allResults.filter(c => {
                if (seen.has(c.email)) return false
                seen.add(c.email)
                return true
            }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        } catch {
            setCustomers([])
            setError('Erro ao carregar todos os clientes')
        } finally { setLoading(false) }
    }

    const fetchApps = async () => {
        if (!currentUserId) { setLoading(false); return }
        try {
            setLoading(true)
            setError(null)
            const token = await getAuthToken()
            const res = await fetch(`https://api.clicknich.com/api/applications`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': SUPABASE_ANON_KEY,
                    'x-user-id': currentUserId
                }
            })
            const data = await res.json()
            if (Array.isArray(data)) {
                setApps(data)
            } else {
                setApps([])
                if (data?.error) setError(`Erro ao carregar apps: ${data.error}`)
            }
        } catch (e: any) {
            setApps([])
            setError('Erro de conexão ao carregar apps')
        } finally { setLoading(false) }
    }

    const fetchMarketplaceProducts = async () => {
        if (!currentUserId) { setMarketplaceProducts([]); return }
        try {
            const token = await getAuthToken()
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/marketplace_products?owner_id=eq.${currentUserId}&select=id,name,price,owner_id,slug`,
                { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            if (!res.ok) { setMarketplaceProducts([]); return }
            const data = await res.json()
            setMarketplaceProducts(Array.isArray(data) ? data : [])
        } catch { setMarketplaceProducts([]) }
    }

    const fetchProducts = async (appId: string): Promise<Product[]> => {
        try {
            const token = await getAuthToken()
            const appRes = await fetch(
                `${SUPABASE_URL}/rest/v1/products?application_id=eq.${appId}&select=id,name,price`,
                { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const appData = await appRes.json()
            const combined: Product[] = Array.isArray(appData) ? appData : []
            setProducts(combined)
            return combined
        } catch { setProducts([]); return [] }
    }

    const fetchCustomers = async (id: string, type?: 'app' | 'marketplace') => {
        try {
            setLoading(true)
            setError(null)
            const token = await getAuthToken()
            const fetchType = type || (selectedMarketplace && !selectedApp ? 'marketplace' : 'app')
            if (fetchType === 'app') {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/app_users?application_id=eq.${id}&select=id,user_id,email,application_id,full_name,phone,status,last_login,created_at&order=created_at.desc`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((c: Customer) => ({
                        id: c.id, user_id: c.user_id, email: c.email || 'Email not available',
                        application_id: c.application_id, full_name: c.full_name, phone: c.phone,
                        status: c.status, last_login: c.last_login, created_at: c.created_at
                    }))
                    setCustomers(mapped)
                } else {
                    setCustomers([])
                    if (data?.message) setError(`Erro ao carregar customers: ${data.message}`)
                }
            } else {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/member_profiles?product_id=eq.${id}&select=id,email,name,phone,created_at,last_login_at&order=created_at.desc`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((m: any) => ({
                        id: m.id, user_id: m.id, email: m.email || 'Email not available',
                        application_id: id, full_name: m.name, phone: m.phone,
                        status: 'active', last_login: m.last_login_at, created_at: m.created_at
                    }))
                    setCustomers(mapped)
                } else {
                    setCustomers([])
                    if (data?.message) setError(`Erro ao carregar membros: ${data.message}`)
                }
            }
        } catch (e: any) {
            setCustomers([])
            setError('Erro de conexão ao carregar customers')
        }
        finally { setLoading(false) }
    }

    const fetchCustomerAccess = async (customer: Customer, productsList: Product[]) => {
        try {
            const { data: session } = await supabase.auth.getSession()
            const token = session?.session?.access_token || SUPABASE_ANON_KEY

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${customer.user_id}&application_id=eq.${selectedApp}&select=product_id`,
                { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const data = await res.json()
            const accessIds = new Set<string>()
            if (Array.isArray(data)) data.forEach((a: any) => accessIds.add(a.product_id))

            const access: Record<string, boolean> = {}
            productsList.forEach(p => { access[p.id] = accessIds.has(p.id) })
            setCustomerProducts(access)
        } catch (err) {
            console.error('Error fetching customer access:', err)
        }
    }

    const handleSelectAll = (checked: boolean) =>
        setSelectedCustomers(checked ? filteredCustomers.map(c => c.id) : [])

    const handleSelectCustomer = (id: string, checked: boolean) =>
        setSelectedCustomers(prev => checked ? [...prev, id] : prev.filter(cId => cId !== id))

    const toggleProductSelection = (productId: string) =>
        setFormData(prev => ({
            ...prev,
            selectedProducts: prev.selectedProducts.includes(productId)
                ? prev.selectedProducts.filter(id => id !== productId)
                : [...prev.selectedProducts, productId]
        }))

    const toggleProductAccess = (productId: string) =>
        setCustomerProducts(prev => ({ ...prev, [productId]: !prev[productId] }))

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedApp && !selectedMarketplace) { alert('Please select an app or membership area first'); return }
        if (!formData.email) { alert('Please fill in the email'); return }
        setSaving(true)
        try {
            if (selectedMarketplace && !selectedApp) {
                const checkRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/member_profiles?email=eq.${formData.email}&product_id=eq.${selectedMarketplace}&select=id,email`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const existing = await checkRes.json()
                if (existing?.length > 0) {
                    alert('This member already exists in this membership area')
                    setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] }); return
                }
                const res = await fetch(`https://api.clicknich.com/api/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ email: formData.email, marketplaceProductId: selectedMarketplace, name: formData.name, phone: formData.phone })
                })
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error creating member') }
                alert('Member added successfully!')
                setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] })
                fetchCustomers(selectedMarketplace); return
            }

            const { data: sessionData } = await supabase.auth.getSession()
            const adminToken = sessionData?.session?.access_token || SUPABASE_ANON_KEY

            const checkRes = await fetch(
                `${SUPABASE_URL}/rest/v1/app_users?email=eq.${formData.email}&application_id=eq.${selectedApp}&select=id,user_id`,
                { headers: { 'Authorization': `Bearer ${adminToken}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const existingUsers = await checkRes.json()
            if (existingUsers?.length > 0) {
                const existingUser = existingUsers[0]
                if (formData.selectedProducts.length > 0) {
                    const currentRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${existingUser.user_id}&application_id=eq.${selectedApp}&select=product_id`,
                        { headers: { 'Authorization': `Bearer ${adminToken}`, 'apikey': SUPABASE_ANON_KEY } }
                    )
                    const currRaw = await currentRes.json()
                    const curr = Array.isArray(currRaw) ? currRaw : []
                    const currIds = curr.map((a: any) => a.product_id)
                    const newProds = formData.selectedProducts.filter(id => !currIds.includes(id))
                    if (newProds.length > 0) {
                        await fetch(`${SUPABASE_URL}/rest/v1/user_product_access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'apikey': SUPABASE_ANON_KEY },
                            body: JSON.stringify(newProds.map(productId => ({ user_id: existingUser.user_id, product_id: productId, application_id: selectedApp, access_type: 'manual', is_active: true })))
                        })
                        alert(`Access granted! ${newProds.length} new product(s) added to ${formData.email}`)
                    } else { alert('This customer already has access to all selected products') }
                } else { alert('Customer already exists. Select products to grant access.') }
                setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] })
                fetchCustomers(selectedApp); return
            }

            const res = await fetch(`https://api.clicknich.com/api/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ email: formData.email, applicationId: selectedApp, productIds: formData.selectedProducts, name: formData.name, phone: formData.phone })
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error creating customer') }
            alert('Customer added successfully!')
            setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] })
            fetchCustomers(selectedApp, 'app')
        } catch (error) { alert(`Error adding customer: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleManageAccess = async (customer: Customer) => {
        setEditingCustomer(customer)
        const loadedProducts = await fetchProducts(selectedApp)
        await fetchCustomerAccess(customer, loadedProducts)
        setShowAccessModal(true)
    }

    const handleSaveAccess = async () => {
        if (!editingCustomer) return
        setSaving(true)
        try {
            const { data: session } = await supabase.auth.getSession()
            const token = session?.session?.access_token || SUPABASE_ANON_KEY
            const newIds = Object.keys(customerProducts).filter(id => customerProducts[id])

            // Buscar acessos atuais
            const res = await fetch(`${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${editingCustomer.user_id}&application_id=eq.${selectedApp}&select=id,product_id`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
            })
            const currRaw = await res.json()
            const curr = Array.isArray(currRaw) ? currRaw : []

            // Remover acessos desmarcados
            const toRemove = curr.filter((a: any) => !newIds.includes(a.product_id))
            for (const a of toRemove) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access?id=eq.${a.id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
                })
            }

            // Adicionar novos acessos
            const currIds = curr.map((a: any) => a.product_id)
            const toAdd = newIds.filter(id => !currIds.includes(id))
            if (toAdd.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY },
                    body: JSON.stringify(toAdd.map(id => ({
                        user_id: editingCustomer.user_id,
                        product_id: id,
                        application_id: selectedApp,
                        access_type: 'manual',
                        is_active: true
                    })))
                })
            }

            alert('Access updated successfully!')
            setShowAccessModal(false); setEditingCustomer(null); fetchCustomers(selectedApp)
        } catch (error) { alert(`Error saving access: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleEditCustomer = (customer: Customer) => {
        setEditingCustomer(customer)
        setFormData({ name: customer.full_name || '', email: customer.email || '', phone: customer.phone || '', selectedProducts: [] })
        setShowEditModal(true)
    }

    const handleSaveCustomerEdit = async () => {
        if (!editingCustomer || !formData.email) { alert('Email is required'); return }
        setSaving(true)
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/app_users?id=eq.${editingCustomer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({ full_name: formData.name, email: formData.email, phone: formData.phone })
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Error updating customer') }
            alert('Customer updated successfully!')
            setShowEditModal(false); setEditingCustomer(null); fetchCustomers(selectedApp)
        } catch (error) { alert(`Error updating customer: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleSendEmail = async (customer: Customer) => {
        if (!customer.email) { alert('Customer email not found'); return }
        setSaving(true)
        try {
            let appName = '', appSlug = '', appLanguage = '', marketplaceName = '', downloadLink = '', loginUrl = '', supportEmail = ''
            const customerProductsList: string[] = []

            if (selectedApp && !selectedMarketplace) {
                const app = apps.find(a => a.id === selectedApp)
                if (app) {
                    appName = app.name; appSlug = app.slug || ''; appLanguage = app.language || 'en'
                    loginUrl = `${window.location.origin}/access/${app.slug}`
                    const { data: sess } = await supabase.auth.getSession()
                    const tkn = sess?.session?.access_token || SUPABASE_ANON_KEY
                    try {
                        const accessRes = await fetch(
                            `${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${customer.user_id}&application_id=eq.${selectedApp}&select=product_id`,
                            { headers: { 'Authorization': `Bearer ${tkn}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        if (accessRes.ok) {
                            const accessDataRaw = await accessRes.json()
                            const accessData = Array.isArray(accessDataRaw) ? accessDataRaw : []
                            const ids = accessData.map((a: any) => a.product_id)
                            if (ids.length > 0) {
                                const pr = await fetch(
                                    `${SUPABASE_URL}/rest/v1/products?id=in.(${ids.join(',')})&select=name`,
                                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                                )
                                if (pr.ok) { const pd = await pr.json(); pd.forEach((p: any) => customerProductsList.push(`• ${p.name}`)) }
                            }
                        }
                    } catch { /* ignore */ }
                    try {
                        const ar = await fetch(
                            `${SUPABASE_URL}/rest/v1/applications?id=eq.${selectedApp}&select=android_url,ios_url,support_email`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        if (ar.ok) { const d = await ar.json(); if (d?.[0]) { downloadLink = d[0].android_url || d[0].ios_url || ''; supportEmail = d[0].support_email || '' } }
                    } catch { /* ignore */ }
                }
            } else {
                const product = marketplaceProducts.find(p => p.id === selectedMarketplace)
                if (product) {
                    marketplaceName = product.name; loginUrl = `${window.location.origin}/members-login/${product.slug}`
                    try {
                        const mr = await fetch(
                            `${SUPABASE_URL}/rest/v1/marketplace_products?id=eq.${product.id}&select=support_email`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        if (mr.ok) { const md = await mr.json(); if (md?.[0]) supportEmail = md[0].support_email || '' }
                    } catch { /* ignore */ }
                }
            }

            const productName = appName || marketplaceName || 'Platform'
            const productsHtml = customerProductsList.length > 0
                ? `<ul style="list-style:none;padding:0;margin:0">${customerProductsList.map(p => `<li style="padding:4px 0;color:#666">${p}</li>`).join('')}</ul>`
                : ''

            // Traduções por idioma do app
            type EmailLang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'nl'
            const emailI18n: Record<EmailLang, { title: string; greeting: string; body: string; button: string; instructions: string; step1: string; step3: string; subject: string; producerSupportTitle: string; producerSupportLabel: string; supportTitle: string; supportBody: string; supportLabel: string; supportNote: string; guaranteeTitle: string; guaranteeBody: string }> = {
                pt: { title: 'Acesso Liberado', greeting: 'Olá', body: 'Ótimo! Você agora tem acesso a:', button: appSlug ? 'Acessar App' : 'Acessar Área de Membros', instructions: 'Instruções de acesso:', step1: 'Clique no botão acima', step3: 'Se for primeiro acesso, crie sua senha', subject: `Seu acesso a ${productName} está pronto`, producerSupportTitle: 'Dúvidas sobre o conteúdo?', producerSupportLabel: 'Entre em contato diretamente com o produtor:', supportTitle: 'Precisa de ajuda?', supportBody: 'Se tiver qualquer problema para acessar ou usar o produto, nossa equipe de suporte está disponível para ajudar.', supportLabel: 'Suporte:', supportNote: 'Antes de contatar o seu banco, por favor escreva para o nosso suporte para que possamos resolver qualquer problema rapidamente.', guaranteeTitle: 'Garantia de satisfação', guaranteeBody: 'Se o produto não cumprir com suas expectativas, você pode solicitar assistência ou um reembolso dentro do período de garantia. Nossa equipe estará encantada em ajudar.' },
                en: { title: 'Access Granted', greeting: 'Hi', body: 'Great news! You now have access to:', button: appSlug ? 'Access App Login' : 'Access Members Area', instructions: 'Access instructions:', step1: 'Click the button above', step3: 'If first access, create your password', subject: `Your access to ${productName} is ready`, producerSupportTitle: 'Questions about the content?', producerSupportLabel: 'Contact the producer directly:', supportTitle: 'Need help?', supportBody: 'If you have any trouble accessing or using the product, our support team is available to help.', supportLabel: 'Support:', supportNote: 'Before contacting your bank, please write to our support team so we can resolve any issue quickly.', guaranteeTitle: 'Satisfaction guarantee', guaranteeBody: 'If the product does not meet your expectations, you can request assistance or a refund within the guarantee period. Our team will be happy to help.' },
                es: { title: 'Acceso Concedido', greeting: 'Hola', body: '¡Buenas noticias! Ahora tienes acceso a:', button: appSlug ? 'Acceder al App' : 'Acceder al Área', instructions: 'Instrucciones de acceso:', step1: 'Haz clic en el botón de arriba', step3: 'Si es tu primer acceso, crea tu contraseña', subject: `Tu acceso a ${productName} está listo`, producerSupportTitle: '¿Preguntas sobre el contenido?', producerSupportLabel: 'Contacta directamente con el productor:', supportTitle: '¿Necesitas ayuda?', supportBody: 'Si tienes algún problema para acceder o usar el producto, nuestro equipo de soporte está disponible para ayudarte.', supportLabel: 'Soporte:', supportNote: 'Antes de contactar a tu banco, por favor escríbenos para que podamos resolver cualquier problema rápidamente.', guaranteeTitle: 'Garantía de satisfacción', guaranteeBody: 'Si el producto no cumple tus expectativas, puedes solicitar asistencia o un reembolso dentro del período de garantía. Nuestro equipo estará encantado de ayudarte.' },
                fr: { title: 'Accès accordé', greeting: 'Bonjour', body: 'Bonne nouvelle ! Vous avez maintenant accès à :', button: appSlug ? "Accéder à l'App" : "Accéder à l'Espace", instructions: "Instructions d'accès :", step1: 'Cliquez sur le bouton ci-dessus', step3: "Si c'est votre premier accès, créez votre mot de passe", subject: `Votre accès à ${productName} est prêt`, producerSupportTitle: 'Des questions sur le contenu ?', producerSupportLabel: 'Contactez directement le producteur :', supportTitle: "Besoin d'aide ?", supportBody: "Si vous avez des difficultés à accéder au produit ou à l'utiliser, notre équipe d'assistance est disponible.", supportLabel: 'Support :', supportNote: 'Avant de contacter votre banque, veuillez nous écrire afin que nous puissions résoudre tout problème rapidement.', guaranteeTitle: 'Garantie de satisfaction', guaranteeBody: 'Si le produit ne répond pas à vos attentes, vous pouvez demander une assistance ou un remboursement dans le délai de garantie.' },
                de: { title: 'Zugang gewährt', greeting: 'Hallo', body: 'Gute Neuigkeiten! Sie haben jetzt Zugang zu:', button: appSlug ? 'App-Zugang' : 'Mitgliederbereich', instructions: 'Zugangsinstruktionen:', step1: 'Klicken Sie auf den Button oben', step3: 'Wenn erster Zugang, erstellen Sie Ihr Passwort', subject: `Ihr Zugang zu ${productName} ist bereit`, producerSupportTitle: 'Fragen zum Inhalt?', producerSupportLabel: 'Wenden Sie sich direkt an den Anbieter:', supportTitle: 'Brauchen Sie Hilfe?', supportBody: 'Bei Problemen mit dem Zugang oder der Nutzung des Produkts steht Ihnen unser Support-Team zur Verfügung.', supportLabel: 'Support:', supportNote: 'Bitte schreiben Sie uns, bevor Sie Ihre Bank kontaktieren, damit wir das Problem schnell lösen können.', guaranteeTitle: 'Zufriedenheitsgarantie', guaranteeBody: 'Wenn das Produkt Ihre Erwartungen nicht erfüllt, können Sie innerhalb der Garantiezeit Unterstützung oder eine Rückerstattung beantragen.' },
                nl: { title: 'Toegang verleend', greeting: 'Hallo', body: 'Goed nieuws! U heeft nu toegang tot:', button: appSlug ? 'App-toegang' : 'Ledengebied', instructions: 'Toegangsinstructies:', step1: 'Klik op de knop hierboven', step3: 'Als dit uw eerste toegang is, maak dan uw wachtwoord aan', subject: `Uw toegang tot ${productName} is klaar`, producerSupportTitle: 'Vragen over de inhoud?', producerSupportLabel: 'Neem direct contact op met de producent:', supportTitle: 'Hulp nodig?', supportBody: 'Als u problemen heeft met het openen of gebruiken van het product, staat ons supportteam voor u klaar.', supportLabel: 'Support:', supportNote: 'Neem contact met ons op voordat u uw bank benadert, zodat we het probleem snel kunnen oplossen.', guaranteeTitle: 'Tevredenheidsgarantie', guaranteeBody: 'Als het product niet aan uw verwachtingen voldoet, kunt u binnen de garantietermijn om hulp of terugbetaling vragen.' },
            }
            const normalizedLang = (appLanguage || 'en').toLowerCase().replace('pt-br', 'pt') as EmailLang
            const lang = emailI18n[normalizedLang] || emailI18n['en']

            const html = `<!DOCTYPE html>
<html lang="${normalizedLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lang.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:white;margin:0;font-size:28px;font-weight:bold;">${lang.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px;">
              <p style="color:#333;font-size:16px;margin:0 0 16px;">${lang.greeting} <strong>${customer.full_name || customer.email}</strong>,</p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 16px;">${lang.body}</p>
              <div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #667eea;">
                <p style="color:#333;font-size:14px;margin:0 0 10px;"><strong>${productName}</strong></p>
                ${productsHtml}
              </div>
              ${loginUrl ? `<div style="margin:30px 0;text-align:center;"><a href="${loginUrl}" style="background:#667eea;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px;">${lang.button}</a></div>${downloadLink ? `<div style="margin:15px 0;text-align:center;"><a href="${downloadLink}" style="background:white;color:#667eea;border:2px solid #667eea;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px;">Download App</a></div>` : ''}` : ''}
              ${supportEmail ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px;"><p style="color:#111827;font-size:14px;font-weight:bold;margin:0 0 8px;">${lang.producerSupportTitle}</p><p style="color:#6b7280;font-size:13px;margin:0 0 12px;">${lang.producerSupportLabel}</p><a href="mailto:${supportEmail}" style="color:#667eea;font-size:13px;font-weight:500;text-decoration:none;">${supportEmail}</a></td></tr></table>` : ''}
              <div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px;">
                <p style="color:#666;font-size:13px;margin:0;">
                  <strong>${lang.instructions}</strong><br>
                  1. ${lang.step1}<br>
                  2. Email: <strong>${customer.email}</strong><br>
                  3. ${lang.step3}${customer.phone ? `<br>4. ${customer.phone}` : ''}
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
                    <p style="color:#111827;font-size:14px;font-weight:bold;margin:0 0 8px;">${lang.supportTitle}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;line-height:1.6;">${lang.supportBody}</p>
                    <p style="color:#374151;font-size:13px;margin:0 0 12px;">${lang.supportLabel} <a href="mailto:support@clicknich.com" style="color:#667eea;text-decoration:none;font-weight:500;">support@clicknich.com</a></p>
                    <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.6;">${lang.supportNote}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
                    <p style="color:#111827;font-size:14px;font-weight:bold;margin:0 0 8px;">${lang.guaranteeTitle}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">${lang.guaranteeBody}</p>
                  </td>
                </tr>
              </table>
              <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="color:#9ca3af;font-size:11px;margin:0;">© ${new Date().getFullYear()} ClickNich. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

            const text = `${lang.greeting} ${customer.full_name || customer.email},\n\n${lang.body}\n\n${productName}\n\n${lang.instructions}\n1. ${lang.step1}\n2. Email: ${customer.email}\n3. ${lang.step3}${customer.phone ? `\n4. ${customer.phone}` : ''}\n\n${loginUrl ? `${lang.button}: ${loginUrl}\n\n` : ''}${supportEmail ? `${lang.producerSupportTitle}\n${lang.producerSupportLabel} ${supportEmail}\n\n` : ''}${lang.supportTitle}\n${lang.supportBody}\n${lang.supportLabel} support@clicknich.com\n\n${lang.guaranteeTitle}\n${lang.guaranteeBody}\n\n© ${new Date().getFullYear()} ClickNich.`

            const res = await fetch(`https://api.clicknich.com/api/send-email`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({ to: customer.email, subject: lang.subject, html, text, customer_name: customer.full_name || customer.email })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to send email')
            alert(`✅ Access email sent successfully to ${customer.email}!`)
        } catch (error) { alert(`Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleDeleteCustomer = async () => {
        if (!customerToDelete) return
        setSaving(true)
        // Captura o ID antes de qualquer operação async
        const deletedId = customerToDelete.id
        try {
            const isMarketplace = selectedMarketplace && !selectedApp
            const table = isMarketplace ? 'member_profiles' : 'app_users'

            const res = await supabaseFetch('clients', {
                method: 'DELETE',
                body: JSON.stringify({
                    clientId: deletedId,
                    table: table,
                    deleteFromAuth: true
                })
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Error deleting customer')
            }

            // Atualiza o estado ANTES de qualquer alert bloqueante
            setShowDeleteConfirm(false)
            setCustomerToDelete(null)
            setCustomers(prev => prev.filter(c => c.id !== deletedId))
            setSelectedCustomers(prev => prev.filter(id => id !== deletedId))
        } catch (error) { alert(`Error deleting customer: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleDeleteAllSelected = async () => {
        if (selectedCustomers.length === 0) return
        if (!confirm(`Are you sure you want to delete ${selectedCustomers.length} selected customer(s)? This action cannot be undone.`)) return
        setSaving(true)
        try {
            const isMarketplace = selectedMarketplace && !selectedApp
            const table = isMarketplace ? 'member_profiles' : 'app_users'

            const results = await Promise.all(
                selectedCustomers.map(id =>
                    supabaseFetch('clients', {
                        method: 'DELETE',
                        body: JSON.stringify({
                            clientId: id,
                            table: table,
                            deleteFromAuth: true
                        })
                    })
                )
            )
            const failed = results.filter(r => !r.ok).length
            // IDs que foram deletados com sucesso
            const succeededIds = selectedCustomers.filter((_, i) => results[i].ok)
            alert(failed > 0 ? `${selectedCustomers.length - failed} deleted, ${failed} failed.` : `${selectedCustomers.length} customer(s) deleted successfully!`)
            setSelectedCustomers([])
            // Remove imediatamente do estado local
            setCustomers(prev => prev.filter(c => !succeededIds.includes(c.id)))
        } catch (error) { alert(`Error deleting customers: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleReload = async () => {
        if (selectedApp && !reloading) {
            setReloading(true); await fetchCustomers(selectedApp); setReloading(false)
        }
    }

    const handleExportCSV = () => {
        if (filteredCustomers.length === 0) { alert('No customers to export'); return }
        const headers = ['Name', 'Email', 'Phone', 'Registration Date', 'Last Access', 'Status']
        const rows = filteredCustomers.map(c => [
            c.full_name || '', c.email, c.phone || '',
            c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
            c.last_login ? new Date(c.last_login).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never',
            c.status || 'active'
        ].join(','))
        const csv = [headers.join(','), ...rows].join('\n')
        const link = document.createElement('a')
        link.setAttribute('href', URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })))
        link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link); link.click(); document.body.removeChild(link)
    }

    const handleExportPDF = () => {
        if (filteredCustomers.length === 0) { alert('No customers to export'); return }
        const win = window.open('', '', 'height=600,width=800')
        if (!win) return
        const rows = filteredCustomers.map(c => `<tr><td>${c.full_name || '-'}</td><td>${c.email}</td><td>${c.phone || '-'}</td><td>${c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td><td>${c.last_login ? new Date(c.last_login).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'}</td><td>${c.status || 'active'}</td></tr>`).join('')
        win.document.write(`<!DOCTYPE html><html><head><title>Customers Report</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#333}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:12px;text-align:left}th{background-color:#6366f1;color:white}tr:nth-child(even){background-color:#f2f2f2}</style></head><body><h1>Customers Report</h1><p>Generated on: ${new Date().toLocaleString('en-US')}</p><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Registration Date</th><th>Last Access</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
        win.document.close()
        win.focus()
        setTimeout(() => { win.print(); win.close() }, 250)
    }

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

    const formatTime = (dateString: string) =>
        new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    const selectedAppName = apps.find(a => a.id === selectedApp)?.name || ''

    const handleCombinedItemChange = (value: string) => {
        const item = combinedItems.find(i => i.id === value)
        if (item) {
            if (item.type === 'app') { setSelectedApp(value); setSelectedMarketplace('') }
            else { setSelectedMarketplace(value); setSelectedApp('') }
        } else { setSelectedApp(''); setSelectedMarketplace('') }
    }

    return {
        customers, filteredCustomers, apps, products,
        searchTerm, setSearchTerm,
        selectedDate, setSelectedDate,
        selectedCustomers, setSelectedCustomers,
        loading, saving, reloading, error,
        selectedApp, setSelectedApp,
        selectedMarketplace, setSelectedMarketplace,
        combinedItems,
        showModal, setShowModal,
        showAccessModal, setShowAccessModal,
        showEditModal, setShowEditModal,
        showDeleteConfirm, setShowDeleteConfirm,
        showExportMenu, setShowExportMenu,
        editingCustomer,
        customerToDelete, setCustomerToDelete,
        customerProducts,
        formData, setFormData,
        selectedAppName,
        handleSelectAll, handleSelectCustomer,
        handleCombinedItemChange,
        toggleProductSelection, toggleProductAccess,
        handleAddCustomer, handleManageAccess,
        handleSaveAccess,
        handleEditCustomer, handleSaveCustomerEdit,
        handleSendEmail, handleDeleteCustomer, handleDeleteAllSelected,
        handleReload, handleExportCSV, handleExportPDF,
        formatDate, formatTime
    }
}
