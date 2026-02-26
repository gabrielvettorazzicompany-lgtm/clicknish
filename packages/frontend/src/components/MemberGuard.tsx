import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase, supabaseFetch } from '@/services/supabase'

interface MemberGuardProps {
    children: React.ReactNode
}

export default function MemberGuard({ children }: MemberGuardProps) {
    const { appId } = useParams()
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const [appSlug, setAppSlug] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkAuthentication()
    }, [appId])

    const checkAuthentication = async () => {
        try {
            setLoading(true)

            // 1. Verificar sessão real do Supabase Auth
            const { data: { user }, error: authError } = await supabase.auth.getUser()

            if (!authError && user) {
                // Usuário autenticado via Supabase Auth
                setIsAuthenticated(true)
                setLoading(false)
                return
            }

            // 2. Verificar se tem tokens válidos no localStorage para restaurar sessão
            const accessToken = localStorage.getItem('access_token')
            const refreshToken = localStorage.getItem('refresh_token')

            if (accessToken && refreshToken && !accessToken.startsWith('member_') && !accessToken.startsWith('mock_')) {
                // Tentar restaurar sessão
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                })

                if (!sessionError) {
                    const { data: { user: restoredUser } } = await supabase.auth.getUser()
                    if (restoredUser) {
                        setIsAuthenticated(true)
                        setLoading(false)
                        return
                    }
                }
            }

            // 3. Não autenticado - buscar slug do app para redirect
            if (appId) {
                try {
                    const appResponse = await supabaseFetch(`applications/${appId}`)
                    if (appResponse.ok) {
                        const appData = await appResponse.json()
                        setAppSlug(appData.slug || appId)
                    } else {
                        setAppSlug(appId)
                    }
                } catch {
                    setAppSlug(appId)
                }
            }

            setIsAuthenticated(false)
            setLoading(false)

        } catch (error) {
            console.error('Error checking authentication:', error)
            setIsAuthenticated(false)
            setAppSlug(appId || '')
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-lg font-medium">Verificando acesso...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        // Redirecionar para página de login/acesso do app
        return <Navigate to={`/access/${appSlug}`} replace />
    }

    return <>{children}</>
}
