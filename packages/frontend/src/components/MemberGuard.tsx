import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabaseFetch } from '@/services/supabase'

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

    const fetchAppSlug = async () => {
        if (!appId) return
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

    const checkAuthentication = async () => {
        try {
            setLoading(true)

            // Verificar customer_access_token (único token válido para clientes)
            const customerAccessToken = localStorage.getItem('customer_access_token')

            if (!customerAccessToken) {
                await fetchAppSlug()
                setIsAuthenticated(false)
                setLoading(false)
                return
            }

            // Verificar token com o backend
            const verifyResponse = await fetch('https://api.clicknich.com/api/customer-auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: customerAccessToken })
            })

            if (!verifyResponse.ok) {
                localStorage.removeItem('customer_access_token')
                localStorage.removeItem('customer_id')
                localStorage.removeItem('customer_email')
                await fetchAppSlug()
                setIsAuthenticated(false)
                setLoading(false)
                return
            }

            const verifyData = await verifyResponse.json()

            if (!verifyData.valid) {
                localStorage.removeItem('customer_access_token')
                localStorage.removeItem('customer_id')
                localStorage.removeItem('customer_email')
                await fetchAppSlug()
                setIsAuthenticated(false)
                setLoading(false)
                return
            }

            setIsAuthenticated(true)
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
