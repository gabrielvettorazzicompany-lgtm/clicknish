import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Eye, Trash2, Check, Clock, Upload, GripVertical, Pencil } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { useFunnelProduct } from '@/hooks/useFunnelProduct'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OffersConfiguration from '@/components/funnel/OffersConfiguration'
import CreatePageModal from '@/components/funnel/modals/CreatePageModal'
import PageConfig from '@/components/funnel/PageConfig'

interface FunnelPage {
    id: string
    name: string
    slug: string
    page_type: string
    position: number
    is_published: boolean
    external_url?: string | null
}

interface Funnel {
    id: string
    name: string
    slug: string
    status: string
    currency: string
    objective: string
}

export default function FunnelEditor() {
    const { t } = useI18n()
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [funnel, setFunnel] = useState<Funnel | null>(null)
    const [pages, setPages] = useState<FunnelPage[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
    const [selectedPage, setSelectedPage] = useState<FunnelPage | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showCreatePageModal, setShowCreatePageModal] = useState(false)
    const [creatingPage, setCreatingPage] = useState(false)
    const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
    const [dragOverPageId, setDragOverPageId] = useState<string | null>(null)
    const [isEditingName, setIsEditingName] = useState(false)
    const [editingName, setEditingName] = useState('')

    // Fetch funnel product
    const { product } = useFunnelProduct(id || '', !!id)

    useEffect(() => {
        if (id && user) {
            fetchFunnel()
            fetchPages()
        }
    }, [id, user])

    const fetchFunnel = async () => {
        try {
            const { data, error } = await supabase
                .from('funnels')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            setFunnel(data)
        } catch (error) {
            console.error('Error fetching funnel:', error)
        }
    }

    const fetchPages = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('funnel_pages')
                .select('*')
                .eq('funnel_id', id)
                .order('position', { ascending: true })

            if (error) throw error

            let pages = data || []



            // Check if checkout page exists, create automatically if not
            const hasCheckoutPage = pages.some(p => p.page_type === 'checkout')

            if (!hasCheckoutPage) {

                const { data: newCheckoutPage, error: createError } = await supabase
                    .from('funnel_pages')
                    .insert([{
                        funnel_id: id,
                        name: 'Checkout',
                        slug: 'checkout',
                        page_type: 'checkout',
                        position: 0,
                        is_published: false
                    }])
                    .select()
                    .single()

                if (createError) {
                    console.error('Error creating checkout page:', createError)
                } else if (newCheckoutPage) {

                    pages = [newCheckoutPage, ...pages]
                }
            }


            setPages(pages)

            // Sync selectedPage with updated data
            if (selectedPageId) {
                const updatedSelected = pages.find(p => p.id === selectedPageId)
                if (updatedSelected) {
                    setSelectedPage(updatedSelected)
                }
            }
        } catch (error) {
            console.error('Error fetching pages:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectPage = (page: FunnelPage) => {
        setSelectedPageId(page.id)
        setSelectedPage(page)
    }

    const handleSaveFunnelName = async () => {
        if (!editingName.trim() || editingName === funnel?.name) {
            setIsEditingName(false)
            return
        }

        try {
            const { error } = await supabase
                .from('funnels')
                .update({ name: editingName.trim() })
                .eq('id', id)

            if (error) throw error

            setFunnel(prev => prev ? { ...prev, name: editingName.trim() } : null)
            setIsEditingName(false)
        } catch (error) {
            console.error('Error updating funnel name:', error)
            alert('Erro ao atualizar nome do funil')
        }
    }

    const handlePublishFunnel = async () => {
        try {
            // Validate if checkout page is configured
            const checkoutPage = pages.find(p => p.page_type === 'checkout')
            if (!checkoutPage) {
                alert('The funnel needs to have a checkout page')
                return
            }

            // Check if the checkout page has a linked checkout
            const { data: checkoutPageData, error: checkoutError } = await supabase
                .from('funnel_pages')
                .select('checkout_id')
                .eq('id', checkoutPage.id)
                .single()

            if (checkoutError) throw checkoutError

            if (!checkoutPageData?.checkout_id) {
                alert('Configure a checkout on the checkout page before publishing the funnel')
                return
            }

            // Confirm publication
            if (!confirm('Publish the funnel? This will make it active and accessible.')) {
                return
            }

            // Update funnel status to active
            const { error: funnelError } = await supabase
                .from('funnels')
                .update({ status: 'active' })
                .eq('id', id)

            if (funnelError) throw funnelError

            // Publish all funnel pages
            const { error: pagesError } = await supabase
                .from('funnel_pages')
                .update({ is_published: true })
                .eq('funnel_id', id)

            if (pagesError) throw pagesError



            // Reload data
            await fetchFunnel()
            await fetchPages()

            alert('Funnel published successfully! 🎉')
        } catch (error) {
            console.error('Error publishing funnel:', error)
            alert('Error publishing funnel')
        }
    }
    const handleCreatePage = async (pageData: { name: string; pageType: string }) => {
        try {
            setCreatingPage(true)

            // Generate slug based on name
            const slug = pageData.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')

            // Calculate new page position (add at the end)
            const maxPosition = pages.length > 0 ? Math.max(...pages.map(p => p.position)) : 0
            const newPagePosition = maxPosition + 1

            const newPage = {
                funnel_id: id,
                name: pageData.name,
                slug: slug,
                page_type: pageData.pageType,
                position: newPagePosition,
                is_published: false
            }

            const { data, error } = await supabase
                .from('funnel_pages')
                .insert([newPage])
                .select()
                .single()

            if (error) throw error

            // Reload all pages to get updated positions
            await fetchPages()
            return true
        } catch (error) {
            console.error('Error creating page:', error)
            return false
        } finally {
            setCreatingPage(false)
        }
    }

    const handleDeletePage = async (pageId: string, pageName: string) => {
        if (!confirm(`Delete step "${pageName}"? This action cannot be undone.`)) return

        try {
            // Delete related checkout_offers first
            await supabase
                .from('checkout_offers')
                .delete()
                .eq('page_id', pageId)

            const { error } = await supabase
                .from('funnel_pages')
                .delete()
                .eq('id', pageId)

            if (error) throw error

            // If deleted page was selected, deselect
            if (selectedPageId === pageId) {
                setSelectedPageId(null)
                setSelectedPage(null)
            }

            await fetchPages()
        } catch (error) {
            console.error('Error deleting page:', error)
            alert('Error deleting page')
        }
    }

    const handlePageDragStart = (e: React.DragEvent, pageId: string) => {
        setDraggedPageId(pageId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handlePageDragOver = (e: React.DragEvent, pageId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (pageId !== draggedPageId) {
            setDragOverPageId(pageId)
        }
    }

    const handlePageDragEnd = async () => {
        if (!draggedPageId || !dragOverPageId || draggedPageId === dragOverPageId) {
            setDraggedPageId(null)
            setDragOverPageId(null)
            return
        }

        const currentPages = [...pages]
        const draggedIndex = currentPages.findIndex(p => p.id === draggedPageId)
        const targetIndex = currentPages.findIndex(p => p.id === dragOverPageId)

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedPageId(null)
            setDragOverPageId(null)
            return
        }

        // Reorder locally
        const [removed] = currentPages.splice(draggedIndex, 1)
        currentPages.splice(targetIndex, 0, removed)

        // Update positions
        const reorderedPages = currentPages.map((p, i) => ({ ...p, position: i }))
        setPages(reorderedPages)

        setDraggedPageId(null)
        setDragOverPageId(null)

        // Save new positions to DB
        try {
            await Promise.all(
                reorderedPages.map(p =>
                    supabase
                        .from('funnel_pages')
                        .update({ position: p.position })
                        .eq('id', p.id)
                )
            )
        } catch (error) {
            console.error('Error saving page order:', error)
            await fetchPages() // Revert on error
        }
    }

    const getPageIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            landing: 'LP',
            checkout: 'CO',
            thankyou: 'TY',
            upsell: 'UP',
            downsell: 'DN',
            custom: 'CS'
        }
        return icons[type] || ''
    }

    const getPageLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            landing: 'Landing Page',
            checkout: 'Checkout Page',
            thankyou: 'Thank You Page',
            upsell: 'Upsell',
            downsell: 'Downsell',
            custom: 'Custom Page'
        }
        return labels[type] || type
    }

    if (!funnel) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header onMenuClick={() => setSidebarOpen(true)} />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex">
            {/* Background glow orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-hidden pt-16">
                    {/* Funnel Header */}
                    <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.06] px-4 py-2.5">
                        <div className="max-w-[1920px] mx-auto">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <button
                                        onClick={() => navigate('/funnels')}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                                    >
                                        <ArrowLeft size={17} />
                                    </button>
                                </div>
                                <div className="flex flex-col items-center">
                                    {isEditingName ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onBlur={handleSaveFunnelName}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveFunnelName()
                                                if (e.key === 'Escape') {
                                                    setIsEditingName(false)
                                                    setEditingName(funnel.name)
                                                }
                                            }}
                                            autoFocus
                                            className="text-sm font-semibold text-gray-900 dark:text-white leading-tight bg-transparent border-b border-blue-500 outline-none px-0 py-0 text-center"
                                        />
                                    ) : (
                                        <h1
                                            className="text-sm font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-2 cursor-pointer group"
                                            onClick={() => {
                                                setEditingName(funnel.name)
                                                setIsEditingName(true)
                                            }}
                                        >
                                            {funnel.name}
                                            <Pencil size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                        </h1>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                        {product?.name || 'Sem produto'} · {funnel.currency}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Status Badge */}
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${funnel.status === 'active'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                        }`}>
                                        {funnel.status === 'active' ? (
                                            <><Check size={11} /> {t('clients.active')}</>
                                        ) : (
                                            <><Clock size={11} /> {t('notifications_management.draft')}</>
                                        )}
                                    </span>

                                    {/* Publish Button */}
                                    <button
                                        onClick={handlePublishFunnel}
                                        className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                                    >
                                        <Upload size={13} />
                                        {t('funnel_editor.publish')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[calc(100vh-140px)]">
                        {/* Steps Sidebar */}
                        <div className="w-64 bg-white/60 dark:bg-white/[0.015] border-r border-gray-200 dark:border-white/[0.06] overflow-y-auto backdrop-blur-xl">
                            <div className="p-3 space-y-1">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : (
                                    <>
                                        {pages
                                            .filter(page => page.page_type !== 'custom')
                                            .map((page) => (
                                                <button
                                                    key={page.id}
                                                    onClick={() => handleSelectPage(page)}
                                                    draggable
                                                    onDragStart={(e) => handlePageDragStart(e, page.id)}
                                                    onDragOver={(e) => handlePageDragOver(e, page.id)}
                                                    onDragEnd={handlePageDragEnd}
                                                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all group ${dragOverPageId === page.id
                                                        ? 'bg-blue-500/10 border border-blue-500/30'
                                                        : selectedPageId === page.id
                                                            ? 'bg-blue-500/10 border border-blue-500/20'
                                                            : 'border border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                                                        } ${draggedPageId === page.id ? 'opacity-40' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-500 transition-colors flex-shrink-0">
                                                            <GripVertical size={13} />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-medium truncate ${selectedPageId === page.id
                                                                ? 'text-blue-400'
                                                                : 'text-gray-900 dark:text-gray-100'
                                                                }`}>
                                                                {page.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                                                {getPageLabel(page.page_type)}
                                                            </p>
                                                        </div>

                                                        {page.page_type !== 'checkout' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeletePage(page.id, page.name)
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-600 hover:text-red-400 transition-all rounded hover:bg-red-500/10 flex-shrink-0"
                                                                title={t('common.delete')}
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}

                                        <button
                                            onClick={() => setShowCreatePageModal(true)}
                                            className="w-full mt-1 p-2.5 rounded-lg border border-dashed border-gray-300 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-400"
                                        >
                                            <Plus size={13} />
                                            <span className="font-medium">{t('funnel_editor.add_page')}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Main Config Area */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-transparent">
                            {selectedPage && (
                                <PageConfig
                                    key={selectedPage.id}
                                    page={selectedPage}
                                    funnelId={id!}
                                    onUpdate={fetchPages}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Create Page Modal */}
            <CreatePageModal
                isOpen={showCreatePageModal}
                creating={creatingPage}
                onClose={() => setShowCreatePageModal(false)}
                onSubmit={handleCreatePage}
            />
        </div>
    )
}
