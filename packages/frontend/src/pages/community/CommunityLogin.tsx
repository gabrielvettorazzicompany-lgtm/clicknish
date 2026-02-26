import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

export default function CommunityLogin() {
    const navigate = useNavigate()
    const { communitySlug, productSlug } = useParams<{ communitySlug?: string; productSlug?: string }>()
    const { t } = useI18n()

    // Determine if it's for community or product
    const isProductLogin = !!productSlug
    const slug = productSlug || communitySlug

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [product, setProduct] = useState<any>(null)

    // Fetch product data to get image and name
    useEffect(() => {
        const fetchProduct = async () => {
            if (!slug) return

            // Try by slug first, then by ID
            let { data } = await supabase
                .from('marketplace_products')
                .select('id, name, slug, image_url, logo_url, support_enabled, support_label, support_url')
                .eq('slug', slug)
                .maybeSingle()

            if (!data) {
                const result = await supabase
                    .from('marketplace_products')
                    .select('id, name, slug, image_url, logo_url, support_enabled, support_label, support_url')
                    .eq('id', slug)
                    .maybeSingle()
                data = result.data
            }

            if (data) {
                setProduct(data)
            }
        }

        fetchProduct()
    }, [slug])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!slug) {
            setError('Invalid product link. Please check the URL.')
            return
        }

        setLoading(true)

        try {
            // Simulate auth delay
            await new Promise(resolve => setTimeout(resolve, 800))

            // Mock data - login with email
            if (isProductLogin) {
                localStorage.setItem(`product_member_token_${slug}`, 'mock-product-token-123')
                localStorage.setItem(`product_member_data_${slug}`, JSON.stringify({
                    id: '1',
                    name: email.split('@')[0],
                    email: email,
                    productSlug: slug
                }))
                navigate(`/community/${slug}`)
            } else {
                localStorage.setItem(`community_token_${slug}`, 'mock-token-123')
                localStorage.setItem(`community_user_${slug}`, JSON.stringify({
                    id: '1',
                    name: email.split('@')[0],
                    email: email
                }))
                navigate(`/community/${slug}`)
            }
        } catch (err) {
            console.error('Login error:', err)
            setError('Error logging in. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            {/* Left Side - Product Image */}
            <div className="hidden lg:flex lg:w-1/2 relative">
                {product?.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product?.name || 'Product'}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600/20 via-[#1a1d2e] to-purple-600/10 flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-gray-400 text-xl font-medium">{product?.name || t('community.login_title')}</p>
                        </div>
                    </div>
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0f1117]" />
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile Image */}
                    <div className="lg:hidden mb-8">
                        {product?.image_url ? (
                            <div className="relative h-48 rounded-xl overflow-hidden">
                                <img
                                    src={product.image_url}
                                    alt={product?.name || 'Product'}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] to-transparent" />
                            </div>
                        ) : null}
                    </div>

                    {/* Logo */}
                    <div className="text-center mb-8">
                        {product?.logo_url && (
                            <img
                                src={product.logo_url}
                                alt={product?.name || 'Logo'}
                                className="h-16 mx-auto mb-4"
                            />
                        )}
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {product?.name || t('community.login_title')}
                        </h1>
                        <p className="text-gray-400 text-sm">
                            {t('community.login_subtitle')}
                        </p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-xl p-6 border border-[#2a4060] shadow-xl">
                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-sm text-red-400 text-center">{error}</p>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#0f1117] border border-[#252941] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-sm transition-all"
                                    placeholder={t('community.email_placeholder')}
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#0f1117] border border-[#252941] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-sm pr-10 transition-all"
                                        placeholder="••••••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-[#333656] bg-[#252941] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <label htmlFor="rememberMe" className="text-sm text-gray-400">
                                    {t('community.remember_me')}
                                </label>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        {t('community.logging_in')}
                                    </>
                                ) : (
                                    t('community.login_button')
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Support Links */}
                    {product?.support_enabled && product?.support_url && (
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500">
                                Need Support?{' '}
                                <a
                                    href={product.support_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {product.support_label || 'Contact Us'}
                                </a>
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-10 text-center text-[10px] text-gray-600 space-y-0.5">
                        <p>Copyright © {new Date().getFullYear()} - {product?.name || t('community.login_title')}</p>
                        <p>All rights reserved</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
