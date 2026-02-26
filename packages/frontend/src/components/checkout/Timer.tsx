import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { TimerConfig } from './types'
import { formatTime } from './utils'

interface TimerComponentProps {
    config: TimerConfig
    onClick?: () => void
    isPreview?: boolean
    compact?: boolean
}

export const TimerComponent: React.FC<TimerComponentProps> = ({
    config,
    onClick,
    isPreview,
    compact = false
}) => {
    const [timeLeft, setTimeLeft] = useState(config.minutes * 60) // em segundos
    const [isFinished, setIsFinished] = useState(false)

    // Atualizar o tempo quando o config.minutes mudar
    useEffect(() => {
        setTimeLeft(config.minutes * 60)
        setIsFinished(false)
    }, [config.minutes])

    useEffect(() => {
        if (timeLeft <= 0) {
            setIsFinished(true)
            return
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setIsFinished(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [timeLeft])

    return (
        <div
            className={`w-full ${compact ? 'py-2 px-3 gap-2 text-sm' : 'py-4 px-6 gap-3 text-lg'} flex items-center justify-center font-semibold border rounded-md ${isPreview && onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                }`}
            style={{
                backgroundColor: config.backgroundColor,
                color: config.textColor,
                borderColor: config.textColor
            }}
            onClick={onClick}
        >
            <Clock size={compact ? 16 : 24} className="animate-pulse" />
            <span className={`${compact ? 'text-base' : 'text-2xl'} font-mono font-bold`}>
                {formatTime(timeLeft)}
            </span>
            <span className={compact ? 'text-xs' : 'text-base'}>
                {isFinished ? config.finishedText : config.activeText}
            </span>
        </div>
    )
}