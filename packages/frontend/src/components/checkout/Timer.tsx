import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { TimerConfig } from './types'
import { formatTime } from './utils'

interface TimerComponentProps {
    config: TimerConfig
    onClick?: () => void
    isPreview?: boolean
}

export const TimerComponent: React.FC<TimerComponentProps> = ({
    config,
    onClick,
    isPreview
}) => {
    const [timeLeft, setTimeLeft] = useState(config.minutes * 60) // em segundos
    const [isFinished, setIsFinished] = useState(false)

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
            className={`w-full py-4 px-6 flex items-center justify-center gap-3 font-semibold text-lg border rounded-md ${isPreview && onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                }`}
            style={{
                backgroundColor: config.backgroundColor,
                color: config.textColor,
                borderColor: config.textColor
            }}
            onClick={onClick}
        >
            <Clock size={24} className="animate-pulse" />
            <span className="text-2xl font-mono font-bold">
                {formatTime(timeLeft)}
            </span>
            <span className="text-base">
                {isFinished ? config.finishedText : config.activeText}
            </span>
        </div>
    )
}