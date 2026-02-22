import { useCallback } from 'react'

// Mapear rotas para seus respectivos imports lazy
const routeImports: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('../pages/Dashboard'),
    '/customers': () => import('../pages/Customers'),
    '/orders': () => import('../pages/Orders'),
    '/products': () => import('../pages/products/ProductsManagement'),
    '/checkouts': () => import('../pages/Checkouts'),
    '/funnels': () => import('../pages/Funnels'),
    '/finance': () => import('../pages/Finance'),
    '/taxes': () => import('../pages/Taxes'),
    '/marketplace': () => import('../pages/marketplace/Marketplace'),
    '/integrations': () => import('../pages/Integrations'),
    '/admin': () => import('../pages/settings/AdminSettings'),
}

// Cache para evitar múltiplos prefetches da mesma rota
const prefetchedRoutes = new Set<string>()

export function usePrefetch() {
    const prefetch = useCallback((path: string) => {
        // Se já foi prefetched, ignorar
        if (prefetchedRoutes.has(path)) {
            return
        }

        // Buscar a função de import para esta rota
        const importFn = routeImports[path]

        if (importFn) {
            // Marcar como prefetched antes de iniciar
            prefetchedRoutes.add(path)

            // Fazer o prefetch (o webpack/vite vai cachear automaticamente)
            importFn().catch((err) => {
                // Se falhar, remover do cache para tentar novamente depois
                prefetchedRoutes.delete(path)
                console.warn(`Failed to prefetch ${path}:`, err)
            })
        }
    }, [])

    return { prefetch }
}
