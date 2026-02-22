/**
 * Modal for creating new funnels
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { CreateFunnelData } from '@/types/funnel'
import { CURRENCIES } from '@/utils/funnelUtils'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

interface CreateFunnelModalProps {
    isOpen: boolean
    creating: boolean
    onClose: () => void
    onSubmit: (data: CreateFunnelData) => Promise<boolean>
}

export default function CreateFunnelModal({
    isOpen,
    creating,
    onClose,
    onSubmit
}: CreateFunnelModalProps) {
    const { user } = useAuthStore()
    const { t } = useI18n()
    const [formData, setFormData] = useState<CreateFunnelData>({
        name: '',
        currency: 'USD',
        product_id: undefined,
        product_type: undefined
    })
    const [products, setProducts] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [checkouts, setCheckouts] = useState<any[]>([])
    const [loadingCheckouts, setLoadingCheckouts] = useState(false)
    const [selectedCheckout, setSelectedCheckout] = useState<string>('')

    useEffect(() => {
        if (!isOpen) {
            setFormData({ name: '', currency: 'USD', product_id: undefined, product_type: undefined })
            setCheckouts([])
            setSelectedCheckout('')
        } else {
            fetchProducts()
        }
    }, [isOpen])

    useEffect(() => {
        if (formData.product_id) {
            fetchCheckouts(formData.product_id)
        } else {
            setCheckouts([])
            setSelectedCheckout('')
        }
    }, [formData.product_id, formData.product_type])

    const fetchProducts = async () => {
        if (!user?.id) return

        setLoadingProducts(true)
        try {
            let allProducts: any[] = []

            // Buscar produtos do marketplace (member areas)
            const { data: marketplaceProducts, error: mpError } = await supabase
                .from('member_areas')
                .select('id, name')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false })

            if (mpError) {
                console.error('Error fetching member_areas:', mpError)
            } else if (marketplaceProducts) {
                allProducts.push(...marketplaceProducts.map(p => ({
                    ...p,
                    source: 'marketplace',
                    label: `${p.name} (Marketplace)`
                })))
            }

            const { data: apps, error: appsError } = await supabase
                .from('applications')
                .select('id, name, app_type')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false })

            if (appsError) {
                console.error('Error fetching applications:', appsError)
            } else if (apps) {
                allProducts.push(...apps.map(a => ({
                    ...a,
                    source: a.app_type === 'community' ? 'community' : 'application',
                    label: `${a.name} (${a.app_type === 'community' ? 'Community' : 'App'})`
                })))
            }
            setProducts(allProducts)
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoadingProducts(false)
        }
    }

    const fetchCheckouts = async (productId: string) => {
        setLoadingCheckouts(true)
        try {


            let query = supabase.from('checkouts').select('id, name')

            if (formData.product_type === 'marketplace') {
                query = query.eq('member_area_id', productId)
            } else {
                query = query.eq('application_id', productId)
            }

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching checkouts:', error)
            } else if (data) {

                setCheckouts(data)
            }
        } catch (error) {
            console.error('Error fetching checkouts:', error)
        } finally {
            setLoadingCheckouts(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

        const dataToSubmit = {
            ...formData,
            ...(selectedCheckout && { checkout_id: selectedCheckout })
        }

        const success = await onSubmit(dataToSubmit)
        if (success) {
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#0c0f1a] rounded-xl max-w-md w-full border border-gray-200 dark:border-white/[0.08] shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('funnels.create_modal.title')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        disabled={creating}
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('funnels.create_modal.name')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={t('funnels.create_modal.name_placeholder')}
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-colors"
                            disabled={creating}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('funnels.create_modal.product')}
                        </label>
                        <select
                            value={formData.product_id || ''}
                            onChange={(e) => {
                                const selectedProduct = products.find(p => p.id === e.target.value)
                                setFormData(prev => ({
                                    ...prev,
                                    product_id: e.target.value || undefined,
                                    product_type: selectedProduct?.source || undefined
                                }))
                                setSelectedCheckout('')
                            }}
                            className="w-full px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
                            disabled={creating || loadingProducts}
                        >
                            <option value="">{t('funnels.create_modal.product_placeholder')}</option>
                            {products.map(product => (
                                <option key={`${product.source}-${product.id}`} value={product.id}>
                                    {product.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {formData.product_id && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Oferta
                            </label>
                            <select
                                value={selectedCheckout}
                                onChange={(e) => setSelectedCheckout(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
                                disabled={creating || loadingCheckouts}
                            >
                                <option value="">{t('funnels.create_modal.offer_placeholder')}</option>
                                {checkouts.map(checkout => (
                                    <option key={checkout.id} value={checkout.id}>
                                        {checkout.name}
                                    </option>
                                ))}
                            </select>
                            {loadingCheckouts && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">{t('funnels.create_modal.loading_offers')}</p>
                            )}
                            {!loadingCheckouts && checkouts.length === 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">{t('funnels.create_modal.no_offers')}</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('funnels.create_modal.currency')}</label>
                        <select
                            value={formData.currency}
                            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as any }))}
                            className="w-full px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
                            disabled={creating}
                        >
                            {CURRENCIES.map(currency => (
                                <option key={currency.value} value={currency.value}>
                                    {currency.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                            disabled={creating}
                        >
                            {t('funnels.create_modal.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!formData.name.trim() || creating}
                            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed rounded-lg transition-all"
                        >
                            {creating ? t('funnels.create_modal.creating') : t('funnels.create_modal.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}