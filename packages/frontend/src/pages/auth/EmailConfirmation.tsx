import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { Loader } from 'lucide-react'

export default function EmailConfirmation() {
    const navigate = useNavigate()

    useEffect(() => {
        const confirmEmail = async () => {
            try {
                // O Supabase processa automaticamente o token de confirmação via hash
                const hashParams = new URLSearchParams(window.location.hash.substring(1))
                const accessToken = hashParams.get('access_token')
                const type = hashParams.get('type')

                if (type === 'signup' && accessToken) {
                    // Precisamos pegar o email do usuário primeiro
                    const { data, error: authError } = await supabase.auth.getUser(accessToken)

                    if (authError) throw authError

                    const userEmail = data?.user?.email || ''

                    // Fazer logout para garantir que o usuário vai fazer login
                    await supabase.auth.signOut()

                    // Redirecionar DIRETO para login com email preenchido
                    navigate(`/auth/login?confirmed=true&email=${encodeURIComponent(userEmail)}`)
                } else {
                    // Link inválido, redireciona para login
                    navigate('/auth/login')
                }
            } catch (err: any) {
                console.error('Email confirmation error:', err)
                // Se der erro, redireciona para login mesmo assim
                navigate('/auth/login')
            }
        }

        confirmEmail()
    }, [navigate])

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-[#050608] dark:via-[#0a0d14] dark:via-[#0f1520] dark:to-[#1a4a6c] flex items-center justify-center p-4 transition-colors duration-300">
            <div className="flex flex-col items-center text-center">
                <Loader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Verifying email...</p>
            </div>
        </div>
    )
}
