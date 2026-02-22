import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { Package, Check } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Module {
    id: string
    title: string
    order_position?: number
    name?: string
}

interface Product {
    id: string
    name: string
    source: string
}

interface ModuleSelectorProps {
    product: Product
    pageId: string
    onUpdate?: () => void
}

export default function ModuleSelector({ product, pageId, onUpdate }: ModuleSelectorProps) {
    const { t } = useI18n()
    const [modules, setModules] = useState<Module[]>([])
    const [selectedModules, setSelectedModules] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchData()
    }, [product.id, pageId])

    const fetchData = async () => {
        try {
            setLoading(true)

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
            setLoading(false)
        }
    }

    const toggleModule = (moduleId: string) => {
        setSelectedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        )
    }

    const toggleAll = () => {
        if (selectedModules.length === modules.length) {
            setSelectedModules([])
        } else {
            setSelectedModules(modules.map(m => m.id))
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)

            // Get current settings first
            const { data: pageData } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', pageId)
                .single()

            const currentSettings = (pageData?.settings as any) || {}

            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    settings: {
                        ...currentSettings,
                        selected_modules: selectedModules
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)

            if (error) throw error
            onUpdate?.()
        } catch (err) {
            console.error('Error saving modules:', err)
            alert(t('funnel_components.module_selector.error_saving'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-xs font-medium text-white">{t('funnel_components.module_selector.title')}</h3>
                </div>
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                </div>
            </div>
        )
    }

    if (modules.length === 0) return null

    const allSelected = selectedModules.length === modules.length

    return (
        <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
                    <h3 className="text-xs font-medium text-gray-900 dark:text-white">{t('funnel_components.module_selector.title')}</h3>
                </div>
                <button
                    onClick={toggleAll}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    {allSelected ? t('funnel_components.module_selector.deselect_all') : t('funnel_components.module_selector.select_all')}
                </button>
            </div>

            <p className="text-[10px] text-zinc-500 mb-3">
                {t('funnel_components.module_selector.description')}
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {modules.map(mod => {
                    const isSelected = selectedModules.includes(mod.id)
                    return (
                        <label
                            key={mod.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected
                                ? 'bg-blue-500/10 border border-blue-500/30'
                                : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                                }`}
                        >
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                ? 'bg-blue-500 text-white'
                                : 'border border-zinc-600 bg-transparent'
                                }`}>
                                {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-xs text-zinc-300 truncate">{mod.title}</span>
                        </label>
                    )
                })}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-3 w-full py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
            >
                {saving ? t('common.saving') : t('funnel_components.module_selector.save_selection')}
            </button>
        </div>
    )
}
