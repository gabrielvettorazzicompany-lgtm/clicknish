import { useState, useEffect } from 'react'
import { Eye, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/services/supabase'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'

interface FunnelProduct {
    id: string
    name: string
    price?: string
    app_type?: string
    source: string
}

interface Checkout {
    id: string
    name: string
}

interface CheckoutDetails {
    banner_image?: string
    banner_title?: string
    custom_height?: number
    custom_price?: number
    custom_fields?: any
}

interface Module {
    id: string
    title: string
    order_position?: number
    name?: string
}

interface ProductCheckoutCardProps {
    product: FunnelProduct | null
    loadingProduct: boolean
    checkouts: Checkout[]
    selectedCheckout: string
    loadingCheckouts: boolean
    savingCheckout: boolean
    onCheckoutChange: (checkoutId: string) => Promise<boolean>
    onUpdate: () => void
    pageId: string
}

export default function ProductCheckoutCard({
    product,
    loadingProduct,
    checkouts,
    selectedCheckout,
    loadingCheckouts,
    savingCheckout,
    onCheckoutChange,
    onUpdate,
    pageId
}: ProductCheckoutCardProps) {
    const [showPreview, setShowPreview] = useState(false)
    const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetails | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [modules, setModules] = useState<Module[]>([])
    const [selectedModules, setSelectedModules] = useState<string[]>([])
    const [loadingModules, setLoadingModules] = useState(false)
    const [savingModules, setSavingModules] = useState(false)
    const [showModules, setShowModules] = useState(false)

    // Fetch modules when product changes
    useEffect(() => {
        if (product) {
            fetchModules()
        }
    }, [product, pageId])

    const fetchModules = async () => {
        if (!product) return

        try {
            setLoadingModules(true)

            // Determine which table and field to query based on product type
            let modulesData: any[] = []

            if (product.source === 'member_area') {
                // For member areas, fetch from community_modules
                const { data, error } = await supabase
                    .from('community_modules')
                    .select('id, title, order_position')
                    .eq('member_area_id', product.id)
                    .order('order_position', { ascending: true })

                if (error) throw error
                modulesData = data || []
            } else if (product.source === 'application' || product.source === 'community') {
                // For applications, fetch products (modules) within the app
                const { data, error } = await supabase
                    .from('products')
                    .select('id, name')
                    .eq('application_id', product.id)
                    .order('name', { ascending: true })

                if (error) throw error
                modulesData = (data || []).map(item => ({
                    id: item.id,
                    title: item.name,
                    order_position: 0
                }))
            }

            setModules(modulesData)

            // Fetch saved selection from funnel_pages.settings
            const { data: pageData, error: pageError } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', pageId)
                .single()

            if (!pageError && pageData?.settings) {
                const settings = pageData.settings as any
                if (Array.isArray(settings.selected_modules)) {
                    setSelectedModules(settings.selected_modules)
                }
            }
        } catch (err) {
            console.error('Error loading modules:', err)
        } finally {
            setLoadingModules(false)
        }
    }

    const toggleModule = (moduleId: string) => {
        setSelectedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        )
    }

    const toggleAllModules = () => {
        if (selectedModules.length === modules.length) {
            setSelectedModules([])
        } else {
            setSelectedModules(modules.map(m => m.id))
        }
    }

    const handleSaveModules = async () => {
        try {
            setSavingModules(true)



            // Get current settings first
            const { data: pageData } = await supabase
                .from('funnel_pages')
                .select('settings, checkout_id')
                .eq('id', pageId)
                .single()



            const currentSettings = (pageData?.settings as any) || {}

            const newSettings = {
                ...currentSettings,
                selected_modules: selectedModules
            }



            const { error, data } = await supabase
                .from('funnel_pages')
                .update({
                    settings: newSettings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)
                .select('settings')

            if (error) throw error


            alert(`✅ ${selectedModules.length} modules saved successfully!`)

            onUpdate?.()
        } catch (err) {
            console.error('❌ Error saving modules:', err)
            alert('❌ Error saving modules: ' + (err as Error).message)
        } finally {
            setSavingModules(false)
        }
    }

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const success = await onCheckoutChange(e.target.value)
        if (success) {
            onUpdate()
        } else {
            alert('Erro ao vincular checkout')
        }
    }

    const handleOpenPreview = async () => {
        if (!selectedCheckout) return

        try {
            setLoadingPreview(true)
            const { data, error } = await supabase
                .from('checkouts')
                .select('banner_image, banner_title, custom_height, custom_price, custom_fields')
                .eq('id', selectedCheckout)
                .single()

            if (!error && data) {
                setCheckoutDetails(data)
            }
            setShowPreview(true)
        } catch (err) {
            console.error('Error loading checkout details:', err)
            setShowPreview(true)
        } finally {
            setLoadingPreview(false)
        }
    }

    const selectedCheckoutData = checkouts.find(c => c.id === selectedCheckout)
    const isCheckoutLinked = !!selectedCheckout && !!selectedCheckoutData
    const [isChangingCheckout, setIsChangingCheckout] = useState(false)

    const productPrice = checkoutDetails?.custom_price ?? (product?.price ? parseFloat(product.price) : 0)
    const timerConfig = checkoutDetails?.custom_fields?.timer

    return (
        <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
            {/* Main Product */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-medium text-gray-900 dark:text-white">
                        Main Product
                    </h3>

                    {isCheckoutLinked && (
                        <button
                            onClick={handleOpenPreview}
                            disabled={loadingPreview}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white rounded text-xs transition-all disabled:opacity-50"
                            title="Preview Checkout"
                        >
                            <Eye size={13} />
                            Preview
                        </button>
                    )}
                </div>

                {loadingProduct ? (
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Loading...</p>
                ) : product ? (
                    <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded p-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-gray-900 dark:text-white text-sm font-medium">{product.name}</h4>
                            <span className="px-2.5 py-1 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-full text-xs font-medium">
                                Main
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        <p className="text-xs text-yellow-400">
                            No main product configured for this funnel.
                        </p>
                        <p className="text-xs text-zinc-400 mt-1.5">
                            Configure the product when editing the funnel.
                        </p>
                    </div>
                )}
            </div>

            {/* Checkout */}
            <div>
                <label className="text-xs font-medium text-white mb-3 block">
                    Checkout
                </label>

                {loadingCheckouts ? (
                    <p className="text-xs text-zinc-400">Loading checkouts...</p>
                ) : isCheckoutLinked && !isChangingCheckout ? (
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded text-xs text-gray-900 dark:text-white">
                                {selectedCheckoutData.name}
                            </div>
                            <button
                                onClick={() => setIsChangingCheckout(true)}
                                className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white rounded text-xs transition-all"
                            >
                                Change
                            </button>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                            <span>Checkout linked to this page</span>
                        </div>
                    </div>
                ) : (
                    <div>
                        <select
                            value={selectedCheckout}
                            onChange={(e) => {
                                handleChange(e)
                                setIsChangingCheckout(false)
                            }}
                            disabled={savingCheckout || checkouts.length === 0}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Select a checkout...</option>
                            {checkouts.map((checkout) => (
                                <option key={checkout.id} value={checkout.id}>
                                    {checkout.name}
                                </option>
                            ))}
                        </select>
                        {isChangingCheckout && (
                            <button
                                onClick={() => setIsChangingCheckout(false)}
                                className="mt-2 text-xs text-zinc-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}

                {checkouts.length === 0 && !loadingCheckouts && !isCheckoutLinked && (
                    <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                        <p className="text-xs text-yellow-400">
                            No checkouts available. Create one in Checkout Builder first.
                        </p>
                    </div>
                )}

                {savingCheckout && (
                    <div className="mt-2 text-xs text-zinc-400">
                        Saving...
                    </div>
                )}
            </div>

            {/* Modules Section */}
            {product && modules.length > 0 && (
                <div className="border-t border-zinc-800 pt-4">
                    <button
                        onClick={() => setShowModules(!showModules)}
                        className="flex items-center justify-between w-full p-3 mb-3 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/50 hover:border-zinc-600 transition-all duration-200"
                    >
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-medium text-white">Unlocked Modules</h3>
                            {selectedModules.length > 0 && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium">
                                    {selectedModules.length}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-400">
                                {showModules ? 'Hide' : 'Configure'}
                            </span>
                            {showModules ? (
                                <ChevronUp className="w-4 h-4 text-zinc-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-zinc-400" />
                            )}
                        </div>
                    </button>

                    {!showModules && (
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 mb-2">
                            {selectedModules.length > 0
                                ? `${selectedModules.length} modules selected`
                                : 'Click to select modules'
                            }
                        </p>
                    )}

                    {showModules && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                                    Select modules to unlock after purchase
                                </p>
                                <button
                                    onClick={toggleAllModules}
                                    className="text-[10px] text-gray-600 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300 transition-colors"
                                >
                                    {selectedModules.length === modules.length ? 'Unselect all' : 'Select all'}
                                </button>
                            </div>

                            {loadingModules ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {modules.map(mod => {
                                            const isSelected = selectedModules.includes(mod.id)
                                            return (
                                                <label
                                                    key={mod.id}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected
                                                        ? 'bg-blue-500/10 border border-blue-500/30'
                                                        : 'bg-gray-100 dark:bg-zinc-800/50 border border-transparent hover:bg-gray-200 dark:hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleModule(mod.id)}
                                                        className="sr-only"
                                                    />
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                        ? 'bg-blue-500 text-white'
                                                        : 'border border-gray-300 dark:border-zinc-600 bg-transparent'
                                                        }`}>
                                                        {isSelected && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                                                        {mod.title}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>

                                    <button
                                        onClick={handleSaveModules}
                                        disabled={savingModules}
                                        className="mt-3 w-full py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                    >
                                        {savingModules ? 'Saving...' : 'Save selection'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Full Preview */}
            {showPreview && product && (
                <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
                    <button
                        onClick={() => setShowPreview(false)}
                        className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-slate-800 rounded-md transition-all text-sm font-medium shadow-xl"
                    >
                        <X size={16} />
                        Close Preview
                    </button>

                    <div className="min-h-screen">
                        <CheckoutDigital
                            productId={product.id}
                            productName={product.name}
                            productPrice={productPrice}
                            productDescription=""
                            customBanner={checkoutDetails ? {
                                image: checkoutDetails.banner_image,
                                title: checkoutDetails.banner_title,
                                customHeight: checkoutDetails.custom_height
                            } : undefined}
                            timerConfig={timerConfig}
                            isPreview={true}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
