import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SuperAdminRoute from '@/components/SuperAdminRoute'

const SuperAdminLogin = lazy(() => import('@/pages/admin/SuperAdminLogin'))
const SuperAdminForgotPassword = lazy(() => import('@/pages/admin/SuperAdminForgotPassword'))
const SuperAdminResetPassword = lazy(() => import('@/pages/admin/SuperAdminResetPassword'))
const SuperAdmin = lazy(() => import('@/pages/admin/SuperAdmin'))

const Loader = () => (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
)

export default function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<Loader />}>
                <Routes>
                    <Route path="/login" element={<SuperAdminLogin />} />
                    <Route path="/login/forgot-password" element={<SuperAdminForgotPassword />} />
                    <Route path="/login/reset-password" element={<SuperAdminResetPassword />} />
                    <Route
                        path="/"
                        element={
                            <SuperAdminRoute>
                                <SuperAdmin />
                            </SuperAdminRoute>
                        }
                    />
                    <Route
                        path="/*"
                        element={
                            <SuperAdminRoute>
                                <SuperAdmin />
                            </SuperAdminRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    )
}
