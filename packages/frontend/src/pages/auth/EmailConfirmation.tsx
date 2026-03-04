import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Loader, CheckCircle, XCircle } from 'lucide-react'

export default function EmailConfirmation() {
    const navigate = useNavigate()
    const { setUser } = useAuthStore()
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const confirmEmail = async () => {
            try {
                // O Supabase já processa o token automaticamente quando a página carrega
                // Vamos apenas verificar se o usuário está autenticado após a confirmação
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) throw error

                if (!session) {
                    // Se não há sessão, pode ser que ainda não foi confirmado
                    // Vamos verificar se há um token hash na URL
                    const hashParams = new URLSearchParams(window.location.hash.substring(1))
                    const accessToken = hashParams.get('access_token')
                    const refreshToken = hashParams.get('refresh_token')
                    const type = hashParams.get('type')

                    if (type === 'signup' && accessToken) {
                        // Confirmar email usando os tokens
                        const { data, error: authError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken || ''
                        })

                        if (authError) throw authError

                        if (data.user) {
                            // Criar admin_profile se não existir
                            await createAdminProfile(data.user.id)

                            setUser(data.user)

                            // Salvar email no localStorage
                            if (data.user.email) {
                                localStorage.setItem('userEmail', data.user.email)
                            }

                            setStatus('success')
                            setMessage('Email verified successfully! Redirecting to dashboard...')

                            // Redirecionar após 2 segundos
                            setTimeout(() => {
                                navigate('/dashboard')
                            }, 2000)
                        }
                    } else {
                        throw new Error('Invalid confirmation link')
                    }
                } else {
                    // Usuário já está autenticado
                    await createAdminProfile(session.user.id)

                    setUser(session.user)

                    if (session.user.email) {
                        localStorage.setItem('userEmail', session.user.email)
                    }

                    setStatus('success')
                    setMessage('Email verified successfully! Redirecting to dashboard...')

                    setTimeout(() => {
                        navigate('/dashboard')
                    }, 2000)
                }
            } catch (err: any) {
                console.error('Email confirmation error:', err)
                setStatus('error')
                setMessage(err.message || 'Failed to verify email. Please try again or contact support.')
            }
        }

        confirmEmail()
    }, [navigate, setUser])

    const createAdminProfile = async (userId: string) => {
        try {
            // Verificar se o perfil já existe
            const { data: existingProfile } = await supabase
                .from('admin_profiles')
                .select('user_id')
                .eq('user_id', userId)
                .single()

            if (!existingProfile) {
                // Criar admin_profile básico
                const { error: profileError } = await supabase
                    .from('admin_profiles')
                    .insert({
                        user_id: userId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })

                if (profileError) {
                    console.error('Error creating admin_profile:', profileError)
                }
            }
        } catch (err) {
            console.error('Error checking/creating admin_profile:', err)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-[#050608] dark:via-[#0a0d14] dark:via-[#0f1520] dark:to-[#1a4a6c] flex items-center justify-center p-4 transition-colors duration-300">
            <div className="w-full max-w-md flex flex-col items-center">
                {/* Logo */}
                <div className="text-center mb-6 w-full flex flex-col items-center">
                    <img
                        src="/logoo.png"
                        alt="Clicknich"
                        className="h-40 -mb-6 object-contain"
                    />
                </div>

                {/* Status Card */}
                <div className="w-full bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-2xl p-8 border border-gray-200 dark:border-[#2a4060] transition-colors duration-300">
                    <div className="flex flex-col items-center text-center">
                        {status === 'loading' && (
                            <>
                                <Loader className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                                    Verifying your email...
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Please wait while we confirm your account.
                                </p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                                    Email Verified!
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {message}
                                </p>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <XCircle className="w-16 h-16 text-red-500 mb-4" />
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                                    Verification Failed
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                    {message}
                                </p>
                                <button
                                    onClick={() => navigate('/auth/login')}
                                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-md transition-all shadow-lg"
                                >
                                    Back to Login
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
