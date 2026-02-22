import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/services/supabase'
import CheckoutDigitalComponent from '@/components/checkout/CheckoutDigital'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    price: number
    description: string
    image_url?: string
    currency?: string
}

function CheckoutDigital() {
    const { productId } = useParams()
    const navigate = useNavigate()
    const { t } = useI18n()
    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) {
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('id', productId)
                    .single()

                if (error) throw error

                setProduct(data)
            } catch (error) {
                console.error('Error fetching product:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProduct()
    }, [productId])

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">{t('checkout_pages.loading_checkout')}</p>
                </div>
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('checkout_pages.product_not_found')}</h1>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-500 hover:text-blue-600"
                    >
                        {t('checkout_pages.go_back')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <CheckoutDigitalComponent
            productId={product.id}
            productType="marketplace"
            productName={product.name}
            productPrice={product.price}
            productCurrency={product.currency || 'USD'}
            productImage={product.image_url}
            productDescription={product.description}
            onBack={() => navigate(-1)}
        />
    )
}

export default CheckoutDigital
