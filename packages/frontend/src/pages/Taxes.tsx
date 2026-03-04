import { useState } from 'react'
import { CreditCard, DollarSign, AlertTriangle, ArrowDownCircle, ShieldCheck, Users, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

interface SectionProps {
    icon: React.ReactNode
    title: string
    subtitle?: string
    color: string
    children: React.ReactNode
}

function Section({ icon, title, subtitle, color, children }: SectionProps) {
    return (
        <div className="mb-10">
            <div className={`mb-5 pl-4 border-l-4 ${color}`}>
                <div className="flex items-center gap-2">
                    <span className="opacity-70">{icon}</span>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
                </div>
                {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-6">{subtitle}</p>}
            </div>
            {children}
        </div>
    )
}

interface FeeRowProps {
    label: string
    value: string
    sub?: string
    highlight?: boolean
}

function FeeRow({ label, value, sub, highlight }: FeeRowProps) {
    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${highlight ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5'}`}>
            <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
            </div>
            <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-blue-400' : 'text-gray-900 dark:text-white'}`}>{value}</span>
        </div>
    )
}

interface PayoutCardProps {
    period: string
    percentage: string
    fixed: string
    days: string
    active?: boolean
}

function PayoutCard({ period, percentage, fixed, days, active }: PayoutCardProps) {
    return (
        <div className={`flex-1 relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition-all ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5'}`}>
            {active && <span className="absolute top-3 right-3 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">Padrão</span>}
            <div className="text-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white">{period}</span>
                <p className="text-[11px] text-gray-500 mt-0.5">{days}</p>
            </div>
            <div className="text-center py-2 border-t border-b border-gray-100 dark:border-white/10">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{percentage}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">+ {fixed} por transação</p>
            </div>
            <div className="text-center">
                <p className="text-[11px] text-amber-500">Reserva de seguran­ça: 15% / 60 dias</p>
            </div>
        </div>
    )
}

interface InfoCardProps {
    items: { label: string; value: string; note?: string }[]
}

function InfoCard({ items }: InfoCardProps) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{item.label}</p>
                            {item.note && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{item.note}</p>}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function Taxes() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">

                        <div className="mb-8">
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Taxas da Plataforma</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Estrutura completa de tarifas e condições aplicadas às suas transações.</p>
                        </div>

                        {/* 1. Cartão Internacional */}
                        <Section icon={<CreditCard className="w-4 h-4 text-indigo-400" />} title="Cartão de Crédito — Internacional" subtitle="Multimoeda automática com spread cambial aplicado conforme a moeda" color="border-indigo-500">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <PayoutCard period="D+2" percentage="8.99%" fixed="$0.49" days="Payout rápido — 2 dias úteis" />
                                <PayoutCard period="D+5" percentage="6.49%" fixed="$0.49" days="Payout padrão — 5 dias úteis" active />
                                <PayoutCard period="D+12" percentage="5.99%" fixed="$0.49" days="Payout econômico — 12 dias úteis" />
                            </div>
                        </Section>

                        {/* 2. Pix / Transferência Local */}
                        <Section icon={<ArrowRightLeft className="w-4 h-4 text-green-400" />} title="Pix / Transferência Local — Brasil" subtitle="Sem spread cambial quando moeda for BRL" color="border-green-500">
                            <InfoCard items={[
                                { label: 'Taxa Pix', value: '4.99% + R$0.39', note: 'Liquidação D+0' },
                                { label: 'Spread cambial', value: 'Não aplicado', note: 'Válido apenas para BRL' },
                                { label: 'Taxa fixa internacional', value: 'Não cobrada', note: 'Apenas para moeda local' },
                            ]} />
                        </Section>

                        {/* 3. Boleto */}
                        <Section icon={<DollarSign className="w-4 h-4 text-yellow-400" />} title="Boleto Bancário — Brasil" color="border-yellow-500">
                            <InfoCard items={[
                                { label: 'Taxa boleto', value: '3.99% + R$1.90', note: 'Por transação paga' },
                                { label: 'Liquidação', value: 'D+3 úteis', note: 'Após confirmação de pagamento' },
                            ]} />
                        </Section>

                        {/* 4. Spread Cambial */}
                        <Section icon={<ArrowRightLeft className="w-4 h-4 text-blue-400" />} title="Spread Cambial" subtitle="+1.7% sobre taxa de câmbio oficial" color="border-blue-500">
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Aplicado automaticamente nas seguintes moedas:</p>
                                <div className="flex flex-wrap gap-2">
                                    {['EUR', 'CHF', 'GBP', 'CAD', 'MXN', 'BRL', 'COP', 'CLP', 'PEN'].map(cur => (
                                        <span key={cur} className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">{cur}</span>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">Moedas não detectadas por IP são cobradas em USD sem spread.</p>
                            </div>
                        </Section>

                        {/* 5. Chargeback */}
                        <Section icon={<AlertTriangle className="w-4 h-4 text-red-400" />} title="Chargeback" color="border-red-500">
                            <InfoCard items={[
                                { label: 'Taxa por disputa perdida', value: '$15.00', note: 'Cobrado por chargeback aprovado contra o produtor' },
                                { label: 'Taxa de monitoramento', value: '0.9%', note: 'Aplicada se taxa de chargeback > 0.6%' },
                            ]} />
                        </Section>

                        {/* 6. Taxa de Saque */}
                        <Section icon={<ArrowDownCircle className="w-4 h-4 text-purple-400" />} title="Taxa de Saque" color="border-purple-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Saque Padrão</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Wire Transfer / SEPA / ACH</p>
                                    <div className="space-y-2">
                                        <FeeRow label="Taxa fixa" value="$5.00" sub="Por saque de até $100" />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Saque Instantâneo</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Se habilitado na conta</p>
                                    <div className="space-y-2">
                                        <FeeRow label="Taxa adicional" value="1.2%" />
                                        <FeeRow label="Valor mínimo" value="$10.00" />
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* 7. Reserva Financeira */}
                        <Section icon={<ShieldCheck className="w-4 h-4 text-amber-400" />} title="Reserva Financeira (Risk Hold)" subtitle="Aplicável a contas novas, sem histórico ou nicho sensível" color="border-amber-500">
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                                <FeeRow label="Percentual retido" value="10% a 20%" sub="Do valor bruto de cada venda" highlight />
                                <FeeRow label="Período de retenção" value="60 dias" sub="A partir da data da venda" />
                                <FeeRow label="Liberação automática" value="Chargeback < 0.6%" sub="Satisfeito o critério, a reserva é liberada automaticamente" />
                                <FeeRow label="Liberação manual" value="Via suporte" sub="Solicitação ao time da plataforma" />
                            </div>
                        </Section>

                        {/* 8. Condições para redução de taxa */}
                        <Section icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} title="Condições para Migração de Prazo" subtitle="Para mudar de D+2 → D+5 ou D+12, todos os critérios devem ser atendidos" color="border-emerald-500">
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                                <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                    {[
                                        { label: 'Tempo mínimo ativo', value: '60 dias' },
                                        { label: 'Taxa de chargeback', value: '< 0.6%' },
                                        { label: 'Volume mensal mínimo', value: '$30.000 / mês' },
                                        { label: 'KYC completo', value: 'Obrigatório' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                                            <span className="text-sm font-semibold text-emerald-400">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Section>

                        {/* 9. Afiliados */}
                        <Section icon={<Users className="w-4 h-4 text-sky-400" />} title="Taxa para Afiliados (Split)" color="border-sky-500">
                            <InfoCard items={[
                                { label: 'Split automático', value: 'Sem custo', note: 'Nenhuma taxa adicional sobre a divisão automática' },
                                { label: 'Split manual customizado', value: '+ 1%', note: 'Cobrado sobre o valor do split' },
                            ]} />
                        </Section>

                    </div>
                </main>
            </div>
        </div>
    )
}


interface FeeCardProps {
    period: string
    percentage: string
    fixed: string
    items: string[]
    highlight?: string
    t: (key: string) => string
}

function FeeCard({ period, percentage, fixed, items, highlight, t }: FeeCardProps) {
    return (
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1f2937] rounded-2xl p-6 flex flex-col gap-4 flex-1">
            <div className="text-center">
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">{period}</span>
            </div>

            <div className="text-center">
                <p className="text-gray-900 dark:text-white">
                    <span className="text-xl font-bold">{percentage}</span>
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> + {fixed}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('taxes.per_transaction')}</p>
            </div>

            <div className="border-t border-gray-100 dark:border-[#1f2937] pt-4 flex flex-col gap-2">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className="bg-gray-50 dark:bg-[#1a2233] rounded-lg px-4 py-2.5 text-xs text-center text-gray-600 dark:text-gray-300"
                    >
                        {item}
                    </div>
                ))}

                {highlight && (
                    <p className="text-xs text-gray-900 dark:text-white mt-1 px-1">
                        <span className="font-bold">{t('taxes.special_conditions')}</span>{' '}
                        <span className="font-normal text-gray-500 dark:text-gray-400">{highlight}</span>
                    </p>
                )}
            </div>
        </div>
    )
}
