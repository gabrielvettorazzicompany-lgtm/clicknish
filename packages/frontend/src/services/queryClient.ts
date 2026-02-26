import { QueryClient } from '@tanstack/react-query'

// Configuração do React Query
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Tempo que os dados são considerados "frescos" (5 minutos)
            staleTime: 5 * 60 * 1000,
            // Tempo que os dados ficam no cache (10 minutos)
            gcTime: 10 * 60 * 1000,
            // Quantas tentativas em caso de erro
            retry: 1,
            // Não refetch automaticamente quando a janela ganha foco
            refetchOnWindowFocus: false,
            // Não refetch automaticamente quando reconecta
            refetchOnReconnect: false,
        },
    },
})