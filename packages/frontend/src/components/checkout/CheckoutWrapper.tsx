import { lazy, Suspense } from 'react'
import { CheckoutDigitalProps } from './types'

// ✅ LAZY LOADING: Componentes pesados só carregam quando necessário
const CheckoutDigital = lazy(() => import('./CheckoutDigital'))

// ✅ PRELOADING: Carregar componentes em background
const preloadComponents = () => {
    // Preload quando usuário hover no botão de checkout
    import('./CheckoutDigital')
    import('./PaymentForm')
    import('./OrderSummary')
}

// ✅ SKELETON: Loading states otimizados
const CheckoutSkeleton = () => (
    <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-100 h-16 flex items-center px-4">
            <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* Main Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="lg:grid lg:grid-cols-5 lg:gap-8">
                {/* Form Skeleton */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-xl p-6 space-y-4">
                        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                        <div className="space-y-3">
                            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <div className="h-12 bg-blue-200 rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Summary Skeleton */}
                <div className="hidden lg:block lg:col-span-2">
                    <div className="bg-white rounded-xl p-6 space-y-4">
                        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                        <div className="border-t pt-4">
                            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

// ✅ COMPONENT PRINCIPAL: Wrapper otimizado com lazy loading
interface CheckoutWrapperProps extends CheckoutDigitalProps {
    enablePreloading?: boolean
}

const CheckoutWrapper = ({ enablePreloading = true, ...props }: CheckoutWrapperProps) => {
    return (
        <Suspense fallback={<CheckoutSkeleton />}>
            <CheckoutDigital {...props} />
        </Suspense>
    )
}

// ✅ EXPORT: Preload functions para usar externamente
export { preloadComponents, CheckoutSkeleton }
export default CheckoutWrapper