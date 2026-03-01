import { Spinner } from '@heroui/react'
import { CreditCard, Smartphone, Landmark, QrCode, Wallet } from 'lucide-react'
import { useI18n } from '@/i18n'

interface PaymentMethod {
    name: string
    icon: string
    conversion: number
    value: number
}

interface PaymentMethodsProps {
    methods: PaymentMethod[]
    loading: boolean
    hideValues: boolean
}

const METHOD_NAME_KEYS: Record<string, string> = {
    card: 'orders.payment_method.credit_card',
    boleto: 'orders.payment_method.boleto',
    pix: 'orders.payment_method.pix',
    paypal: 'orders.payment_method.paypal',
}

const METHOD_CONFIG: Record<string, { icon: JSX.Element; bar: string }> = {
    paypal: {
        icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.825l-1.267 8.03h3.932c.524 0 .968-.382 1.05-.9l.706-4.477a.641.641 0 0 1 .633-.541h1.194c3.87 0 6.498-1.943 7.33-5.494.373-1.6.18-2.875-.181-3.413z" />
            </svg>
        ),
        bar: 'bg-blue-500',
    },
    card: {
        icon: <CreditCard size={14} className="text-blue-400" />,
        bar: 'bg-blue-500',
    },
    boleto: {
        icon: <QrCode size={14} className="text-blue-400" />,
        bar: 'bg-blue-500',
    },
    bank_transfer: {
        icon: <Landmark size={14} className="text-blue-400" />,
        bar: 'bg-blue-500',
    },
    wallet: {
        icon: <Wallet size={14} className="text-blue-400" />,
        bar: 'bg-blue-500',
    },
    mobile: {
        icon: <Smartphone size={14} className="text-blue-400" />,
        bar: 'bg-blue-500',
    },
}

export default function PaymentMethods({ methods, loading, hideValues }: PaymentMethodsProps) {
    const { t } = useI18n()
    const getConfig = (icon: string) =>
        METHOD_CONFIG[icon] ?? METHOD_CONFIG['card']
    const getMethodName = (icon: string, fallback: string) => {
        const key = METHOD_NAME_KEYS[icon]
        if (key) return t(key as any)
        return fallback
    }

    return (
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm h-full">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('dashboard.payment_methods')}</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('dashboard.conversion')}</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Spinner size="sm" color="default" />
                </div>
            ) : methods.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
            ) : (
                <div className="space-y-4">
                    {methods.map((method, i) => {
                        const cfg = getConfig(method.icon)
                        const pct = hideValues ? 0 : Math.min(method.conversion, 100)
                        return (
                            <div key={i}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        {cfg.icon}
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{getMethodName(method.icon, method.name)}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                                        {hideValues ? '••%' : `${method.conversion.toFixed(1)}%`}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${cfg.bar} rounded-full transition-all duration-700`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
