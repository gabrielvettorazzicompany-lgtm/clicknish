import { Edit, Trash2, Link, Send } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Application {
    id?: string
    name: string
    slug: string
    created_at: string
    logo_url?: string
    show_names?: boolean
    highlight_community?: boolean
    free_registration?: boolean
    app_type?: string
    language?: string
    theme?: string
    category?: string
    review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected'
}

interface AppCardProps {
    app: Application
    onEdit: (id: string) => void
    onDelete: (id: string) => void
    onOpenAccess: (slug: string) => void
    onSubmitReview?: (id: string) => void
}

export default function AppCard({
    app,
    onEdit,
    onDelete,
    onOpenAccess,
    onSubmitReview,
}: AppCardProps) {
    const { t } = useI18n()

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const isPending = app.review_status === 'pending_review'
    const isDraft = app.review_status === 'draft' || !app.review_status

    return (
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-white/10 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
            {/* App Logo Preview */}
            <div className="h-24 bg-gray-50 dark:bg-white/5 relative overflow-hidden flex items-center justify-center">
                {/* Action Icons - Top Right */}
                <div className="absolute top-2 right-2 flex gap-1">
                    {onOpenAccess && (
                        <button
                            onClick={() => onOpenAccess(app.slug)}
                            className="p-1.5 bg-white dark:bg-[#1a1d2e] hover:bg-gray-100 dark:hover:bg-[#252941] border border-gray-200 dark:border-[#1e2139] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 hover:shadow transition-all"
                            title="Open access link"
                        >
                            <Link size={14} className="text-blue-500" />
                        </button>
                    )}
                    <button
                        onClick={() => !isPending && app.id && onEdit(app.id)}
                        disabled={isPending}
                        className={`p-1.5 border rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 transition-all ${isPending
                            ? 'bg-gray-100 dark:bg-[#1a1d2e]/50 border-gray-200 dark:border-[#1e2139] opacity-40 cursor-not-allowed'
                            : 'bg-white dark:bg-[#1a1d2e] hover:bg-gray-100 dark:hover:bg-[#252941] border-gray-200 dark:border-[#1e2139] hover:shadow cursor-pointer'
                            }`}
                        title={isPending ? 'Cannot edit while pending review' : 'Edit app'}
                    >
                        <Edit size={14} className="text-gray-500 dark:text-gray-400" />
                    </button>
                    {app.id && (
                        <button
                            onClick={() => onDelete(app.id!)}
                            className="p-1.5 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 hover:shadow transition-all"
                            title="Delete app"
                        >
                            <Trash2 size={14} className="text-red-400" />
                        </button>
                    )}
                </div>

                {app.logo_url ? (
                    <img
                        src={app.logo_url}
                        alt={app.name}
                        className="w-full h-full object-contain p-4"
                    />
                ) : (
                    <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                        <span className="text-gray-400 dark:text-gray-600 font-bold text-2xl">
                            {app.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* App Info */}
            <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">{app.name}</h3>
                <p className="text-xs text-gray-500">
                    Created on {formatDate(app.created_at)}
                </p>
                {app.category && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded text-xs">
                        {app.category}
                    </span>
                )}

                {/* Review Status Badge */}
                {app.review_status && app.review_status !== 'approved' && (
                    <div className="mt-2">
                        {isDraft && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                <span className="text-xs text-gray-400 font-medium">{t('components.app_card.draft')}</span>
                            </div>
                        )}
                        {app.review_status === 'pending_review' && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-yellow-500 font-medium">{t('components.app_card.in_review')}</span>
                            </div>
                        )}
                        {app.review_status === 'rejected' && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                <span className="text-xs text-red-500 font-medium">{t('components.app_card.rejected')}</span>
                            </div>
                        )}
                    </div>
                )}
                {(isDraft || app.review_status === 'rejected') && onSubmitReview && app.id && (
                    <button
                        onClick={() => onSubmitReview(app.id!)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                    >
                        <Send size={11} />
                        {t('components.app_card.submit_verification')}
                    </button>
                )}
            </div>
        </div>
    )
}