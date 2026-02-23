import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { supabase, supabaseRestFetch } from '@/services/supabase'

interface ProductGuardProps {
  children: React.ReactNode
}

interface UserAccess {
  has_access: boolean
  user_id: string
  user_email: string
  purchase_date: string
  expires_at?: string
}

export default function ProductGuard({ children }: ProductGuardProps) {
  const { appId, appSlug, productSlug, productId } = useParams()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvedAppSlug, setResolvedAppSlug] = useState<string>('')

  useEffect(() => {
    checkAccess()
  }, [appId, appSlug, productSlug, productId])

  const checkAccess = async () => {
    try {
      setLoading(true)
      setError('')

      // Resolver slug do app se necessário
      if (appId && !appSlug) {
        try {
          const appResponse = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${appId}`, {
            headers: {
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`
            }
          })
          if (appResponse.ok) {
            const appData = await appResponse.json()
            setResolvedAppSlug(appData.slug)
          }
        } catch (err) {
          console.warn('Erro ao buscar dados do app')
          setResolvedAppSlug('app1')
        }
      }

      // 1. Verificar sessão real do Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        // Fallback: verificar localStorage (compatibilidade)
        const accessToken = localStorage.getItem('access_token')
        if (!accessToken) {
          setError('No access token found')
          setLoading(false)
          return
        }

        // Se tem token no localStorage mas não sessão, tentar restaurar
        const refreshToken = localStorage.getItem('refresh_token')
        if (accessToken && refreshToken && !accessToken.startsWith('member_') && !accessToken.startsWith('mock_')) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            setError('Invalid session')
            setLoading(false)
            return
          }

          // Tentar obter usuário novamente
          const { data: { user: restoredUser } } = await supabase.auth.getUser()
          if (restoredUser) {
            await verifyProductAccess(restoredUser.id, restoredUser.email || '')
            return
          }
        }

        // Tokens antigos (mock/member_) não são mais suportados - exigir re-login
        setError('Invalid session - please login again')
        setLoading(false)
        return
      }

      // 2. Verificar acesso ao produto específico
      await verifyProductAccess(user.id, user.email || '')

    } catch (error) {
      console.error('Error checking access:', error)
      setError('Error validating session')
      setLoading(false)
    }
  }

  const verifyProductAccess = async (userId: string, userEmail: string) => {
    try {
      // Se não há productId específico, só verificar se tem sessão válida
      if (!productId && !productSlug) {
        setAccess({
          has_access: true,
          user_id: userId,
          user_email: userEmail,
          purchase_date: new Date().toISOString()
        })
        setLoading(false)
        return
      }

      // Verificar acesso ao produto na tabela user_product_access
      // A RLS policy vai garantir que só retorna se user_id = auth.uid()
      let query = `user_product_access?user_id=eq.${userId}&is_active=eq.true&select=id,product_id,created_at,expires_at`

      if (productId) {
        query += `&product_id=eq.${productId}`
      }

      if (appId) {
        query += `&application_id=eq.${appId}`
      }

      const response = await supabaseRestFetch(query)

      if (response.ok) {
        const accessData = await response.json()

        if (accessData && accessData.length > 0) {
          // Verificar se não expirou
          const accessRecord = accessData[0]
          if (accessRecord.expires_at) {
            const expiresAt = new Date(accessRecord.expires_at)
            if (expiresAt < new Date()) {
              setAccess({
                has_access: false,
                user_id: userId,
                user_email: userEmail,
                purchase_date: accessRecord.created_at,
                expires_at: accessRecord.expires_at
              })
              setLoading(false)
              return
            }
          }

          setAccess({
            has_access: true,
            user_id: userId,
            user_email: userEmail,
            purchase_date: accessRecord.created_at,
            expires_at: accessRecord.expires_at
          })
        } else {
          // Sem registro de acesso
          setAccess({
            has_access: false,
            user_id: userId,
            user_email: userEmail,
            purchase_date: new Date().toISOString()
          })
        }
      } else {
        // Erro na query - pode ser RLS bloqueando
        setAccess({
          has_access: false,
          user_id: userId,
          user_email: userEmail,
          purchase_date: new Date().toISOString()
        })
      }

      setLoading(false)
    } catch (err) {
      console.error('Error verifying product access:', err)
      setAccess({
        has_access: false,
        user_id: userId,
        user_email: userEmail,
        purchase_date: new Date().toISOString()
      })
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">Checking access...</p>
          <p className="text-blue-200 text-sm mt-2">Please wait a moment</p>
        </div>
      </div>
    )
  }

  if (error || !access) {
    // Se estamos no dashboard geral (appId), redirecionar para acesso geral
    const targetSlug = appSlug || resolvedAppSlug || 'appclustessas'
    if (appId) {
      return <Navigate to={`/access/${targetSlug}`} replace />
    }
    // Se é produto específico
    return <Navigate to={`/access/${targetSlug}/${productSlug}`} replace />
  }

  if (!access.has_access) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d2e] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You do not have permission to access this product.
            Please check if your purchase was processed correctly.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                const targetSlug = appSlug || resolvedAppSlug || 'appclustessas'
                if (appId) {
                  window.location.href = `/access/${targetSlug}`
                } else {
                  window.location.href = `/access/${targetSlug}/${productSlug}`
                }
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
            >
              Retry Access
            </button>
            <a
              href="#support"
              className="block text-blue-400 hover:text-blue-700 font-medium text-sm"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Exibir informações de acesso válido brevemente
  if (access.has_access) {
    return (
      <>
        {children}
      </>
    )
  }

  const targetSlug = appSlug || resolvedAppSlug || 'appclustessas'
  return <Navigate to={appId ? `/access/${targetSlug}` : `/access/${targetSlug}/${productSlug}`} replace />
}