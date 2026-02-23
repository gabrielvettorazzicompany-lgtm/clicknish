import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { App, MarketplaceProduct, Product, Customer, CombinedItem, CustomerFormData } from '@/types/customers'
import { useDebounce } from './useDebounce'

export type { App, MarketplaceProduct, Product, Customer, CombinedItem, CustomerFormData }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useCustomers() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [apps, setApps] = useState<App[]>([])
    const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [currentUserId, setCurrentUserId] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [reloading, setReloading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedApp, setSelectedApp] = useState<string>('')
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
    const [productMembers, setProductMembers] = useState<Record<string, boolean>>({})
    const [formData, setFormData] = useState<CustomerFormData>({
        name: '', email: '', phone: '', selectedProducts: []
    })

    useEffect(() => {
        fetchApps()
        getCurrentUserId().then(id => { if (id) setCurrentUserId(id) })
    }, [])

    useEffect(() => {
        if (currentUserId) fetchMarketplaceProducts()
    }, [currentUserId])

    useEffect(() => {
        const combined: CombinedItem[] = [
            ...apps.map(app => ({ id: app.id, name: app.name, type: 'app' as const })),
            ...marketplaceProducts.map(p => ({ id: p.id, name: p.name, type: 'marketplace' as const }))
        ]
        setCombinedItems(combined)
    }, [apps, marketplaceProducts])

    useEffect(() => {
        if (selectedApp) {
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
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) { setCurrentUserId(user.id); return user.id }
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) { setCurrentUserId(session.user.id); return session.user.id }
            return null
        } catch { return null }
    }

    const fetchApps = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            const userId = user?.id || currentUserId
            const res = await fetch(`${SUPABASE_URL}/functions/v1/applications`, {
                headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY, 'x-user-id': userId || '' }
            })
            const data = await res.json()
            if (Array.isArray(data)) { setApps(data); if (data.length > 0) setSelectedApp(data[0].id) }
            else setApps([])
        } catch { setApps([]) }
        finally { setLoading(false) }
    }

    const fetchMarketplaceProducts = async () => {
        try {
            const userId = await getCurrentUserId()
            if (!userId) { setMarketplaceProducts([]); return }
            const { data: s } = await supabase.auth.getSession()
            const token = s?.session?.access_token
            if (!token) { setMarketplaceProducts([]); return }
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/marketplace_products?owner_id=eq.${userId}&select=id,name,price,owner_id,slug`,
                { headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            if (!res.ok) { setMarketplaceProducts([]); return }
            const data = await res.json()
            setMarketplaceProducts(Array.isArray(data) ? data : [])
        } catch { setMarketplaceProducts([]) }
    }

    const fetchProducts = async (appId: string): Promise<Product[]> => {
        try {
            const userId = currentUserId
            const appRes = await fetch(
                `${SUPABASE_URL}/rest/v1/products?application_id=eq.${appId}&select=id,name,price`,
                { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const appData = await appRes.json()

            let mktData: Product[] = []
            let mktIds: string[] = []
            if (userId) {
                try {
                    const r = await fetch(
                        `${SUPABASE_URL}/rest/v1/marketplace_products?owner_id=eq.${userId}&select=id,name,price,owner_id`,
                        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                    )
                    if (r.ok) { const d = await r.json(); if (Array.isArray(d)) { mktData = d; mktIds = d.map((p: Product) => p.id) } }
                } catch { /* ignore */ }
            }

            let communityData: { id: string; title: string }[] = []
            if (userId && mktIds.length > 0) {
                const filter = mktIds.map(id => `member_area_id=eq.${id}`).join('&')
                const r = await fetch(
                    `${SUPABASE_URL}/rest/v1/community_modules?${filter}&select=id,title`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                communityData = await r.json()
            }

            const combined: Product[] = []
            if (Array.isArray(appData)) combined.push(...appData)
            if (Array.isArray(mktData)) combined.push(...mktData)
            if (Array.isArray(communityData)) combined.push(...communityData.map(m => ({ id: m.id, name: m.title, price: 0 })))
            setProducts(combined)
            return combined
        } catch { setProducts([]); return [] }
    }

    const fetchCustomers = async (id: string, type?: 'app' | 'marketplace') => {
        try {
            setLoading(true)
            const fetchType = type || (selectedMarketplace && !selectedApp ? 'marketplace' : 'app')
            if (fetchType === 'app') {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/app_users?application_id=eq.${id}&select=id,user_id,email,application_id,full_name,phone,status,last_login,created_at`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((c: Customer) => ({
                        id: c.id, user_id: c.user_id, email: c.email || 'Email not available',
                        application_id: c.application_id, full_name: c.full_name, phone: c.phone,
                        status: c.status, last_login: c.last_login, created_at: c.created_at
                    }))
                    setCustomers(mapped)
                } else { setCustomers([]) }
            } else {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/member_profiles?product_id=eq.${id}&select=id,email,name,phone,created_at,last_login_at`,
                    { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                )
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((m: any) => ({
                        id: m.id, user_id: m.id, email: m.email || 'Email not available',
                        application_id: id, full_name: m.name, phone: m.phone,
                        status: 'active', last_login: m.last_login_at, created_at: m.created_at
                    }))
                    setCustomers(mapped)
                } else { setCustomers([]) }
            }
        } catch { setCustomers([]) }
        finally { setLoading(false) }
    }

    const fetchCustomerAccess = async (customer: Customer, productsList: Product[]) => {
        try {
            const [r1, r2] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${customer.user_id}&select=product_id`, {
                    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                }),
                fetch(`${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${customer.user_id}&select=member_area_id`, {
                    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                })
            ])
            const d1 = await r1.json()
            const d2 = await r2.json()
            if (Array.isArray(d1) || Array.isArray(d2)) {
                const access: Record<string, boolean> = {}
                productsList.forEach(p => {
                    access[p.id] =
                        (Array.isArray(d1) && d1.some((a: any) => a.product_id === p.id)) ||
                        (Array.isArray(d2) && d2.some((a: any) => a.member_area_id === p.id))
                })
                setCustomerProducts(access)
            }
        } catch { /* ignore */ }
    }

    const fetchCustomerProductMembers = async (customer: Customer, productsList: Product[]) => {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/product_members?user_id=eq.${customer.user_id}&select=product_id`,
                { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const data = await res.json()
            if (Array.isArray(data)) {
                const members: Record<string, boolean> = {}
                productsList.forEach(p => { members[p.id] = data.some((m: any) => m.product_id === p.id) })
                setProductMembers(members)
            }
        } catch { /* ignore */ }
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

    const toggleProductMember = (productId: string) =>
        setProductMembers(prev => ({ ...prev, [productId]: !prev[productId] }))

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
                const res = await fetch(`${SUPABASE_URL}/functions/v1/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ email: formData.email, marketplaceProductId: selectedMarketplace, name: formData.name, phone: formData.phone })
                })
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error creating member') }
                alert('Member added successfully!')
                setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] })
                fetchCustomers(selectedMarketplace); return
            }

            const checkRes = await fetch(
                `${SUPABASE_URL}/rest/v1/app_users?email=eq.${formData.email}&application_id=eq.${selectedApp}&select=id,user_id`,
                { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const existingUsers = await checkRes.json()
            if (existingUsers?.length > 0) {
                const existingUser = existingUsers[0]
                if (formData.selectedProducts.length > 0) {
                    const currentRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${existingUser.user_id}&application_id=eq.${selectedApp}&select=product_id`,
                        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                    )
                    const currRaw = await currentRes.json()
                    const curr = Array.isArray(currRaw) ? currRaw : []
                    const currIds = curr.map((a: any) => a.product_id)
                    const newProds = formData.selectedProducts.filter(id => !currIds.includes(id))
                    if (newProds.length > 0) {
                        await fetch(`${SUPABASE_URL}/rest/v1/user_product_access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                            body: JSON.stringify(newProds.map(productId => ({ user_id: existingUser.user_id, product_id: productId, application_id: selectedApp, access_type: 'manual', is_active: true })))
                        })
                        alert(`Access granted! ${newProds.length} new product(s) added to ${formData.email}`)
                    } else { alert('This customer already has access to all selected products') }
                } else { alert('Customer already exists. Select products to grant access.') }
                setShowModal(false); setFormData({ name: '', email: '', phone: '', selectedProducts: [] })
                fetchCustomers(selectedApp); return
            }

            const res = await fetch(`${SUPABASE_URL}/functions/v1/clients`, {
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
        await fetchCustomerProductMembers(customer, loadedProducts)
        setShowAccessModal(true)
    }

    const handleSaveAccess = async () => {
        if (!editingCustomer) return
        setSaving(true)
        try {
            const appProdIds = products.filter(p => p.id.startsWith('app-') || !p.id.includes('-marketplace')).map(p => p.id)
            const mktProdIds = products.filter(p => p.id.includes('-marketplace') || !appProdIds.includes(p.id)).map(p => p.id)
            const newIds = Object.keys(customerProducts).filter(id => customerProducts[id])

            const [r1, r2] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${editingCustomer.user_id}&select=id,product_id`, {
                    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                }),
                fetch(`${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${editingCustomer.user_id}&select=id,member_area_id`, {
                    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                })
            ])
            const currAppRaw = await r1.json()
            const currMktRaw = await r2.json()

            // Garantir que são arrays
            const currApp = Array.isArray(currAppRaw) ? currAppRaw : []
            const currMkt = Array.isArray(currMktRaw) ? currMktRaw : []

            const appToManage = newIds.filter(id => !mktProdIds.includes(id))
            for (const a of currApp.filter((a: any) => !appToManage.includes(a.product_id))) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access?id=eq.${a.id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                })
            }
            const appToAdd = appToManage.filter(id => !currApp.map((a: any) => a.product_id).includes(id))
            if (appToAdd.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                    body: JSON.stringify(appToAdd.map(id => ({ user_id: editingCustomer.user_id, product_id: id, application_id: selectedApp, access_type: 'manual', is_active: true })))
                })
            }

            const mktToManage = newIds.filter(id => mktProdIds.includes(id))
            for (const a of currMkt.filter((a: any) => !mktToManage.includes(a.member_area_id))) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access?id=eq.${a.id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                })
            }
            const mktToAdd = mktToManage.filter(id => !currMkt.map((a: any) => a.member_area_id).includes(id))
            if (mktToAdd.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/user_product_access`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                    body: JSON.stringify(mktToAdd.map(id => ({ user_id: editingCustomer.user_id, member_area_id: id, access_type: 'manual', is_active: true })))
                })
            }

            alert('Access updated successfully!')
            setShowAccessModal(false); setEditingCustomer(null); fetchCustomers(selectedApp)
        } catch (error) { alert(`Error saving access: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setSaving(false) }
    }

    const handleSaveProductMembers = async () => {
        if (!editingCustomer) return
        setSaving(true)
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/product_members?user_id=eq.${editingCustomer.user_id}&select=id,product_id`,
                { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
            )
            const currRaw = await res.json()
            const curr = Array.isArray(currRaw) ? currRaw : []
            const currIds = curr.map((m: any) => m.product_id)
            const newIds = Object.keys(productMembers).filter(id => productMembers[id])
            for (const m of curr.filter((m: any) => !newIds.includes(m.product_id))) {
                await fetch(`${SUPABASE_URL}/rest/v1/product_members?id=eq.${m.id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                })
            }
            const toAdd = newIds.filter(id => !currIds.includes(id))
            if (toAdd.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/product_members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                    body: JSON.stringify(toAdd.map(id => ({ user_id: editingCustomer.user_id, product_id: id, role: 'member', joined_at: new Date().toISOString() })))
                })
            }
            alert('Product members updated successfully!')
            setShowAccessModal(false); setEditingCustomer(null); fetchCustomers(selectedApp)
        } catch (error) { alert(`Error saving product members: ${error instanceof Error ? error.message : 'Unknown error'}`) }
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
            let appName = '', appSlug = '', marketplaceName = '', downloadLink = '', loginUrl = ''
            const customerProductsList: string[] = []

            if (selectedApp && !selectedMarketplace) {
                const app = apps.find(a => a.id === selectedApp)
                if (app) {
                    appName = app.name; appSlug = app.slug || ''
                    loginUrl = `${window.location.origin}/access/${app.slug}`
                    try {
                        const accessRes = await fetch(
                            `${SUPABASE_URL}/rest/v1/user_product_access?user_id=eq.${customer.user_id}&application_id=eq.${selectedApp}&select=product_id`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
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
                            `${SUPABASE_URL}/rest/v1/applications?id=eq.${selectedApp}&select=android_url,ios_url`,
                            { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
                        )
                        if (ar.ok) { const d = await ar.json(); if (d?.[0]) downloadLink = d[0].android_url || d[0].ios_url || '' }
                    } catch { /* ignore */ }
                }
            } else {
                const product = marketplaceProducts.find(p => p.id === selectedMarketplace)
                if (product) { marketplaceName = product.name; loginUrl = `${window.location.origin}/members-login/${product.slug}` }
            }

            const productName = appName || marketplaceName || 'Platform'
            const productsHtml = customerProductsList.length > 0
                ? `<ul style="list-style:none;padding:0;margin:0">${customerProductsList.map(p => `<li style="padding:4px 0;color:#666">${p}</li>`).join('')}</ul>`
                : ''
            const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:28px">Access Granted</h1></div><div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px"><p style="color:#333;font-size:16px">Hi <strong>${customer.full_name || customer.email}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6">Great news! You now have access to:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #667eea"><p style="color:#333;font-size:14px;margin-bottom:10px"><strong>${productName}</strong></p>${productsHtml}</div>${loginUrl ? `<div style="margin:30px 0;text-align:center"><a href="${loginUrl}" style="background:#667eea;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">${appSlug ? 'Access App Login' : 'Access Members Area'}</a></div>${downloadLink ? `<div style="margin:15px 0;text-align:center"><a href="${downloadLink}" style="background:white;color:#667eea;border:2px solid #667eea;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px">Download App</a></div>` : ''}` : ''}<div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px"><p style="color:#666;font-size:13px;margin:0"><strong>Access instructions:</strong><br>1. Click the button above<br>2. Email: <strong>${customer.email}</strong><br>3. If first access, create your password${customer.phone ? `<br>4. Your phone: ${customer.phone}` : ''}</p></div></div></div>`

            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({ to: customer.email, subject: `Your access to ${productName} is ready`, html, customer_name: customer.full_name || customer.email })
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
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/app_users?id=eq.${customerToDelete.id}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
            })
            if (!res.ok) throw new Error('Error deleting customer')
            alert('Customer deleted successfully!')
            setShowDeleteConfirm(false); setCustomerToDelete(null); fetchCustomers(selectedApp, 'app')
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
                selectedCustomers.map(id => fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY }
                }))
            )
            const failed = results.filter(r => !r.ok).length
            alert(failed > 0 ? `${selectedCustomers.length - failed} deleted, ${failed} failed.` : `${selectedCustomers.length} customer(s) deleted successfully!`)
            setSelectedCustomers([])
            if (isMarketplace) fetchCustomers(selectedMarketplace, 'marketplace')
            else fetchCustomers(selectedApp, 'app')
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
        loading, saving, reloading,
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
        customerProducts, productMembers,
        formData, setFormData,
        selectedAppName,
        handleSelectAll, handleSelectCustomer,
        handleCombinedItemChange,
        toggleProductSelection, toggleProductAccess, toggleProductMember,
        handleAddCustomer, handleManageAccess,
        handleSaveAccess, handleSaveProductMembers,
        handleEditCustomer, handleSaveCustomerEdit,
        handleSendEmail, handleDeleteCustomer, handleDeleteAllSelected,
        handleReload, handleExportCSV, handleExportPDF,
        formatDate, formatTime
    }
}
