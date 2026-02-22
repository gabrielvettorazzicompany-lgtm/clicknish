import { useMemo } from 'react'
import { useI18n } from '@/i18n'

interface CountryData {
    country: string
    count: number
    percentage: number
}

interface WorldMapProps {
    data: CountryData[]
    loading?: boolean
}

// Mapeamento dos códigos de países para coordenadas simplificadas no SVG
const COUNTRY_COORDS = {
    'BR': { cx: 290, cy: 340, name: 'Brasil' },
    'US': { cx: 180, cy: 200, name: 'Estados Unidos' },
    'CA': { cx: 150, cy: 150, name: 'Canadá' },
    'MX': { cx: 120, cy: 250, name: 'México' },
    'AR': { cx: 280, cy: 420, name: 'Argentina' },
    'CL': { cx: 260, cy: 450, name: 'Chile' },
    'PE': { cx: 250, cy: 350, name: 'Peru' },
    'CO': { cx: 240, cy: 300, name: 'Colômbia' },
    'GB': { cx: 450, cy: 180, name: 'Reino Unido' },
    'FR': { cx: 470, cy: 200, name: 'França' },
    'DE': { cx: 480, cy: 180, name: 'Alemanha' },
    'IT': { cx: 480, cy: 220, name: 'Itália' },
    'ES': { cx: 440, cy: 220, name: 'Espanha' },
    'PT': { cx: 420, cy: 220, name: 'Portugal' },
    'IN': { cx: 600, cy: 280, name: 'Índia' },
    'CN': { cx: 700, cy: 220, name: 'China' },
    'JP': { cx: 780, cy: 220, name: 'Japão' },
    'AU': { cx: 750, cy: 450, name: 'Austrália' },
    'ZA': { cx: 520, cy: 400, name: 'África do Sul' },
    'EG': { cx: 520, cy: 280, name: 'Egito' },
    'RU': { cx: 600, cy: 150, name: 'Rússia' },
    'TR': { cx: 520, cy: 220, name: 'Turquia' },
}

// Continentes simplificados para o fundo
const CONTINENT_PATHS = {
    northAmerica: "M50,80 L200,80 L220,150 L180,200 L120,250 L80,200 Z",
    southAmerica: "M200,250 L260,280 L300,350 L280,450 L240,470 L200,400 L180,350 L190,300 Z",
    europe: "M400,120 L500,120 L520,180 L480,220 L420,200 L400,160 Z",
    africa: "M420,220 L520,220 L540,300 L520,400 L480,420 L440,380 L420,300 Z",
    asia: "M520,80 L750,80 L780,150 L720,250 L600,280 L520,200 Z",
    oceania: "M720,380 L800,380 L820,420 L780,460 L720,450 Z"
}

