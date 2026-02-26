/**
 * Custom hook for managing script generation and copying
 */

import { useState } from 'react'
import { generateOfferScript } from '@/utils/funnelUtils'

export const useScriptManager = () => {
    const [copiedScript, setCopiedScript] = useState<string | null>(null)

    const copyScript = (script: string, id: string) => {
        navigator.clipboard.writeText(script)
        setCopiedScript(id)
        setTimeout(() => setCopiedScript(null), 2000)
    }

    const generateScript = (type: 'upsell' | 'downsell', checkoutId?: string) => {
        return generateOfferScript(type, checkoutId)
    }

    return {
        copiedScript,
        copyScript,
        generateScript
    }
}