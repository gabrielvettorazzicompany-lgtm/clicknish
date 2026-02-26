import { useEffect, useState } from 'react'
import { Select, SelectItem } from '@heroui/react'
import { supabase } from '@/services/supabase'
import { Package } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    type: 'marketplace' | 'app'
}

interface ProductSelectorProps {
    selectedProduct: string
    onProductChange: (productId: string) => void
}

export default function ProductSelector({ selectedProduct, onProductChange }: ProductSelectorProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const { t } = useI18n()

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // Buscar produtos do marketplace
                const { data: memberAreas } = await supabase
                    .from('member_areas')
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .order('name')

                // Buscar apps
                const { data: apps } = await supabase
                    .from('applications')
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .order('name')

                const allProducts: Product[] = [
                    ...(memberAreas || []).map(p => ({ id: p.id, name: p.name, type: 'marketplace' as const })),
                    ...(apps || []).map(p => ({ id: p.id, name: p.name, type: 'app' as const }))
                ]

                setProducts(allProducts)
            } catch (error) {
                console.error('Error fetching products:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProducts()
    }, [])

    return (
        <Select
            size="sm"
            radius="lg"
            selectedKeys={[selectedProduct]}
            onChange={(e) => onProductChange(e.target.value)}
            startContent={<Package className="w-4 h-4 text-gray-400" />}
            classNames={{
                base: "w-64",
                trigger: "h-8 min-h-8 bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-200 dark:border-white/10 data-[hover=true]:bg-white dark:data-[hover=true]:bg-white/5",
                value: "text-xs text-gray-600 dark:text-gray-300",
                popoverContent: "bg-white dark:bg-[#0c0f1a] border border-gray-200 dark:border-white/10",
                selectorIcon: "hidden",
            }}
            aria-label={t('orders.product_selector.label')}
            isLoading={loading}
            items={[{ id: 'all', name: t('orders.product_selector.all'), type: 'all' as const }, ...products]}
        >
            {(item) => (
                <SelectItem
                    key={item.id}
                    className="text-gray-300"
                    textValue={item.name}
                >
                    {item.type === 'all' ? (
                        item.name
                    ) : (
                        <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="text-[10px] text-gray-500">
                                {item.type === 'marketplace' ? t('orders.product_selector.marketplace') : t('orders.product_selector.app')}
                            </span>
                        </div>
                    )}
                </SelectItem>
            )}
        </Select>
    )
}
