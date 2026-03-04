import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit, Trash2, Pencil, Link as LinkIcon, Check, CopyPlus, ToggleLeft, ToggleRight } from 'lucide-react'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    price: number
    image_url?: string
    review_status?: 'pending_review' | 'approved' | 'rejected'
}

interface Checkout {
    id: string
    name: string
    product_id: string
    is_default: boolean
    is_active: boolean
    custom_price?: number
    custom_fields?: any
    created_at: string
}

interface CheckoutManagerProps {
    product: Product
    selectedPaymentMethods?: ('credit_card' | 'paypal')[]
    defaultPaymentMethod?: 'credit_card' | 'paypal'
    isApplication?: boolean // true se for uma aplicação, false se for produto do marketplace
}

export default function CheckoutManager({
    product,
    selectedPaymentMethods = ['credit_card'],
    defaultPaymentMethod = 'credit_card',
    isApplication = false
}: CheckoutManagerProps) {
    const { t } = useI18n()
    const navigate = useNavigate()
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showPreview, setShowPreview] = useState<string | null>(null)
    const [editingCheckout, setEditingCheckout] = useState<Checkout | null>(null)
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

    const [checkoutForm, setCheckoutForm] = useState({
        name: '',
        custom_price: product.price || 0,
        is_default: false
    })

    const [priceDisplay, setPriceDisplay] = useState('')
    const [editModal, setEditModal] = useState<{ id: string; name: string; price: number } | null>(null)
    const [duplicating, setDuplicating] = useState<string | null>(null)

    useEffect(() => {
        fetchCheckouts()
    }, [product.id])

    const handlePriceInput = (value: string) => {
        let cleaned = value.replace(/[^\d,]/g, '')
        const parts = cleaned.split(',')
        if (parts.length > 2) {
            cleaned = parts[0] + ',' + parts.slice(1).join('')
        }
        if (parts.length === 2 && parts[1].length > 2) {
            cleaned = parts[0] + ',' + parts[1].substring(0, 2)
        }
        const [intPart, decPart] = cleaned.split(',')
        let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        if (cleaned.includes(',')) {
            formatted += ',' + (decPart || '')
        }
        setPriceDisplay(formatted)
        const numValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0

        // Limitar a 99.999.999,99 (máximo para numeric(10,2))
        const limitedValue = Math.min(numValue, 99999999.99)
        setCheckoutForm({ ...checkoutForm, custom_price: limitedValue })
    }

    const fetchCheckouts = async () => {
        try {
            setLoading(true)

            // Buscar por application_id se for app, ou member_area_id se for produto
            const columnName = isApplication ? 'application_id' : 'member_area_id'

            const { data, error } = await supabase
                .from('checkouts')
                .select('*')
                .eq(columnName, product.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            setCheckouts(data || [])
        } catch (error) {
            console.error('Error fetching checkouts:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateCheckout = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            // Arredondar para 2 casas decimais e garantir que está dentro do limite
            const roundedPrice = Math.min(
                Math.round((checkoutForm.custom_price || 0) * 100) / 100,
                99999999.99
            )

            // Criar objeto de insert baseado no tipo (app ou produto)
            const insertData = isApplication
                ? {
                    application_id: product.id,
                    name: checkoutForm.name || `Checkout ${checkouts.length + 1}`,
                    custom_price: roundedPrice,
                    is_default: checkoutForm.is_default,
                    banner_title: product.name
                }
                : {
                    member_area_id: product.id,
                    name: checkoutForm.name || `Checkout ${checkouts.length + 1}`,
                    custom_price: roundedPrice,
                    is_default: checkoutForm.is_default,
                    banner_title: product.name
                }

            const { data, error } = await supabase
                .from('checkouts')
                .insert(insertData)
                .select()
                .single()

            if (error) throw error

            setCheckouts([data, ...checkouts])
            handleCloseCreateModal()

            alert(t('components.checkout_manager.created_success'))
        } catch (error) {
            console.error('Error creating checkout:', error)
            alert(t('components.checkout_manager.error_creating'))
        }
    }

    const handleDeleteCheckout = async (id: string) => {
        if (!confirm(t('components.checkout_manager.confirm_delete'))) return

        try {
            const { error } = await supabase
                .from('checkouts')
                .delete()
                .eq('id', id)

            if (error) throw error

            setCheckouts(checkouts.filter(c => c.id !== id))
            alert(t('components.checkout_manager.deleted_success'))
        } catch (error) {
            console.error('Error deleting checkout:', error)
            alert(t('components.checkout_manager.error_deleting'))
        }
    }

    const handleToggleActive = async (checkout: Checkout) => {
        try {
            const { error } = await supabase
                .from('checkouts')
                .update({ is_active: !checkout.is_active })
                .eq('id', checkout.id)

            if (error) throw error

            setCheckouts(checkouts.map(c => c.id === checkout.id ? { ...c, is_active: !c.is_active } : c))
        } catch (error) {
            console.error('Error toggling checkout status:', error)
        }
    }

    const handleDuplicateCheckout = async (checkout: Checkout) => {
        try {
            setDuplicating(checkout.id)

            const price = checkout.custom_price || product.price || 0
            const roundedPrice = Math.min(
                Math.round(price * 100) / 100,
                99999999.99
            )

            const insertData = isApplication
                ? {
                    application_id: product.id,
                    name: `${checkout.name} (copy)`,
                    custom_price: roundedPrice,
                    is_default: false,
                    custom_fields: checkout.custom_fields
                }
                : {
                    member_area_id: product.id,
                    name: `${checkout.name} (copy)`,
                    custom_price: roundedPrice,
                    is_default: false,
                    custom_fields: checkout.custom_fields
                }

            const { data, error } = await supabase
                .from('checkouts')
                .insert(insertData)
                .select()
                .single()

            if (error) throw error

            setCheckouts([data, ...checkouts])
            alert(t('components.checkout_manager.duplicated_success'))
        } catch (error) {
            console.error('Error duplicating checkout:', error)
            alert(t('components.checkout_manager.error_duplicating'))
        } finally {
            setDuplicating(null)
        }
    }

    const handleUpdateCheckout = async () => {
        if (!editModal) return

        try {
            const roundedPrice = Math.min(
                Math.round((editModal.price || 0) * 100) / 100,
                99999999.99
            )

            const { error } = await supabase
                .from('checkouts')
                .update({ name: editModal.name, custom_price: roundedPrice })
                .eq('id', editModal.id)

            if (error) throw error

            setCheckouts(checkouts.map(c =>
                c.id === editModal.id
                    ? { ...c, name: editModal.name, custom_price: roundedPrice }
                    : c
            ))
            setEditModal(null)
            alert(t('components.checkout_manager.updated_success'))

            // ⚡ Purge KV cache — próximo acesso já vê o novo preço/nome
            fetch('https://api.clicknich.com/api/cache/purge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkoutId: editModal.id }),
            }).catch(() => { })
        } catch (error) {
            console.error('Error updating price:', error)
            alert(t('components.checkout_manager.error_updating_price'))
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value)
    }

    const handleCopyLink = async (checkoutId: string) => {
        try {
            // Buscar ou criar URL curta para o checkout
            const { data: existingUrl } = await supabase
                .from('checkout_urls')
                .select('id')
                .eq('checkout_id', checkoutId)
                .maybeSingle()

            let shortId = existingUrl?.id

            if (!shortId) {
                // Criar nova URL curta
                const insertData = isApplication
                    ? {
                        application_id: product.id,
                        checkout_id: checkoutId
                    }
                    : {
                        member_area_id: product.id,
                        checkout_id: checkoutId
                    }

                const { data: newUrl, error } = await supabase
                    .from('checkout_urls')
                    .insert(insertData)
                    .select('id')
                    .single()

                if (error) throw error
                shortId = newUrl.id
            }

            // Copiar URL curta
            const checkoutUrl = `${window.location.origin}/checkout/${shortId}`
            await navigator.clipboard.writeText(checkoutUrl)
            setCopiedLinkId(checkoutId)
            setTimeout(() => setCopiedLinkId(null), 2000)
        } catch (error) {
            console.error('Error copying link:', error)
            alert(t('components.checkout_manager.error_generating_link'))
        }
    }

    const handleCloseCreateModal = () => {
        setShowCreateModal(false)
        setPriceDisplay('')
        setCheckoutForm({
            name: '',
            custom_price: product.price || 0,
            is_default: false
        })
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] p-3">
                <div className="flex items-center justify-between mb-1.5">
                    <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t('components.checkout_manager.product_checkouts')}</h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={product.review_status === 'pending_review' || product.review_status === 'rejected'}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title={product.review_status === 'pending_review' ? t('components.checkout_manager.pending_title_attr') : product.review_status === 'rejected' ? t('components.checkout_manager.rejected_title_attr') : ''}
                    >
                        <Plus size={12} />
                        {t('components.checkout_manager.create_new')}
                    </button>
                </div>
                <p className="text-[10px] text-gray-600">
                    {t('components.checkout_manager.manage_desc')}
                </p>
            </div>

            {/* Checkouts List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-[#252941] border-t-blue-500 dark:border-t-teal-600 mx-auto"></div>
                        <p className="mt-1.5 text-[10px] text-gray-600">{t('components.checkout_manager.loading')}</p>
                    </div>
                ) : (
                    checkouts.map((checkout) => (
                        <div key={checkout.id} className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{checkout.name}</h3>
                                        {checkout.is_default && (
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-full">
                                                {t('components.checkout_manager.default_badge')}
                                            </span>
                                        )}
                                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${checkout.is_active !== false
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                            }`}>
                                            {checkout.is_active !== false ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        <p>{t('components.checkout_manager.price_label')} {formatCurrency(checkout.custom_price || product.price)}</p>
                                        <p>{t('components.checkout_manager.created_on')} {new Date(checkout.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleCopyLink(checkout.id)}
                                        disabled={product.review_status === 'pending_review' || product.review_status === 'rejected'}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${copiedLinkId === checkout.id
                                            ? 'text-green-600 bg-green-50 dark:bg-green-900/30'
                                            : 'text-gray-700 dark:text-gray-600 bg-gray-100 dark:bg-[#252941] hover:bg-gray-200 dark:hover:bg-[#252941]'
                                            }`}
                                        title={product.review_status === 'pending_review' || product.review_status === 'rejected' ? t('components.checkout_manager.disabled_not_approved') : t('components.checkout_manager.copy_link_title')}
                                    >
                                        {copiedLinkId === checkout.id ? (
                                            <>
                                                <Check size={14} />
                                                <span className="text-xs">{t('common.copied')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <LinkIcon size={14} />
                                                <span className="text-xs hidden sm:inline">{t('components.checkout_manager.link')}</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleToggleActive(checkout)}
                                        className={`p-1.5 rounded-lg transition-colors ${checkout.is_active !== false
                                            ? 'text-emerald-500 hover:bg-emerald-500/10'
                                            : 'text-gray-400 hover:bg-gray-500/10'
                                            }`}
                                        title={checkout.is_active !== false ? 'Desativar checkout' : 'Ativar checkout'}
                                    >
                                        {checkout.is_active !== false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    </button>

                                    <button
                                        onClick={() => handleDuplicateCheckout(checkout)}
                                        disabled={duplicating === checkout.id}
                                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={t('components.checkout_manager.duplicate_label')}
                                    >
                                        <CopyPlus size={14} />
                                    </button>

                                    <button
                                        onClick={() => navigate(`/checkout-builder/${product.id}/${checkout.id}`)}
                                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        title="Editar Checkout"
                                    >
                                        <Pencil size={14} />
                                    </button>

                                    {!checkout.is_default && (
                                        <button
                                            onClick={() => handleDeleteCheckout(checkout.id)}
                                            disabled={product.review_status === 'pending_review' || product.review_status === 'rejected'}
                                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={product.review_status === 'pending_review' || product.review_status === 'rejected' ? t('components.checkout_manager.disabled_not_approved') : t('common.delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Preview */}
                            {showPreview === checkout.id && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#1e2139]">
                                    <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('components.checkout_manager.preview')}</h4>
                                    <CheckoutDigital
                                        productId={product.id}
                                        productName={product.name}
                                        productPrice={checkout.custom_price || product.price}
                                        productImage={product.image_url}
                                        selectedPaymentMethods={selectedPaymentMethods}
                                        defaultPaymentMethod={defaultPaymentMethod}
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create Checkout Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl max-w-sm w-full border border-gray-200 dark:border-[#252941]/30">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('components.checkout_manager.create_new')}</h3>
                                <button
                                    onClick={handleCloseCreateModal}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleCreateCheckout} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.name')}</label>
                                    <input
                                        type="text"
                                        value={checkoutForm.name}
                                        onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 text-sm border border-gray-300 dark:border-[#252941]/30 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none"
                                        placeholder={t('components.checkout_manager.name_placeholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.price')}</label>
                                    <input
                                        type="text"
                                        value={priceDisplay || (checkoutForm.custom_price > 0 ? checkoutForm.custom_price.toFixed(2).replace('.', ',') : '')}
                                        onChange={(e) => handlePriceInput(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 text-sm border border-gray-300 dark:border-[#252941]/30 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none"
                                        placeholder="0,00"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is-default"
                                        checked={checkoutForm.is_default}
                                        onChange={(e) => setCheckoutForm({ ...checkoutForm, is_default: e.target.checked })}
                                        className="rounded border-[#252941]/30 bg-[#0f1117] text-blue-500 focus:ring-blue-500/50"
                                    />
                                    <label htmlFor="is-default" className="text-xs text-gray-300">
                                        {t('components.checkout_manager.set_default')}
                                    </label>
                                </div>

                                <div className="flex gap-2 pt-3">
                                    <button
                                        type="button"
                                        onClick={handleCloseCreateModal}
                                        className="flex-1 px-3 py-2 text-sm text-gray-400 border border-[#252941]/30 rounded-lg hover:bg-[#0f1117] transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                        {t('common.save')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Checkout Modal */}
            {editModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl max-w-sm w-full border border-gray-200 dark:border-[#252941]/30">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('components.checkout_manager.edit')}</h3>
                                <button
                                    onClick={() => setEditModal(null)}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.name')}</label>
                                    <input
                                        type="text"
                                        value={editModal.name}
                                        onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 text-sm border border-gray-300 dark:border-[#252941]/30 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none"
                                        placeholder={t('components.checkout_manager.checkout_name')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.price')}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editModal.price}
                                        onChange={(e) => setEditModal({ ...editModal, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 text-sm border border-gray-300 dark:border-[#252941]/30 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none"
                                    />
                                </div>

                                <div className="flex gap-2 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditModal(null)}
                                        className="flex-1 px-3 py-2 text-sm text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-[#252941]/30 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0f1117] transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={handleUpdateCheckout}
                                        className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                        {t('common.save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}