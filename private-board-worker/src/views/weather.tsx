import type { WeatherPayload, WeatherRecord, WeatherLocationId } from '../lib/weather'
import { WEATHER_LOCATIONS } from '../lib/weather'
import type { DeployInfo } from '../types'
import { PublicLayout } from './layout'

interface WeatherPageProps {
  appName: string
  deployInfo: DeployInfo
  data: WeatherPayload
  jsonUrl: string
}

interface ChartPoint {
  index: number
  value: number
}

interface ChartModel {
  days: string[]
  monthStarts: Array<{ label: string; index: number }>
  yTicks: number[]
  yMin: number
  yMax: number
  previousMax: ChartPoint[]
  previousMin: ChartPoint[]
  currentMax: ChartPoint[]
  currentMin: ChartPoint[]
  todayIndex: number
}

const CHART_WIDTH = 1000
const CHART_HEIGHT = 470
const CHART_LEFT = 64
const CHART_RIGHT = 64
const CHART_TOP = 30
const CHART_BOTTOM = 56
const CHART_PLOT_WIDTH = CHART_WIDTH - CHART_LEFT - CHART_RIGHT
const CHART_PLOT_HEIGHT = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM

function dateKeys(year: number): string[] {
  const result: string[] = []
  const date = new Date(`${year}-01-01T00:00:00.000Z`)
  while (date.getUTCFullYear() === year) {
    result.push(date.toISOString().slice(5, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return result
}

function finiteValues(records: WeatherRecord[]): number[] {
  return records.flatMap((record) => [record.maxC, record.minC]).filter((value): value is number => value !== null)
}

function toChartPoints(
  records: WeatherRecord[],
  keyIndex: Map<string, number>,
  field: 'maxC' | 'minC',
): ChartPoint[] {
  return records.flatMap((record) => {
    const value = record[field]
    const index = keyIndex.get(record.date.slice(5))
    return value !== null && index !== undefined ? [{ index, value }] : []
  })
}

function buildChartModel(data: WeatherPayload): ChartModel {
  const currentYear = Number(data.asOf.slice(0, 4))
  const previousYear = currentYear - 1
  const days = dateKeys(currentYear)
  const keyIndex = new Map(days.map((key, index) => [key, index]))
  const previousRecords = data.records.filter((record) => record.date.startsWith(`${previousYear}-`))
  const currentRecords = data.records.filter((record) => record.date.startsWith(`${currentYear}-`))
  const values = finiteValues(data.records)
  const dataMin = values.length > 0 ? Math.min(...values) : 0
  const dataMax = values.length > 0 ? Math.max(...values) : 30
  let yMin = Math.floor((dataMin - 5) / 5) * 5
  let yMax = Math.ceil((dataMax + 5) / 5) * 5
  if (yMax - yMin < 20) {
    const center = (yMax + yMin) / 2
    yMin = Math.floor((center - 10) / 5) * 5
    yMax = yMin + 20
  }

  const yTicks: number[] = []
  for (let value = yMin; value <= yMax; value += 5) yTicks.push(value)

  return {
    days,
    monthStarts: Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0')
      return { label: `${index + 1}월`, index: keyIndex.get(`${month}-01`) ?? 0 }
    }),
    yTicks,
    yMin,
    yMax,
    previousMax: toChartPoints(previousRecords, keyIndex, 'maxC'),
    previousMin: toChartPoints(previousRecords, keyIndex, 'minC'),
    currentMax: toChartPoints(currentRecords, keyIndex, 'maxC'),
    currentMin: toChartPoints(currentRecords, keyIndex, 'minC'),
    todayIndex: keyIndex.get(data.asOf.slice(5)) ?? 0,
  }
}

function xPosition(index: number, lastIndex: number): number {
  return CHART_LEFT + (index / Math.max(lastIndex, 1)) * CHART_PLOT_WIDTH
}

function yPosition(value: number, model: ChartModel): number {
  return CHART_TOP + ((model.yMax - value) / (model.yMax - model.yMin)) * CHART_PLOT_HEIGHT
}

function linePath(points: ChartPoint[], model: ChartModel): string {
  let path = ''
  let previousIndex = -2
  for (const point of points) {
    const command = point.index === previousIndex + 1 ? 'L' : 'M'
    path += `${command}${xPosition(point.index, model.days.length - 1).toFixed(2)},${yPosition(point.value, model).toFixed(2)} `
    previousIndex = point.index
  }
  return path.trim()
}

function recordForToday(data: WeatherPayload): WeatherRecord | null {
  return data.records.find((record) => record.date === data.asOf) ?? null
}

function temperatureLabel(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}℃`
}

function dateLabel(date: string): string {
  return `${date.slice(0, 4)}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
}

