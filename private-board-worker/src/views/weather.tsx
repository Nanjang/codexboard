import type { WeatherPayload, WeatherRecord, WeatherLocationId } from '../lib/weather'
import { WEATHER_LOCATIONS } from '../lib/weather'
import type { DeployInfo } from '../types'
import { PublicLayout } from './layout'

interface WeatherPageProps {
  appName: string
  deployInfo: DeployInfo
  data: WeatherPayload
  jsonUrl: string
  comparison: WeatherComparison
}

export type WeatherComparisonChoice = 'previous' | 'current' | 'year-2' | 'year-3' | 'year-4' | 'year-5'

export const WEATHER_COMPARISON_OPTIONS: Array<{ value: WeatherComparisonChoice; label: string }> = [
  { value: 'year-5', label: '5년 전' },
  { value: 'year-4', label: '4년 전' },
  { value: 'year-3', label: '3년 전' },
  { value: 'year-2', label: '2년 전' },
  { value: 'previous', label: '전년' },
  { value: 'current', label: '올해' },
]

export interface WeatherComparison {
  left: WeatherComparisonChoice
  right: WeatherComparisonChoice
}

export function weatherComparisonChoice(value: string | null | undefined): WeatherComparisonChoice {
  return WEATHER_COMPARISON_OPTIONS.some((option) => option.value === value)
    ? value as WeatherComparisonChoice
    : 'previous'
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
  seriesByYear: Map<number, { max: ChartPoint[]; min: ChartPoint[] }>
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
const WEATHER_BADGE_WIDTH = 120
const WEATHER_BADGE_HEIGHT = 20

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
  const days = dateKeys(currentYear)
  const keyIndex = new Map(days.map((key, index) => [key, index]))
  const recordsByYear = new Map<number, WeatherRecord[]>()
  data.records.forEach((record) => {
    const year = Number(record.date.slice(0, 4))
    const records = recordsByYear.get(year) ?? []
    records.push(record)
    recordsByYear.set(year, records)
  })
  const seriesByYear = new Map<number, { max: ChartPoint[]; min: ChartPoint[] }>()
  recordsByYear.forEach((records, year) => {
    seriesByYear.set(year, {
      max: toChartPoints(records, keyIndex, 'maxC'),
      min: toChartPoints(records, keyIndex, 'minC'),
    })
  })
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
    seriesByYear,
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

function rangePath(maxPoints: ChartPoint[], minPoints: ChartPoint[], model: ChartModel): string {
  const maxByIndex = new Map(maxPoints.map((point) => [point.index, point]))
  const minByIndex = new Map(minPoints.map((point) => [point.index, point]))
  const indices = [...maxByIndex.keys()]
    .filter((index) => minByIndex.has(index))
    .sort((left, right) => left - right)
  const paths: string[] = []
  let segment: number[] = []

  const flush = (): void => {
    if (segment.length === 0) return
    const upper = segment.map((index) => {
      const point = maxByIndex.get(index)!
      return `${xPosition(index, model.days.length - 1).toFixed(2)},${yPosition(point.value, model).toFixed(2)}`
    })
    const lower = [...segment].reverse().map((index) => {
      const point = minByIndex.get(index)!
      return `${xPosition(index, model.days.length - 1).toFixed(2)},${yPosition(point.value, model).toFixed(2)}`
    })
    paths.push(`M${upper.join(' L')} L${lower.join(' L')} Z`)
    segment = []
  }

  for (const index of indices) {
    if (segment.length > 0 && index !== segment[segment.length - 1]! + 1) flush()
    segment.push(index)
  }
  flush()
  return paths.join(' ')
}

function recordForToday(data: WeatherPayload): WeatherRecord | null {
  return data.records.find((record) => record.date === data.asOf) ?? null
}

function temperatureLabel(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}℃`
}

function temperatureAttribute(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function badgeTemperatureLabel(value: number | null): string {
  return value === null ? '' : value.toFixed(1)
}

function dateLabel(date: string): string {
  return `${date.slice(0, 4)}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
}

function comparisonOffset(choice: WeatherComparisonChoice): number {
  if (choice === 'current') return 0
  if (choice === 'previous') return 1
  return Number(choice.slice(5))
}

function comparisonYear(choice: WeatherComparisonChoice, currentYear: number): number {
  return currentYear - comparisonOffset(choice)
}

function comparisonLabel(choice: WeatherComparisonChoice): string {
  return WEATHER_COMPARISON_OPTIONS.find((option) => option.value === choice)?.label ?? '전년'
}

