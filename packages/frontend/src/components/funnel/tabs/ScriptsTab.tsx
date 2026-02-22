/**
 * Tab component for displaying script generators for offers
 */

import { Code, Copy, Check, Edit, Zap } from 'lucide-react'
import { useScriptManager } from '@/hooks/useScriptManager'
import { useI18n } from '@/i18n'

interface ScriptCardProps {
    type: 'upsell' | 'downsell'
    title: string
    description: string
    color: string
    copiedScript: string | null
    onCopyScript: (script: string, id: string) => void
    onGenerateScript: (type: 'upsell' | 'downsell') => string
}

const ScriptCard = ({
    type,
    title,
    description,
    color,
    copiedScript,
    onCopyScript,
    onGenerateScript
}: ScriptCardProps) => {
    const script = onGenerateScript(type)

    return (
        <div className="bg-white dark:bg-[#1a1d2e] rounded-lg border border-gray-200 dark:border-[#252941] p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color}`}></span>
                        {title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {description}
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#0f1117] rounded border border-gray-200 dark:border-[#252941] p-3 mb-4">
                <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                    <code>{script}</code>
                </pre>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => onCopyScript(script, type)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                >
                    {copiedScript === type ? (
                        <>
                            <Check size={16} />
                            {t('funnels.scripts.copied')}
                        </>
                    ) : (
                        <>
                            <Copy size={16} />
                            {t('funnels.scripts.copy_script')}
                        </>
                    )}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#252941] hover:bg-gray-200 dark:hover:bg-[#2d3150] text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm">
                    <Edit size={16} />
                    {t('funnels.scripts.customize')}
                </button>
            </div>
        </div>
    )
}

export default function ScriptsTab() {
    const { copiedScript, copyScript, generateScript } = useScriptManager()
    const { t } = useI18n()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        {t('funnels.scripts.title')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {t('funnels.scripts.subtitle')}
                    </p>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                    <Code className="text-blue-400 flex-shrink-0" size={20} />
                    <div>
                        <h3 className="text-gray-900 dark:text-white font-semibold mb-1">{t('funnels.scripts.how_to_use')}</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {t('funnels.scripts.how_to_use_desc')}
                        </p>
                        <p className="text-sm text-gray-400">
                            {t('funnels.scripts.auto_detect')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Script Types */}
            <div className="grid md:grid-cols-2 gap-6">
                <ScriptCard
                    type="upsell"
                    title={t('funnels.scripts.upsell')}
                    description={t('funnels.scripts.upsell_desc')}
                    color="bg-green-500"
                    copiedScript={copiedScript}
                    onCopyScript={copyScript}
                    onGenerateScript={generateScript}
                />

                <ScriptCard
                    type="downsell"
                    title={t('funnels.scripts.downsell')}
                    description={t('funnels.scripts.downsell_desc')}
                    color="bg-orange-500"
                    copiedScript={copiedScript}
                    onCopyScript={copyScript}
                    onGenerateScript={generateScript}
                />
            </div>

            {/* Integration Examples */}
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg border border-gray-200 dark:border-[#252941] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📖 {t('funnels.scripts.integration_examples')}</h3>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-gray-900 dark:text-white font-medium mb-2">WordPress/HTML</h4>
                        <div className="bg-gray-50 dark:bg-[#0f1117] rounded border border-gray-200 dark:border-[#252941] p-3">
                            <pre className="text-xs text-gray-700 dark:text-gray-300">
                                {`<!-- Paste at the end of your thank you page -->
<div id="oferta-especial"></div>
<!-- Upsell Script here -->
<script>/* Script copied above */</script>`}
                            </pre>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-gray-900 dark:text-white font-medium mb-2">Shopify (Thank You Page)</h4>
                        <div className="bg-gray-50 dark:bg-[#0f1117] rounded border border-gray-200 dark:border-[#252941] p-3">
                            <pre className="text-xs text-gray-700 dark:text-gray-300">
                                {`<!-- Settings > Checkout > Additional Scripts -->
<!-- Paste the script in the additional scripts section -->`}
                            </pre>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-gray-900 dark:text-white font-medium mb-2">Redirect URL</h4>
                        <div className="bg-gray-50 dark:bg-[#0f1117] rounded border border-gray-200 dark:border-[#252941] p-3">
                            <pre className="text-xs text-gray-300">
                                {`// Configure your checkout to redirect to:
https://yoursite.com/thankyou?purchase_id={{purchase_id}}

// The script automatically detects the purchase_id`}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuration Tips */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                    <Zap className="text-amber-400 flex-shrink-0" size={20} />
                    <div>
                        <h3 className="text-white font-semibold mb-1">💡 {t('funnels.scripts.config_tips')}</h3>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>• {t('funnels.scripts.tip1')}</li>
                            <li>• {t('funnels.scripts.tip2')}</li>
                            <li>• {t('funnels.scripts.tip3')}</li>
                            <li>• {t('funnels.scripts.tip4')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}