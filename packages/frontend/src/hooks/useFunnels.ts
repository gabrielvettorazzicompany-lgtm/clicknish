/**
 * Custom hook for managing funnels state and operations
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { Funnel, CreateFunnelData, StatusFilter, TabType } from '@/types/funnel'

export const useFunnels = () => {
    const { user } = useAuthStore()
    const [funnels, setFunnels] = useState<Funnel[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [activeTab, setActiveTab] = useState<TabType>('funnels')

    useEffect(() => {
        if (user) {
            fetchFunnels()
        }
    }, [user])

    const fetchFunnels = async () => {
        try {
            setLoading(true)

            const { data: funnelsData, error } = await supabase
                .from('funnels')
                .select('*')
                .eq('owner_id', user?.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Batch fetch product names para evitar N+1 queries
            const productIds = [...new Set((funnelsData || []).map(f => f.product_id).filter(Boolean))]

            let productNames = new Map<string, string>()
            if (productIds.length > 0) {
                const [memberAreasResult, applicationsResult] = await Promise.all([
                    supabase.from('member_areas').select('id, name').in('id', productIds),
                    supabase.from('applications').select('id, name').in('id', productIds)
                ])

                for (const ma of (memberAreasResult.data || [])) {
                    productNames.set(ma.id, ma.name)
                }
                for (const app of (applicationsResult.data || [])) {
                    productNames.set(app.id, app.name)
                }
            }

            // Attach productName to each funnel
            const funnelsWithProducts = (funnelsData || []).map(f => ({
                ...f,
                productName: f.product_id ? productNames.get(f.product_id) || '' : ''
            }))

            setFunnels(funnelsWithProducts)
        } catch (error) {
            console.error('Error fetching funnels:', error)
        } finally {
            setLoading(false)
        }
    }

    const createFunnel = async (createData: CreateFunnelData) => {
        if (!createData.name.trim()) return null

        if (!user?.id) {
            console.error('User not authenticated')
            return null
        }

        try {
            setCreating(true)

            // Generate slug using database function
            const { data: slugResult, error: slugError } = await supabase.rpc(
                'generate_funnel_slug',
                {
                    funnel_name: createData.name,
                    owner_uuid: user.id
                }
            )

            if (slugError) {
                console.error('Error generating slug:', slugError)
                throw slugError
            }

            const slug = slugResult

            const newFunnelData = {
                owner_id: user.id,
                name: createData.name,
                slug: slug,
                objective: 'sales' as const,
                status: 'draft' as const,
                currency: createData.currency,
                ...(createData.product_id && {
                    product_id: createData.product_id,
                    product_type: createData.product_type
                })
            }

            const { data: newFunnel, error } = await supabase
                .from('funnels')
                .insert([newFunnelData])
                .select()
                .single()

            if (error) throw error

            // Create default pages (only Checkout - upsells/downsells are added manually)
            const defaultPages = [
                {
                    funnel_id: newFunnel.id,
                    name: 'Checkout',
                    slug: 'checkout',
                    page_type: 'checkout',
                    position: 1,
                    is_published: false,
                    ...(createData.checkout_id && { checkout_id: createData.checkout_id })
                }
            ]

            const { error: pagesError } = await supabase
                .from('funnel_pages')
                .insert(defaultPages)

            if (pagesError) {
                console.error('Error creating default pages:', pagesError)
            }

            setFunnels(prev => [newFunnel, ...prev])
            return newFunnel.id
        } catch (error) {
            console.error('Error creating funnel:', error)
            return null
        } finally {
            setCreating(false)
        }
    }

    const deleteFunnel = async (funnelId: string) => {
        try {
            const { error } = await supabase
                .from('funnels')
                .delete()
                .eq('id', funnelId)
                .eq('owner_id', user?.id)

            if (error) throw error

            setFunnels(prev => prev.filter(f => f.id !== funnelId))
            return true
        } catch (error) {
            console.error('Error deleting funnel:', error)
            return false
        }
    }

    const duplicateFunnel = async (funnelId: string) => {
        if (!user?.id) return null
        try {
            // Buscar funil original
            const { data: original, error: fErr } = await supabase
                .from('funnels')
                .select('*')
                .eq('id', funnelId)
                .single()
            if (fErr || !original) throw fErr

            // Gerar novo slug
            const { data: slugResult, error: slugError } = await supabase.rpc(
                'generate_funnel_slug',
                { funnel_name: `${original.name} (cópia)`, owner_uuid: user.id }
            )
            if (slugError) throw slugError

            // Criar funil duplicado
            const { data: newFunnel, error: nErr } = await supabase
                .from('funnels')
                .insert([{
                    owner_id: user.id,
                    name: `${original.name} (cópia)`,
                    slug: slugResult,
                    objective: original.objective,
                    status: 'draft',
                    currency: original.currency,
                    product_id: original.product_id,
                    product_type: original.product_type,
                    domain: original.domain,
                    description: original.description,
                    settings: original.settings,
                }])
                .select()
                .single()
            if (nErr || !newFunnel) throw nErr

            // Copiar páginas
            const { data: pages } = await supabase
                .from('funnel_pages')
                .select('*')
                .eq('funnel_id', funnelId)
            if (pages && pages.length > 0) {
                const newPages = pages.map(({ id: _id, funnel_id: _fid, created_at: _ca, updated_at: _ua, ...rest }) => ({
                    ...rest,
                    funnel_id: newFunnel.id,
                    is_published: false,
                }))
                const { data: insertedPages } = await supabase
                    .from('funnel_pages')
                    .insert(newPages)
                    .select('id')

                // Remapear referências de page_id nos settings:
                // post_purchase_page_id, accept_page_id, reject_page_id apontam para
                // IDs do funil original — precisam apontar para as novas páginas.
                if (insertedPages && insertedPages.length === pages.length) {
                    const oldToNew: Record<string, string> = {}
                    pages.forEach((oldPage, i) => {
                        oldToNew[oldPage.id] = insertedPages[i].id
                    })

                    const remapSettings = (settings: any) => {
                        if (!settings) return settings
                        const s = { ...settings }
                        if (s.post_purchase_page_id && oldToNew[s.post_purchase_page_id])
                            s.post_purchase_page_id = oldToNew[s.post_purchase_page_id]
                        if (s.accept_page_id && oldToNew[s.accept_page_id])
                            s.accept_page_id = oldToNew[s.accept_page_id]
                        if (s.reject_page_id && oldToNew[s.reject_page_id])
                            s.reject_page_id = oldToNew[s.reject_page_id]
                        return s
                    }

                    const updates = insertedPages
                        .map((newPage, i) => {
                            const remapped = remapSettings(pages[i].settings)
                            if (JSON.stringify(remapped) === JSON.stringify(pages[i].settings)) return null
                            return supabase
                                .from('funnel_pages')
                                .update({ settings: remapped })
                                .eq('id', newPage.id)
                        })
                        .filter(Boolean)

                    if (updates.length > 0) await Promise.all(updates)
                }
            }

            setFunnels(prev => [newFunnel, ...prev])
            return newFunnel.id
        } catch (error) {
            console.error('Error duplicating funnel:', error)
            return null
        }
    }

    const filteredFunnels = funnels.filter(funnel => {
        const matchesSearch = funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || funnel.status === statusFilter
        return matchesSearch && matchesStatus
    })

    return {
        // State
        funnels,
        filteredFunnels,
        loading,
        creating,
        searchTerm,
        statusFilter,
        activeTab,

        // Actions
        setSearchTerm,
        setStatusFilter,
        setActiveTab,
        fetchFunnels,
        createFunnel,
        deleteFunnel,
        duplicateFunnel
    }
}