function WeatherChart({ data }: { data: WeatherPayload }) {
  const model = buildChartModel(data)
  const today = recordForToday(data)
  const previousYear = Number(data.asOf.slice(0, 4)) - 1
  const currentYear = Number(data.asOf.slice(0, 4))
  const previousMaxPath = linePath(model.previousMax, model)
  const previousMinPath = linePath(model.previousMin, model)
  const currentMaxPath = linePath(model.currentMax, model)
  const currentMinPath = linePath(model.currentMin, model)

  return (
    <div class="weather-chart-card">
      <div class="weather-chart-legend" aria-label="그래프 범례">
        <span><i class="weather-legend-line weather-legend-max" /> 최고기온</span>
        <span><i class="weather-legend-line weather-legend-min" /> 최저기온</span>
        <span><i class="weather-legend-line weather-legend-previous" /> {previousYear}년</span>
        <span><i class="weather-legend-line weather-legend-current" /> {currentYear}년</span>
      </div>
      <svg
        class="weather-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-labelledby="weather-chart-title weather-chart-description"
      >
        <title id="weather-chart-title">{data.location.name} 일 최고·최저기온</title>
        <desc id="weather-chart-description">
          {previousYear}년은 점선과 반투명 선, {currentYear}년은 실선으로 표시합니다.
        </desc>

        {model.yTicks.map((tick) => {
          const y = yPosition(tick, model)
          return (
            <g key={`y-${tick}`}>
              <line x1={CHART_LEFT} x2={CHART_WIDTH - CHART_RIGHT} y1={y} y2={y} class="weather-grid-line" />
              <text x={CHART_LEFT - 12} y={y + 4} text-anchor="end" class="weather-axis-label">
                {tick}°
              </text>
              <text x={CHART_WIDTH - CHART_RIGHT + 12} y={y + 4} class="weather-axis-label">
                {tick}°
              </text>
            </g>
          )
        })}

        {model.monthStarts.map((month) => {
          const x = xPosition(month.index, model.days.length - 1)
          return (
            <g key={month.label}>
              <line x1={x} x2={x} y1={CHART_TOP} y2={CHART_HEIGHT - CHART_BOTTOM} class="weather-month-line" />
              <text x={x} y={CHART_HEIGHT - 18} text-anchor="middle" class="weather-month-label">
                {month.label}
              </text>
            </g>
          )
        })}

        {previousMaxPath ? <path d={previousMaxPath} class="weather-series weather-series-max weather-series-previous" /> : null}
        {previousMinPath ? <path d={previousMinPath} class="weather-series weather-series-min weather-series-previous" /> : null}
        {currentMaxPath ? <path d={currentMaxPath} class="weather-series weather-series-max weather-series-current" /> : null}
        {currentMinPath ? <path d={currentMinPath} class="weather-series weather-series-min weather-series-current" /> : null}

        {today?.maxC !== null && today?.maxC !== undefined ? (
          <circle
            cx={xPosition(model.todayIndex, model.days.length - 1)}
            cy={yPosition(today.maxC, model)}
            r="4"
            class="weather-today-dot weather-today-dot-max"
          />
        ) : null}
        {today?.minC !== null && today?.minC !== undefined ? (
          <circle
            cx={xPosition(model.todayIndex, model.days.length - 1)}
            cy={yPosition(today.minC, model)}
            r="4"
            class="weather-today-dot weather-today-dot-min"
          />
        ) : null}
      </svg>
      <p class="weather-chart-caption">세로선은 월 시작점이며, 가로선과 좌우 눈금은 5℃ 간격입니다.</p>
    </div>
  )
}

export function WeatherPage({ appName, deployInfo, data, jsonUrl }: WeatherPageProps) {
  const today = recordForToday(data)
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle={`${data.location.name} 날씨`}>
      <main class="weather-page">
        <header class="weather-header">
          <div>
            <p class="eyebrow">기상청 관측자료</p>
            <h1>{data.location.name} 날씨</h1>
            <p>올해와 전년의 일 최고·최저기온을 비교합니다.</p>
          </div>
          <a class="button weather-json-link" href={jsonUrl} target="_blank" rel="noreferrer">
            JSON 데이터
          </a>
        </header>

        <nav class="weather-location-nav" aria-label="날씨 지역 선택">
          {WEATHER_LOCATIONS.map((location) => (
            <a
              class={`weather-location-link${location.id === data.location.id ? ' is-active' : ''}`}
              href={`/weather?location=${encodeURIComponent(location.id)}`}
              aria-current={location.id === data.location.id ? 'page' : undefined}
              key={location.id}
            >
              {location.name}
            </a>
          ))}
        </nav>

        <section class="weather-meta-card" aria-label="날씨 데이터 정보">
          <div>
            <strong>{dateLabel(data.asOf)} 기준</strong>
            <span>지점 {data.location.stationId} · {data.location.stationType}</span>
          </div>
          <div class="weather-today-summary">
            <span>오늘 잠정</span>
            <strong>최고 {temperatureLabel(today?.maxC ?? null)} · 최저 {temperatureLabel(today?.minC ?? null)}</strong>
          </div>
        </section>

        {data.warning ? <p class="weather-warning" role="status">{data.warning}</p> : null}
        {data.dataAvailable ? (
          <WeatherChart data={data} />
        ) : (
          <section class="weather-empty-card">
            <h2>날씨 데이터 준비 중</h2>
            <p>기상청 일자료를 아직 가져오지 못했습니다. 잠시 후 다시 열어주세요.</p>
          </section>
        )}

        <footer class="weather-source-note">
          출처: 기상청 API Hub · 일별 기온자료 · JSON 원본은 <a href={jsonUrl}>이 링크</a>에서 확인할 수 있습니다.
        </footer>
      </main>
    </PublicLayout>
  )
}

export function weatherJsonUrl(location: WeatherLocationId): string {
  return `/weather.json?location=${encodeURIComponent(location)}`
}
