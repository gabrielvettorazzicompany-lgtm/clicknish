import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Suspense } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Componente de loading para rotas protegidas
const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#080b14]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-600 dark:text-gray-400">Carregando...</p>
    </div>
  </div>
)

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return <RouteLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      {children}
    </Suspense>
  )
}
