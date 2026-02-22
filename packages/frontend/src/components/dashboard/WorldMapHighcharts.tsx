import { useMemo, memo } from 'react'
import { useI18n } from '@/i18n'
import Highcharts from 'highcharts/highmaps'
import HighchartsReact from 'highcharts-react-official'
import worldMap from '@highcharts/map-collection/custom/world.geo.json'

interface CountryData {
    country: string
    count: number
    percentage: number
}

interface WorldMapHighchartsProps {
    data: CountryData[]
    loading?: boolean
}

const COUNTRY_MAPPING: Record<string, string> = {
    'Brasil': 'br', 'Brazil': 'br',
    'Estados Unidos': 'us', 'United States': 'us',
    'Canada': 'ca', 'Canadá': 'ca',
    'México': 'mx', 'Mexico': 'mx',
    'Argentina': 'ar', 'Chile': 'cl',
    'Peru': 'pe', 'Colômbia': 'co', 'Colombia': 'co',
    'Venezuela': 've', 'Uruguay': 'uy', 'Uruguai': 'uy',
    'Paraguai': 'py', 'Paraguay': 'py',
    'Bolívia': 'bo', 'Bolivia': 'bo',
    'Equador': 'ec', 'Ecuador': 'ec',
    'Reino Unido': 'gb', 'United Kingdom': 'gb',
    'França': 'fr', 'France': 'fr',
    'Alemanha': 'de', 'Germany': 'de',
    'Itália': 'it', 'Italy': 'it',
    'Espanha': 'es', 'Spain': 'es',
    'Portugal': 'pt',
    'Países Baixos': 'nl', 'Netherlands': 'nl',
    'Bélgica': 'be', 'Belgium': 'be',
    'Suíça': 'ch', 'Switzerland': 'ch',
    'Suécia': 'se', 'Sweden': 'se',
    'Noruega': 'no', 'Norway': 'no',
    'Dinamarca': 'dk', 'Denmark': 'dk',
    'Finlândia': 'fi', 'Finland': 'fi',
    'Polônia': 'pl', 'Poland': 'pl',
    'Índia': 'in', 'India': 'in',
    'China': 'cn',
    'Japão': 'jp', 'Japan': 'jp',
    'Coreia do Sul': 'kr', 'South Korea': 'kr',
    'Austrália': 'au', 'Australia': 'au',
    'Nova Zelândia': 'nz', 'New Zealand': 'nz',
    'África do Sul': 'za', 'South Africa': 'za',
    'Egito': 'eg', 'Egypt': 'eg',
    'Nigéria': 'ng', 'Nigeria': 'ng',
    'Rússia': 'ru', 'Russia': 'ru',
    'Turquia': 'tr', 'Turkey': 'tr',
    'Israel': 'il',
    'Arabia Saudita': 'sa', 'Saudi Arabia': 'sa',
    'Emirados Árabes': 'ae', 'UAE': 'ae',
}

function WorldMapHighcharts({ data, loading }: WorldMapHighchartsProps) {
    const { t } = useI18n()

    const mapData = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return []
        return data
            .map(item => {
                const isIsoCode = /^[A-Za-z]{2}$/.test(item.country.trim())
                const hcKey = isIsoCode
                    ? item.country.toLowerCase()
                    : (COUNTRY_MAPPING[item.country] || null)

                return {
                    'hc-key': hcKey,
                    value: item.count,
                    name: item.country,
                    percentage: item.percentage
                }
            })
            .filter(item => item['hc-key'] !== null)
    }, [data])

    const maxValue = useMemo(() => {
        if (!mapData.length) return 1
        return Math.max(...mapData.map(item => item.value), 1)
    }, [mapData])

    const chartOptions = useMemo(() => ({
        chart: {
            map: worldMap,
            backgroundColor: '#111827',
            height: 520,
            margin: [10, 0, 36, 0],
        },
        title: { text: undefined },
        subtitle: { text: undefined },
        mapNavigation: { enabled: false },
        colorAxis: {
            min: 0,
            max: maxValue,
            stops: [
                [0, '#93c5fd'] as [number, string],
                [0.4, '#3b82f6'] as [number, string],
                [0.7, '#1d4ed8'] as [number, string],
                [1, '#1e3a8a'] as [number, string],
            ],
            labels: { style: { color: '#9ca3af', fontSize: '11px' } }
        },
        series: [{
            type: 'map' as const,
            name: t('dashboard_components.map_series_name'),
            data: mapData,
            nullColor: '#1f2937',
            borderColor: '#374151',
            borderWidth: 0.5,
            states: {
                hover: {
                    color: '#fbbf24',
                    borderColor: '#f59e0b',
                    borderWidth: 1.5
                }
            },
            dataLabels: { enabled: false }
        }],
        legend: { enabled: false },
        tooltip: {
            useHTML: true,
            backgroundColor: '#1f2937',
            borderColor: '#374151',
            borderRadius: 8,
            style: { color: '#f9fafb', fontSize: '13px' },
            formatter: function (this: { point: { name: string; value: number; percentage: number } }) {
                const point = this.point
                if (!point.value) return false
                return `<b style="color:#fff">${point.name}</b><br/>
                    <span style="color:#93c5fd">● ${t('dashboard_components.map_sales')}:</span> <b style="color:#fff">${point.value}</b><br/>
                    <span style="color:#60a5fa">● ${t('dashboard_components.map_participation')}:</span> <b style="color:#fff">${point.percentage?.toFixed(1) ?? 0}%</b>`
            }
        },
        credits: { enabled: false },
        plotOptions: { map: { animation: true } }
    }), [mapData, maxValue, data.length, t])

    if (loading) {
        return (
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 h-[580px] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-400 text-sm">{t('dashboard_components.loading_world_map')}</p>
                </div>
            </div>
        )
    }



    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            <HighchartsReact
                highcharts={Highcharts}
                constructorType="mapChart"
                options={chartOptions}
                containerProps={{ style: { width: '100%' } }}
            />

        </div>
    )
}

export default memo(WorldMapHighcharts)