function comparisonRecord(
  recordsByDate: Map<string, WeatherRecord>,
  key: string,
  currentYear: number,
  choice: WeatherComparisonChoice,
): WeatherRecord | undefined {
  return recordsByDate.get(`${comparisonYear(choice, currentYear)}-${key}`)
}

function weatherFocusSeriesText(year: number, label: string, record: WeatherRecord | undefined): string {
  return `${year}년 ${label} · 최고 ${temperatureLabel(record?.maxC ?? null)} · 최저 ${temperatureLabel(record?.minC ?? null)}`
}

function comparisonPoints(
  model: ChartModel,
  currentYear: number,
  choice: WeatherComparisonChoice,
  field: 'maxC' | 'minC',
): ChartPoint[] {
  const series = model.seriesByYear.get(comparisonYear(choice, currentYear))
  return field === 'maxC' ? series?.max ?? [] : series?.min ?? []
}

function WeatherChart({ data, comparison }: { data: WeatherPayload; comparison: WeatherComparison }) {
  const model = buildChartModel(data)
  const currentYear = Number(data.asOf.slice(0, 4))
  const recordsByDate = new Map(data.records.map((record) => [record.date, record]))
  const leftYear = comparisonYear(comparison.left, currentYear)
  const rightYear = comparisonYear(comparison.right, currentYear)
  const leftMax = comparisonPoints(model, currentYear, comparison.left, 'maxC')
  const leftMin = comparisonPoints(model, currentYear, comparison.left, 'minC')
  const rightMax = comparisonPoints(model, currentYear, comparison.right, 'maxC')
  const rightMin = comparisonPoints(model, currentYear, comparison.right, 'minC')
  const rightToday = comparisonRecord(recordsByDate, data.asOf.slice(5), currentYear, comparison.right)
  const leftToday = comparisonRecord(recordsByDate, data.asOf.slice(5), currentYear, comparison.left)
  const rightTodayMax = rightToday?.maxC ?? null
  const rightTodayMin = rightToday?.minC ?? null
  const showCurrentBadges = comparison.right === 'current'
  const focusLeftText = weatherFocusSeriesText(leftYear, comparisonLabel(comparison.left), leftToday)
  const focusRightText = weatherFocusSeriesText(rightYear, comparisonLabel(comparison.right), rightToday)
  const focusStatus = leftToday?.status === 'provisional' || rightToday?.status === 'provisional'
    ? '오늘 값은 잠정값입니다.'
    : ''
  const leftRangePath = rangePath(leftMax, leftMin, model)
  const rightMaxPath = linePath(rightMax, model)
  const rightMinPath = linePath(rightMin, model)
  const chartStep = CHART_PLOT_WIDTH / Math.max(model.days.length - 1, 1)

  return (
    <div class="weather-chart-card">
      <div class="weather-comparison-controls" data-weather-comparison-controls>
        <label>
          <select data-weather-comparison-left aria-label="좌측 비교 데이터">
            {WEATHER_COMPARISON_OPTIONS.map((option) => (
              <option value={option.value} selected={comparison.left === option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <select data-weather-comparison-right aria-label="우측 비교 데이터">
            {WEATHER_COMPARISON_OPTIONS.map((option) => (
              <option value={option.value} selected={comparison.right === option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          class="button button-small"
          type="button"
          data-weather-comparison-apply
          disabled={comparison.left === comparison.right}
        >
          반영
        </button>
      </div>
      <div class="weather-chart-legend" aria-label="그래프 범례">
        <span><i class="weather-legend-line weather-legend-max" /> 최고기온</span>
        <span><i class="weather-legend-line weather-legend-min" /> 최저기온</span>
        <span><i class="weather-legend-range" /> {leftYear}년 기온 범위</span>
        <span><i class="weather-legend-line weather-legend-current" /> {rightYear}년</span>
      </div>
      <div
        class="weather-focus"
        data-weather-focus
        data-weather-focus-default-index={String(model.todayIndex)}
        data-weather-focus-default-date={data.asOf}
        data-weather-focus-default-left={focusLeftText}
        data-weather-focus-default-right={focusRightText}
        data-weather-focus-default-status={focusStatus}
        role="status"
        aria-live="polite"
      >
        <div class="weather-focus-heading">
          <strong data-weather-focus-date>{dateLabel(data.asOf)}</strong>
          <small data-weather-focus-status>{focusStatus}</small>
        </div>
        <div class="weather-focus-grid">
          <span class="weather-focus-series weather-focus-series-left" data-weather-focus-left>{focusLeftText}</span>
          <span class="weather-focus-series weather-focus-series-right" data-weather-focus-right>{focusRightText}</span>
        </div>
      </div>
      <div class="weather-chart-layout">
        <div class="weather-chart-plot">
          <svg
            class="weather-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-labelledby="weather-chart-title weather-chart-description"
            data-weather-chart
            data-weather-chart-y-min={String(model.yMin)}
            data-weather-chart-y-max={String(model.yMax)}
            data-weather-chart-days={String(model.days.length)}
            data-weather-chart-left={String(CHART_LEFT)}
            data-weather-chart-right={String(CHART_WIDTH - CHART_RIGHT)}
            data-weather-chart-top={String(CHART_TOP)}
            data-weather-chart-bottom={String(CHART_HEIGHT - CHART_BOTTOM)}
            data-weather-chart-as-of={data.asOf}
            data-weather-chart-today-index={String(model.todayIndex)}
            data-weather-chart-points={JSON.stringify(
              [...leftMax, ...leftMin, ...rightMax, ...rightMin].map((point) => ({
                index: point.index,
                value: point.value,
              })),
            )}
          >
            <defs>
              <clipPath id="weather-chart-x-clip">
                <rect x={CHART_LEFT} y={CHART_TOP} width={CHART_PLOT_WIDTH} height={CHART_HEIGHT - CHART_TOP} />
              </clipPath>
            </defs>
            <title id="weather-chart-title">{data.location.name} 일 최고·최저기온</title>
            <desc id="weather-chart-description">
              {leftYear}년은 최고·최저기온 사이의 반투명 범위, {rightYear}년은 실선으로 표시합니다.
            </desc>

            {model.yTicks.map((tick) => {
              const y = yPosition(tick, model)
              return (
                <g key={`y-${tick}`} data-weather-y-tick data-weather-y-value={String(tick)}>
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

            <g clip-path="url(#weather-chart-x-clip)">
              <g data-weather-x-layer>
                {model.monthStarts.map((month) => {
                  const x = xPosition(month.index, model.days.length - 1)
                  return (
                    <g key={month.label}>
                      <line x1={x} x2={x} y1={CHART_TOP} y2={CHART_HEIGHT - CHART_BOTTOM} class="weather-month-line" />
                      <text
                        x={x}
                        y={CHART_HEIGHT - 18}
                        text-anchor="middle"
                        class="weather-month-label"
                        data-weather-month-label
                        data-weather-month-x={String(x)}
                      >
                        {month.label}
                      </text>
                    </g>
                  )
                })}

                <g data-weather-y-layer>
                {leftRangePath ? (
                  <path d={leftRangePath} class="weather-year-range" fill="#839b88" opacity="0.18" />
                ) : null}
                {rightMaxPath ? <path d={rightMaxPath} class="weather-series weather-series-max weather-series-current" /> : null}
                {rightMinPath ? <path d={rightMinPath} class="weather-series weather-series-min weather-series-current" /> : null}

                {!showCurrentBadges ? (
                  <g class="weather-focus-points" data-weather-focus-points aria-hidden="true">
                    {(
                      [
                        ['right-max', rightTodayMax],
                        ['right-min', rightTodayMin],
                      ] as const
                    ).map(([point, value]) => (
                      value !== null ? (
                        <circle
                          key={point}
                          class={`weather-focus-point weather-focus-point-${point}`}
                          data-weather-focus-point={point}
                          data-weather-default-value={String(value)}
                          cx={xPosition(model.todayIndex, model.days.length - 1)}
                          cy={yPosition(value, model)}
                          r="2.5"
                        />
                      ) : null
                    ))}
                  </g>
                ) : null}
              </g>

                {model.days.map((key, index) => {
                  const currentDate = `${currentYear}-${key}`
                  const leftRecord = comparisonRecord(recordsByDate, key, currentYear, comparison.left)
                  const rightRecord = comparisonRecord(recordsByDate, key, currentYear, comparison.right)
                  const x = xPosition(index, model.days.length - 1)
                  const zoneX = index === 0 ? CHART_LEFT : x - chartStep / 2
                  const zoneWidth = index === 0 || index === model.days.length - 1 ? chartStep / 2 : chartStep
                  return (
                    <rect
                      class="weather-hover-zone"
                      x={zoneX}
                      y={CHART_TOP}
                      width={zoneWidth}
                      height={CHART_PLOT_HEIGHT}
                      fill="transparent"
                      data-weather-zone
                      data-weather-index={String(index)}
                      data-weather-date={currentDate}
                      data-weather-left-year={String(leftYear)}
                      data-weather-left-label={comparisonLabel(comparison.left)}
                      data-weather-left-max={temperatureAttribute(leftRecord?.maxC)}
                      data-weather-left-min={temperatureAttribute(leftRecord?.minC)}
                      data-weather-left-status={leftRecord?.status ?? ''}
                      data-weather-right-year={String(rightYear)}
                      data-weather-right-label={comparisonLabel(comparison.right)}
                      data-weather-right-max={temperatureAttribute(rightRecord?.maxC)}
                      data-weather-right-min={temperatureAttribute(rightRecord?.minC)}
                      data-weather-right-status={rightRecord?.status ?? ''}
                      aria-label={`${currentDate} 날씨 데이터`}
                      key={currentDate}
                    />
                  )
                })}
              </g>

              {showCurrentBadges ? (
                <g
                  class="weather-focus-badges"
                  data-weather-focus-badges
                  data-weather-badge-index={String(model.todayIndex)}
                  data-weather-badge-width={String(WEATHER_BADGE_WIDTH)}
                  data-weather-badge-height={String(WEATHER_BADGE_HEIGHT)}
                  aria-hidden="true"
                >
                  {rightTodayMax !== null ? (
                    <g
                      class="weather-focus-badge weather-focus-badge-max"
                      data-weather-focus-badge="max"
                      data-weather-badge-value={String(rightTodayMax)}
                      transform={`translate(${xPosition(model.todayIndex, model.days.length - 1)} ${yPosition(rightTodayMax, model)})`}
                    >
                      <rect
                        class="weather-focus-badge-body"
                        x={-WEATHER_BADGE_WIDTH / 2}
                        y={-WEATHER_BADGE_HEIGHT / 2}
                        width={WEATHER_BADGE_WIDTH}
                        height={WEATHER_BADGE_HEIGHT}
                        rx="10"
                      />
                      <text class="weather-focus-badge-text" x="0" y="1">{badgeTemperatureLabel(rightTodayMax)}</text>
                    </g>
                  ) : null}
                  {rightTodayMin !== null ? (
                    <g
                      class="weather-focus-badge weather-focus-badge-min"
                      data-weather-focus-badge="min"
                      data-weather-badge-value={String(rightTodayMin)}
                      transform={`translate(${xPosition(model.todayIndex, model.days.length - 1)} ${yPosition(rightTodayMin, model)})`}
                    >
                      <rect
                        class="weather-focus-badge-body"
                        x={-WEATHER_BADGE_WIDTH / 2}
                        y={-WEATHER_BADGE_HEIGHT / 2}
                        width={WEATHER_BADGE_WIDTH}
                        height={WEATHER_BADGE_HEIGHT}
                        rx="10"
                      />
                      <text class="weather-focus-badge-text" x="0" y="1">{badgeTemperatureLabel(rightTodayMin)}</text>
                    </g>
                  ) : null}
                </g>
              ) : null}
            </g>
          </svg>
        </div>
      </div>
      <div class="weather-range-controls" data-weather-range-controls aria-label="그래프 표시 범위">
        <span class="weather-range-label">표시 범위</span>
        <button class="button button-secondary button-small weather-range-button" type="button" data-weather-range="year" aria-pressed="true">
          1년
        </button>
        <button class="button button-secondary button-small weather-range-button" type="button" data-weather-range="two-months" aria-pressed="false">
          오늘 전후 2개월
        </button>
      </div>
      <p class="weather-chart-caption">전년은 최고·최저기온 사이의 범위로 표시하며, 세로선은 월 시작점입니다. 범위 버튼이나 그래프 휠로 날짜 구간을 조정할 수 있고 Y축은 보이는 값에 맞춰 자동 조정됩니다.</p>
    </div>
  )
}

export function WeatherPage({ appName, deployInfo, data, jsonUrl, comparison }: WeatherPageProps) {
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
          <WeatherChart data={data} comparison={comparison} />
        ) : (
          <section class="weather-empty-card">
            <h2>날씨 데이터 준비 중</h2>
            <p>기상청 일자료를 아직 가져오지 못했습니다. 잠시 후 다시 열어주세요.</p>
          </section>
        )}

        <footer class="weather-source-note">
          출처: <a href="https://apihub.kma.go.kr/apiList.do?seqApi=2&seqApiSub=239" target="_blank" rel="noreferrer">기상청 API Hub 공식 문서</a> · 일별 기온자료 · JSON 원본은 <a href={jsonUrl}>이 링크</a>에서 확인할 수 있습니다.
        </footer>
      </main>
    </PublicLayout>
  )
}

export function weatherJsonUrl(location: WeatherLocationId): string {
  return `/weather.json?location=${encodeURIComponent(location)}`
}
