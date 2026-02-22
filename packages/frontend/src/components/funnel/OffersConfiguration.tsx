import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Check, X } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import OfferCard from './OfferCard'
import OfferModal from './OfferModal'
import { useI18n } from '@/i18n'

interface Offer {
    id: string
    type: 'upsell' | 'downsell' | 'order_bump'
    title: string
    description: string
    product_id: string
    product_name: string
    original_price: number
    offer_price: number
    discount_percentage?: number
    currency: string
    button_text: string
    is_active: boolean
}

interface Funnel {
    id: string
    name: string
    currency: string
}

interface OffersConfigurationProps {
    funnels: Funnel[]
    onRefresh: () => Promise<void>
}

export default function OffersConfiguration({ funnels, onRefresh }: OffersConfigurationProps) {
    const { user } = useAuthStore()
    const { t } = useI18n()
    const [selectedFunnel, setSelectedFunnel] = useState<string>('')
    const [offers, setOffers] = useState<Offer[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])

    // Auto-select funnel if there's only one
    useEffect(() => {
        if (funnels.length === 1 && !selectedFunnel) {
            setSelectedFunnel(funnels[0].id)
        }
    }, [funnels])

    useEffect(() => {
        if (user) {
            fetchProducts()
        }
    }, [user])

    useEffect(() => {
        if (selectedFunnel) {
            fetchOffers()
        }
    }, [selectedFunnel])

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('member_areas')
                .select('id, name, price, currency')
                .eq('owner_id', user?.id)

            if (error) throw error

            setProducts(data || [])
        } catch (error) {
            console.error('Error fetching products:', error)
        }
    }

    const fetchOffers = async () => {
        if (!selectedFunnel) return

        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('checkout_offers')
                .select(`
                    *,
                    member_areas!checkout_offers_product_id_fkey (
                        name
                    )
                `)
                .eq('funnel_id', selectedFunnel)

            if (error) throw error

            const formattedOffers = (data || []).map((offer: any) => ({
                id: offer.id,
                type: offer.offer_type,
                title: offer.title,
                description: offer.description || '',
                product_id: offer.product_id,
                product_name: offer.member_areas?.name || 'Product not found',
                original_price: offer.original_price,
                offer_price: offer.offer_price,
                discount_percentage: offer.discount_percentage,
                currency: offer.currency,
                button_text: offer.button_text,
                is_active: offer.is_active
            }))

            setOffers(formattedOffers)
        } catch (error) {
            console.error('Error fetching offers:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddOffer = async (offer: Omit<Offer, 'id'>) => {
        if (!selectedFunnel) return

        try {


            const { data, error } = await supabase
                .from('checkout_offers')
                .insert([{
                    funnel_id: selectedFunnel,
                    product_id: offer.product_id,
                    offer_type: offer.type,
                    title: offer.title,
                    description: offer.description,
                    original_price: offer.original_price,
                    offer_price: offer.offer_price,
                    discount_percentage: offer.discount_percentage,
                    currency: offer.currency,
                    button_text: offer.button_text,
                    is_active: offer.is_active
                }])
                .select()

            if (error) {
                console.error('Error creating offer:', error)
                throw error
            }


            setShowModal(false)
            fetchOffers()
        } catch (error) {
            console.error('Error creating offer:', error)
            alert(t('funnels.offers.error_create') + (error as any).message)
        }
    }

    const handleEditOffer = async (updatedOffer: Offer) => {
        try {
            const { error } = await supabase
                .from('checkout_offers')
                .update({
                    title: updatedOffer.title,
                    description: updatedOffer.description,
                    original_price: updatedOffer.original_price,
                    offer_price: updatedOffer.offer_price,
                    discount_percentage: updatedOffer.discount_percentage,
                    button_text: updatedOffer.button_text,
                    is_active: updatedOffer.is_active
                })
                .eq('id', updatedOffer.id)

            if (error) throw error

            setEditingOffer(null)
            setShowModal(false)
            fetchOffers()
        } catch (error) {
            console.error('Error updating offer:', error)
        }
    }

    const handleDeleteOffer = async (offerId: string) => {
        if (!confirm(t('funnels.offers.confirm_delete'))) return

        try {
            const { error } = await supabase
                .from('checkout_offers')
                .delete()
                .eq('id', offerId)

            if (error) throw error
            fetchOffers()
        } catch (error) {
            console.error('Error deleting offer:', error)
        }
    }

    const handleToggleActive = async (offerId: string) => {
        const offer = offers.find(o => o.id === offerId)
        if (!offer) return

        try {
            const { error } = await supabase
                .from('checkout_offers')
                .update({ is_active: !offer.is_active })
                .eq('id', offerId)

            if (error) throw error
            fetchOffers()
        } catch (error) {
            console.error('Error toggling offer:', error)
        }
    }

    const openEditModal = (offer: Offer) => {
        setEditingOffer(offer)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingOffer(null)
    }

    const selectedFunnelData = funnels.find(f => f.id === selectedFunnel)
    const upsells = offers.filter(o => o.type === 'upsell')
    const downsells = offers.filter(o => o.type === 'downsell')
    const orderBumps = offers.filter(o => o.type === 'order_bump')

    return (
        <div className="space-y-6">
            {/* Funnel Selection - Only show if there are multiple funnels */}
            {funnels.length > 1 && (
                <div className="bg-white dark:bg-[#18181b] rounded-lg border border-gray-200 dark:border-[#3f3f46] p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('funnels.offers.select_funnel')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select
                            value={selectedFunnel}
                            onChange={(e) => setSelectedFunnel(e.target.value)}
                            className="w-full bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#4a5071]"
                        >
                            <option value="">{t('funnels.offers.choose_funnel')}</option>
                            {funnels.map((funnel) => (
                                <option key={funnel.id} value={funnel.id}>
                                    {funnel.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {!selectedFunnel ? (
                <div className="bg-white dark:bg-[#18181b] rounded-lg border border-gray-200 dark:border-[#3f3f46] p-12 text-center">
                    <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Edit className="text-gray-400" size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('funnels.offers.select_funnel_heading')}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('funnels.offers.select_funnel_desc')}
                    </p>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('funnels.offers.configure_title')}{selectedFunnelData?.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('funnels.offers.configure_subtitle')}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            disabled={!selectedFunnel}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg transition-colors border border-gray-300 dark:border-[#52525b] hover:border-gray-400 dark:hover:border-[#71717a]"
                        >
                            <Plus size={16} />
                            {t('funnels.offers.new_offer')}
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto"></div>
                        </div>
                    ) : (
                        <>
                            {/* Order Bumps */}
                            {orderBumps.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                        {t('funnels.offers.order_bumps')} ({orderBumps.length})
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {orderBumps.map(offer => (
                                            <OfferCard
                                                key={offer.id}
                                                offer={offer}
                                                onEdit={openEditModal}
                                                onDelete={handleDeleteOffer}
                                                onToggleActive={handleToggleActive}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upsells */}
                            {upsells.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        {t('funnels.offers.upsells')} ({upsells.length})
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {upsells.map(offer => (
                                            <OfferCard
                                                key={offer.id}
                                                offer={offer}
                                                onEdit={openEditModal}
                                                onDelete={handleDeleteOffer}
                                                onToggleActive={handleToggleActive}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Downsells */}
                            {downsells.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        {t('funnels.offers.downsells')} ({downsells.length})
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {downsells.map(offer => (
                                            <OfferCard
                                                key={offer.id}
                                                offer={offer}
                                                onEdit={openEditModal}
                                                onDelete={handleDeleteOffer}
                                                onToggleActive={handleToggleActive}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {offers.length === 0 && (
                                <div className="bg-white dark:bg-[#18181b] rounded-lg border border-gray-200 dark:border-[#3f3f46] p-12 text-center">
                                    <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Plus className="text-gray-400" size={24} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {t('funnels.offers.no_offers')}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                                        {t('funnels.offers.no_offers_hint')}
                                    </p>
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="inline-flex items-center gap-2 px-6 py-2 bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] text-gray-900 dark:text-white rounded-lg transition-colors border border-gray-300 dark:border-[#52525b] hover:border-gray-400 dark:hover:border-[#71717a]"
                                    >
                                        <Plus size={20} />
                                        {t('funnels.offers.create_first')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Modal */}
            {showModal && (
                <OfferModal
                    isOpen={showModal}
                    offer={editingOffer}
                    onSave={editingOffer ? handleEditOffer : handleAddOffer}
                    onClose={closeModal}
                    products={products}
                    funnelCurrency={selectedFunnelData?.currency || 'BRL'}
                />
            )}
        </div>
    )
}