export default function WorldMap({ data, loading }: WorldMapProps) {
    const { t } = useI18n()

    const maxCount = useMemo(() => {
        if (!data.length) return 1
        return Math.max(...data.map(item => item.count))
    }, [data])

    const getCountryRadius = (count: number) => {
        if (count === 0) return 0
        const minRadius = 8
        const maxRadius = 25
        const ratio = count / maxCount
        return minRadius + (maxRadius - minRadius) * ratio
    }

    const getCountryOpacity = (count: number) => {
        if (count === 0) return 0
        const minOpacity = 0.3
        const maxOpacity = 1
        const ratio = count / maxCount
        return minOpacity + (maxOpacity - minOpacity) * ratio
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl p-6 rounded-lg border dark:border-white/10 h-96 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard_components.loading_world_map')}</p>
                </div>
            </div>
        )
    }

    // Mapeamento dos países por código
    const countryByCode = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return new Map()

        const map = new Map<string, CountryData>()
        data.forEach(item => {
            if (!item?.country) return

            // Tentar mapear nome para código (simplificado)
            const code = Object.entries(COUNTRY_COORDS).find(([_, info]) =>
                info.name.toLowerCase() === item.country.toLowerCase()
            )?.[0] || ''

            if (code) {
                map.set(code, item)
            }
        })
        return map
    }, [data])

    return (
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl p-6 rounded-lg border dark:border-white/10 h-96">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Vendas por País</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {data.length} países ativo{data.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="relative w-full h-full">
                <svg
                    viewBox="0 0 900 500"
                    className="w-full h-full"
                    style={{ maxHeight: '280px' }}
                >
                    {/* Fundo dos continentes */}
                    <g fill="#e5e7eb" className="dark:fill-gray-700">
                        {Object.entries(CONTINENT_PATHS).map(([continent, path]) => (
                            <path
                                key={continent}
                                d={path}
                                className="opacity-30"
                            />
                        ))}
                    </g>

                    {/* Grid de fundo */}
                    <defs>
                        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f3f4f6" strokeWidth="1" className="dark:stroke-gray-600" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />

                    {/* Países com dados */}
                    {Object.entries(COUNTRY_COORDS).map(([code, coords]) => {
                        const countryData = countryByCode.get(code)
                        const radius = countryData ? getCountryRadius(countryData.count) : 4
                        const opacity = countryData ? getCountryOpacity(countryData.count) : 0.1
                        const hasData = !!countryData

                        return (
                            <g key={code}>
                                {/* Círculo do país */}
                                <circle
                                    cx={coords.cx}
                                    cy={coords.cy}
                                    r={radius}
                                    fill={hasData ? "#10b981" : "#d1d5db"}
                                    opacity={opacity}
                                    className={`transition-all duration-300 ${hasData ? 'cursor-pointer hover:scale-110' : ''}`}
                                    stroke={hasData ? "#059669" : "#9ca3af"}
                                    strokeWidth={hasData ? 2 : 1}
                                >
                                    {hasData && (
                                        <title>
                                            {coords.name}: {countryData.count} visitas ({countryData.percentage.toFixed(1)}%)
                                        </title>
                                    )}
                                </circle>

                                {/* Label do país */}
                                {hasData && radius > 12 && (
                                    <text
                                        x={coords.cx}
                                        y={coords.cy + 4}
                                        textAnchor="middle"
                                        className="text-xs font-bold fill-white"
                                        style={{ fontSize: '10px', pointerEvents: 'none' }}
                                    >
                                        {countryData.count}
                                    </text>
                                )}

                                {/* Nome do país abaixo */}
                                {hasData && (
                                    <text
                                        x={coords.cx}
                                        y={coords.cy + radius + 15}
                                        textAnchor="middle"
                                        className="text-xs fill-gray-600 dark:fill-gray-400"
                                        style={{ fontSize: '9px', pointerEvents: 'none' }}
                                    >
                                        {coords.name}
                                    </text>
                                )}
                            </g>
                        )
                    })}

                    {/* Legenda */}
                    <g transform="translate(20, 420)">
                        <rect x="0" y="0" width="200" height="60" fill="rgba(255,255,255,0.9)" stroke="#e5e7eb" rx="4" />
                        <text x="10" y="15" className="text-xs font-semibold fill-gray-700">Legenda</text>

                        <circle cx="20" cy="30" r="4" fill="#d1d5db" />
                        <text x="30" y="34" className="text-xs fill-gray-600">Sem dados</text>

                        <circle cx="20" cy="45" r="8" fill="#10b981" opacity="0.6" />
                        <text x="35" y="49" className="text-xs fill-gray-600">Com visitas</text>

                        <circle cx="110" cy="45" r="12" fill="#10b981" />
                        <text x="130" y="49" className="text-xs fill-gray-600">Mais acessos</text>
                    </g>
                </svg>

                {data.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80">
                        <p className="text-gray-500 dark:text-gray-400 text-center">
                            Nenhum dado de localização disponível
                            <br />
                            <span className="text-sm">Os países aparecerão conforme as visitas chegarem</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}