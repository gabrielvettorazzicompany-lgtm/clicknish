import { useEffect, useState, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

// Lista de super admins autorizados
const SUPER_ADMINS = [
    'admin@exemplo.com', // Usuário de teste - Senha: admin123
    'teste@exemplo.com',
    'gabrielvettorazzii@gmail.com'
]

interface SuperAdminRouteProps {
    children: React.ReactNode
}

// Componente de loading para super admin routes
const SuperAdminLoader = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            <p className="text-sm text-white/80">Carregando...</p>
        </div>
    </div>
)

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
    const { user, loading } = useAuthStore()
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

    useEffect(() => {
        const checkSuperAdmin = async () => {
            if (!user) {
                setIsAuthorized(false)
                return
            }

            // Verificar se o email do usuário está na lista de super admins
            const isSuperAdmin = SUPER_ADMINS.includes(user.email || '')
            setIsAuthorized(isSuperAdmin)
        }

        if (!loading) {
            checkSuperAdmin()
        }
    }, [user, loading])

    // Ainda carregando
    if (loading || isAuthorized === null) {
        return <SuperAdminLoader />
    }

    // Não está logado ou não é super admin - redirecionar para login do super admin
    if (!user || !isAuthorized) {
        return <Navigate to="/super-login" replace />
    }

    // Usuário autorizado - mostrar conteúdo
    return (
        <Suspense fallback={<SuperAdminLoader />}>
            {children}
        </Suspense>
    )
}