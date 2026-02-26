import { useState, useRef, useEffect } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface SingleDatePickerProps {
    value: Date | null
    onChange: (date: Date | null) => void
    disabled?: boolean
    placeholder?: string
}

export default function SingleDatePicker({ value, onChange, disabled, placeholder = 'Registration Date' }: SingleDatePickerProps) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()))
    const ref = useRef<HTMLDivElement>(null)

    const label = value ? format(value, 'dd/MM/yyyy') : placeholder

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    function handleDayClick(day: Date) {
        if (day > new Date()) return
        onChange(isSameDay(day, value ?? new Date('1970-01-01')) && value ? null : day)
        setOpen(false)
    }

    function renderMonth() {
        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
        const startDow = startOfMonth(month).getDay()

        return (
            <div>
                {/* Month header */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <button
                        onClick={() => setMonth(m => subMonths(m, 1))}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                        <ChevronLeft size={13} className="text-gray-400" />
                    </button>
                    <span className="text-[11px] font-semibold text-gray-200 capitalize tracking-wide">
                        {t('dashboard_components.months.' + month.getMonth())} {month.getFullYear()}
                    </span>
                    <button
                        onClick={() => setMonth(m => addMonths(m, 1))}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                        <ChevronRight size={13} className="text-gray-400" />
                    </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                    {[t('dashboard_components.weekdays.sun'), t('dashboard_components.weekdays.mon'), t('dashboard_components.weekdays.tue'), t('dashboard_components.weekdays.wed'), t('dashboard_components.weekdays.thu'), t('dashboard_components.weekdays.fri'), t('dashboard_components.weekdays.sat')].map(d => (
                        <div key={d} className="text-center text-[10px] text-gray-600 py-0.5">{d}</div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7">
                    {Array.from({ length: startDow }).map((_, i) => <div key={`b${i}`} />)}
                    {days.map(day => {
                        const isSelected = !!(value && isSameDay(day, value))
                        const isToday = isSameDay(day, new Date())
                        const isFuture = day > startOfDay(new Date())

                        return (
                            <div key={day.toISOString()} className="flex items-center justify-center h-7">
                                <button
                                    disabled={isFuture}
                                    onClick={() => handleDayClick(day)}
                                    className={`
                                        w-7 h-7 flex items-center justify-center text-[11px] rounded-full transition-all
                                        ${isFuture ? 'opacity-25 cursor-not-allowed text-gray-500' : 'cursor-pointer'}
                                        ${isSelected ? 'bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/30' : ''}
                                        ${isToday && !isSelected ? 'ring-1 ring-white/30 text-white font-semibold' : ''}
                                        ${!isSelected && !isFuture ? 'text-gray-300 hover:bg-white/10' : ''}
                                    `}
                                >
                                    {format(day, 'd')}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`flex items-center gap-2 h-8 px-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-xs transition-colors whitespace-nowrap
                    ${disabled ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-gray-300 hover:bg-white/10 cursor-pointer'}
                    ${value ? 'border-blue-500/40' : ''}`}
            >
                <CalendarIcon size={12} className="text-gray-500" />
                <span className={value ? 'text-blue-400' : ''}>{label}</span>
                {value && (
                    <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); onChange(null) }}
                        className="ml-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                        <X size={11} />
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-10 z-[200] w-[240px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
                        <span className="text-xs text-gray-500">{t('dashboard_components.select_date')}</span>
                        <button
                            onClick={() => { onChange(startOfDay(new Date())); setOpen(false) }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-gray-300 hover:bg-white/10 transition-colors"
                        >
                            <CalendarIcon size={11} />
                            {t('dashboard_components.today')}
                        </button>
                    </div>

                    {/* Calendar */}
                    <div className="px-4 py-3">
                        {renderMonth()}
                    </div>
                </div>
            )}
        </div>
    )
}
