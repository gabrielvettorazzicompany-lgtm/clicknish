import { useState, useRef, useEffect, useMemo } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfDay } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { DateRange } from 'react-day-picker'

interface DateRangePickerProps {
    value: DateRange | undefined
    onChange: (range: DateRange | undefined) => void
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const { t } = useI18n()

    const PRESETS = useMemo(() => [
        { key: 'yesterday', label: t('dashboard_components.yesterday'), getDates: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: startOfDay(d), to: startOfDay(d) } } },
        { key: 'today', label: t('dashboard_components.today'), getDates: () => { const d = startOfDay(new Date()); return { from: d, to: d } } },
        { key: 'last_7', label: t('dashboard_components.last_7_days'), getDates: () => { const to = startOfDay(new Date()); const from = new Date(to); from.setDate(from.getDate() - 6); return { from, to } } },
        { key: 'last_30', label: t('dashboard_components.last_30_days'), getDates: () => { const to = startOfDay(new Date()); const from = new Date(to); from.setDate(from.getDate() - 29); return { from, to } } },
        { key: 'last_90', label: t('dashboard_components.last_90_days'), getDates: () => { const to = startOfDay(new Date()); const from = new Date(to); from.setDate(from.getDate() - 89); return { from, to } } },
        { key: 'all', label: t('dashboard_components.all_period'), getDates: () => ({ from: new Date('2020-01-01'), to: startOfDay(new Date()) }) },
    ], [t])

    function getPresetLabel(val: DateRange | undefined): string {
        if (!val?.from) return t('dashboard_components.today')
        for (const p of PRESETS) {
            const d = p.getDates()
            if (isSameDay(d.from, val.from) && isSameDay(d.to, val.to ?? val.from)) return p.label
        }
        return `${format(val.from, 'dd/MM/yyyy')} - ${format(val.to ?? val.from, 'dd/MM/yyyy')}`
    }

    const formatMonth = (date: Date) => `${t('dashboard_components.months.' + date.getMonth())} ${date.getFullYear()}`
    const [open, setOpen] = useState(false)
    const [showPresets, setShowPresets] = useState(false)
    const [leftMonth, setLeftMonth] = useState(() => startOfMonth(subMonths(new Date(), 1)))
    const [hovered, setHovered] = useState<Date | null>(null)
    const [selecting, setSelecting] = useState<Date | null>(null)
    const ref = useRef<HTMLDivElement>(null)

    const rightMonth = addMonths(leftMonth, 1)
    const label = getPresetLabel(value)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
                setShowPresets(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    function handleDayClick(day: Date) {
        if (!selecting) {
            setSelecting(day)
            onChange({ from: day, to: day })
        } else {
            const from = selecting < day ? selecting : day
            const to = selecting < day ? day : selecting
            onChange({ from, to })
            setSelecting(null)
        }
    }

    function applyPreset(presetLabel: string) {
        const preset = PRESETS.find(p => p.label === presetLabel)
        if (preset) {
            const range = preset.getDates()
            onChange(range)
            setLeftMonth(startOfMonth(subMonths(range.to, 1)))
        }
        setShowPresets(false)
    }

    function renderMonth(month: Date, side: 'left' | 'right') {
        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
        const startDow = startOfMonth(month).getDay()

        // effective hovered range
        const hoverFrom = selecting && hovered ? (selecting < hovered ? selecting : hovered) : null
        const hoverTo = selecting && hovered ? (selecting < hovered ? hovered : selecting) : null

        return (
            <div className="flex-1">
                {/* Month header */}
                <div className="flex items-center justify-between mb-2 px-1">
                    {side === 'left' ? (
                        <button onClick={() => setLeftMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-white/10 transition-colors">
                            <ChevronLeft size={13} className="text-gray-400" />
                        </button>
                    ) : <div className="w-6" />}
                    <span className="text-[11px] font-semibold text-gray-200 capitalize tracking-wide">
                        {formatMonth(month)}
                    </span>
                    {side === 'right' ? (
                        <button onClick={() => setLeftMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-white/10 transition-colors">
                            <ChevronRight size={13} className="text-gray-400" />
                        </button>
                    ) : <div className="w-6" />}
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
                        const isFrom = !!(value?.from && isSameDay(day, value.from))
                        const isTo = !!(value?.to && isSameDay(day, value.to))
                        const isEndpoint = isFrom || isTo
                        const isInRange = !!(value?.from && value?.to && !isSameDay(value.from, value.to) && isWithinInterval(day, { start: value.from, end: value.to }) && !isEndpoint)
                        const isInHover = !!(hoverFrom && hoverTo && isWithinInterval(day, { start: hoverFrom, end: hoverTo }) && !isEndpoint)
                        const isToday = isSameDay(day, new Date())
                        const isFuture = day > new Date()

                        return (
                            <div
                                key={day.toISOString()}
                                className={`relative flex items-center justify-center h-7 ${isInRange || isInHover ? 'bg-white/[0.06]' : ''} ${isFrom && value?.to && !isSameDay(value.from, value.to) ? 'rounded-l-full' : ''} ${isTo && !isSameDay(value!.from!, value.to!) ? 'rounded-r-full' : ''}`}
                            >
                                <button
                                    disabled={isFuture}
                                    onClick={() => !isFuture && handleDayClick(day)}
                                    onMouseEnter={() => selecting && setHovered(day)}
                                    className={`
                                        w-7 h-7 flex items-center justify-center text-[11px] rounded-full transition-all
                                        ${isFuture ? 'opacity-25 cursor-not-allowed text-gray-500' : 'cursor-pointer'}
                                        ${isEndpoint ? 'bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/30' : ''}
                                        ${isToday && !isEndpoint ? 'ring-1 ring-white/30 text-white font-semibold' : ''}
                                        ${!isEndpoint && !isFuture ? 'text-gray-300 hover:bg-white/10' : ''}
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
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 h-8 px-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors whitespace-nowrap"
            >
                <CalendarIcon size={12} className="text-gray-500" />
                {label}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-10 z-[200] w-[460px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5 rounded-t-2xl">
                        <span className="text-xs text-gray-500">{t('dashboard_components.selected_period')}</span>
                        <button
                            onClick={() => { const d = startOfDay(new Date()); onChange({ from: d, to: d }); setLeftMonth(startOfMonth(subMonths(d, 1))) }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-gray-300 hover:bg-white/10 transition-colors"
                        >
                            <CalendarIcon size={11} />
                            {t('dashboard_components.today')}
                        </button>
                    </div>

                    {/* Preset selector */}
                    <div className="px-4 pt-3 pb-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPresets(s => !s) }}
                            className="w-full flex items-center justify-between h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.08] transition-colors"
                        >
                            <span>{label}</span>
                            <ChevronDown size={13} className={`text-gray-500 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                        </button>

                        {showPresets && (
                            <div className="mt-1 bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
                                {PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={(e) => { e.stopPropagation(); applyPreset(p.label) }}
                                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${label === p.label ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-blue-400 hover:bg-blue-500/5'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Calendars */}
                    {!showPresets && (
                        <div className="flex gap-4 px-4 pb-4 pt-1">
                            {renderMonth(leftMonth, 'left')}
                            <div className="w-px bg-white/5" />
                            {renderMonth(rightMonth, 'right')}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

