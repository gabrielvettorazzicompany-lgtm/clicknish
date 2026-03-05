// Hook para detecção automática de idioma baseado no IP
// hooks/useLanguageDetection.ts

import { useState, useEffect, useCallback } from 'react'
import { Language } from '@/i18n'
import { detectLanguageByIP } from '@/services/languageDetection'

interface UseLanguageDetectionResult {
    detectedLanguage: Language | null
    isDetecting: boolean
    detectError: string | null
    detectLanguage: () => Promise<void>
    hasDetected: boolean
}

/**
 * Hook para detectar idioma baseado no IP do usuário
 * @param autoDetect - Se deve detectar automaticamente ao montar o componente
 * @param onLanguageDetected - Callback chamado quando um idioma é detectado
 */
export function useLanguageDetection(
    autoDetect: boolean = false,
    onLanguageDetected?: (language: Language) => void
): UseLanguageDetectionResult {
    const [detectedLanguage, setDetectedLanguage] = useState<Language | null>(null)
    const [isDetecting, setIsDetecting] = useState(false)
    const [detectError, setDetectError] = useState<string | null>(null)
    const [hasDetected, setHasDetected] = useState(false)

    const detectLanguage = useCallback(async () => {
        // Evitar múltiplas detecções simultâneas
        if (isDetecting) return

        try {
            setIsDetecting(true)
            setDetectError(null)

            const language = await detectLanguageByIP()

            setDetectedLanguage(language)
            setHasDetected(true)

            // Chamar callback se fornecido
            if (onLanguageDetected) {
                onLanguageDetected(language)
            }

        } catch (error) {
            console.error('Erro ao detectar idioma:', error)
            setDetectError('Erro ao detectar idioma automaticamente')

            // Fallback para inglês em caso de erro
            setDetectedLanguage('en')
            setHasDetected(true)

            if (onLanguageDetected) {
                onLanguageDetected('en')
            }

        } finally {
            setIsDetecting(false)
        }
    }, [isDetecting, onLanguageDetected])

    // Auto detecção no mount se habilitada
    useEffect(() => {
        if (autoDetect && !hasDetected) {
            detectLanguage()
        }
    }, [autoDetect, hasDetected, detectLanguage])

    return {
        detectedLanguage,
        isDetecting,
        detectError,
        detectLanguage,
        hasDetected,
    }
}

/**
 * Hook simplificado para detecção automática com callback
 * Detecta automaticamente ao montar e chama o callback
 */
export function useAutoLanguageDetection(
    onLanguageDetected: (language: Language) => void
): Pick<UseLanguageDetectionResult, 'isDetecting' | 'detectError' | 'hasDetected'> {
    const { isDetecting, detectError, hasDetected } = useLanguageDetection(
        true, // auto detect
        onLanguageDetected
    )

    return {
        isDetecting,
        detectError,
        hasDetected,
    }
}