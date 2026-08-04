import type { Bindings } from '../types'

const KMA_DAILY_URL = 'https://apihub.kma.go.kr/api/typ01/url/sfc_aws_day.php'
const KMA_REQUEST_TIMEOUT_MS = 15_000
const KMA_MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const WEATHER_TODAY_REFRESH_MS = 10 * 60 * 1000

export const WEATHER_LOCATIONS = [
  { id: 'seoul', name: '서울', stationId: 108, stationType: 'ASOS' },
  { id: 'seongnam', name: '성남', stationId: 572, stationType: 'AWS' },
  { id: 'daejeon', name: '대전', stationId: 133, stationType: 'ASOS' },
  { id: 'daegu', name: '대구', stationId: 143, stationType: 'ASOS' },
  { id: 'busan', name: '부산', stationId: 159, stationType: 'ASOS' },
] as const

export type WeatherLocationId = (typeof WEATHER_LOCATIONS)[number]['id']
export type WeatherStatus = 'confirmed' | 'provisional'
export type WeatherStationType = 'ASOS' | 'AWS'

export interface WeatherLocation {
  id: WeatherLocationId
  name: string
  stationId: number
  stationType: WeatherStationType
}

export interface WeatherRecord {
  date: string
  maxC: number | null
  minC: number | null
  status: WeatherStatus
}

export interface WeatherPayload {
  version: 1
  location: WeatherLocation
  asOf: string
  range: { from: string; to: string }
  dataAvailable: boolean
  source: {
    provider: 'KMA API Hub'
    endpoint: 'sfc_aws_day.php'
    stationId: number
    stationType: WeatherStationType
  }
  records: WeatherRecord[]
  warning: string | null
}

interface WeatherDbRow {
  location_id: string
  station_id: number
  station_type: WeatherStationType
  date_kst: string
  max_c: number | null
  min_c: number | null
  status: WeatherStatus
  source_updated_at: string | null
  fetched_at: number
  updated_at: number
}

interface DailyValue {
  date: string
  value: number | null
  sourceUpdatedAt: string | null
}

interface WeatherRefreshResult {
  historicalError: string | null
  todayError: string | null
}

const datePartFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? ''
}

export function kstDateString(now = new Date()): string {
  const parts = datePartFormatter.formatToParts(now)
  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`
}

export function offsetDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function weatherLocationId(value: string | null | undefined): WeatherLocationId {
  const location = WEATHER_LOCATIONS.find((candidate) => candidate.id === value)
  return location?.id ?? 'seoul'
}

export function weatherLocation(value: WeatherLocationId): WeatherLocation {
  const location = WEATHER_LOCATIONS.find((candidate) => candidate.id === value)
  if (!location) throw new Error(`Unknown weather location: ${value}`)
  return location
}

function parseTemperature(value: string | undefined): number | null {
  if (!value || value === '-' || value === '--') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= -90 || parsed >= 90) return null
  return Math.round(parsed * 10) / 10
}

function normalizeHeader(value: string): string {
  return value.replace(/^#+/u, '').replace(/[^A-Za-z0-9_]/gu, '').toUpperCase()
}

function findHeaderIndex(headers: string[], names: string[]): number {
  const normalized = headers.map(normalizeHeader)
  return normalized.findIndex((header) => names.includes(header))
}

function parseKmaDate(value: string | undefined): string | null {
  const digits = value?.replace(/[^0-9]/gu, '') ?? ''
  if (digits.length < 8) return null
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : null
}

export function parseKmaDailyText(text: string): DailyValue[] {
  const lines = text.split(/\r?\n/u)
  const headerLine = lines.find((line) => {
    if (!line.trimStart().startsWith('#')) return false
    const headers = line.replace(/^#+/u, '').trim().split(/\s+/u)
    return findHeaderIndex(headers, ['TM', 'TIME']) >= 0 && findHeaderIndex(headers, ['VAL', 'VALUE']) >= 0
  })
  const headers = headerLine
    ? headerLine.replace(/^#+/u, '').trim().split(/\s+/u)
    : []
  const dateIndex = findHeaderIndex(headers, ['TM', 'TIME'])
  const valueIndex = findHeaderIndex(headers, ['VAL', 'VALUE'])
  const fallbackDateIndex = dateIndex >= 0 ? dateIndex : 0
  const fallbackValueIndex = valueIndex >= 0 ? valueIndex : 5

  return lines
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => line.trim().split(/\s+/u))
    .map((tokens) => {
      const date = parseKmaDate(tokens[fallbackDateIndex])
      if (!date) return null
      return {
        date,
        value: parseTemperature(tokens[fallbackValueIndex]),
        sourceUpdatedAt: tokens[fallbackDateIndex] ?? null,
      }
    })
    .filter((value): value is DailyValue => value !== null)
}

async function readResponseText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('Content-Length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > KMA_MAX_RESPONSE_BYTES) {
    throw new Error('KMA response exceeded the configured size limit')
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let totalBytes = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    totalBytes += chunk.value.byteLength
    if (totalBytes > KMA_MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('KMA response exceeded the configured size limit')
    }
    text += decoder.decode(chunk.value, { stream: true })
  }
  return text + decoder.decode()
}

async function fetchKmaDailyValues(
  authKey: string,
  stationId: number,
  from: string,
  to: string,
  observation: 'ta_max' | 'ta_min',
): Promise<DailyValue[]> {
  const url = new URL(KMA_DAILY_URL)
  url.searchParams.set('tm1', from)
  url.searchParams.set('tm2', to)
  url.searchParams.set('obs', observation)
  url.searchParams.set('stn', String(stationId))
  url.searchParams.set('disp', '0')
  url.searchParams.set('help', '1')
  url.searchParams.set('authKey', authKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), KMA_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`KMA responded with HTTP ${response.status}`)
    const body = await readResponseText(response)
    if (/error|invalid|denied|fail/iu.test(body.slice(0, 600)) && !body.includes('TM')) {
      throw new Error('KMA returned an error response')
    }
    return parseKmaDailyText(body)
  } finally {
    clearTimeout(timeout)
  }
}

async function upsertWeatherRecords(
  db: D1Database,
  location: WeatherLocation,
  records: WeatherRecord[],
  fetchedAt: number,
): Promise<void> {
  const statements = records.map((record) =>
    db.prepare(
      `
      INSERT INTO weather_daily (
        location_id, station_id, station_type, date_kst, max_c, min_c,
        status, source_updated_at, fetched_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
      ON CONFLICT(location_id, date_kst) DO UPDATE SET
        station_id = excluded.station_id,
        station_type = excluded.station_type,
        max_c = excluded.max_c,
        min_c = excluded.min_c,
        status = excluded.status,
        source_updated_at = excluded.source_updated_at,
        fetched_at = excluded.fetched_at,
        updated_at = excluded.updated_at
      `,
    ).bind(
      location.id,
      location.stationId,
      location.stationType,
      record.date,
      record.maxC,
      record.minC,
      record.status,
      record.date,
      fetchedAt,
    ),
  )

  for (let start = 0; start < statements.length; start += 100) {
    await db.batch(statements.slice(start, start + 100))
  }
}

function mergeDailyValues(
  maxValues: DailyValue[],
  minValues: DailyValue[],
  statusForDate: (date: string) => WeatherStatus,
): WeatherRecord[] {
  const dates = new Set([...maxValues, ...minValues].map((value) => value.date))
  const maxByDate = new Map(maxValues.map((value) => [value.date, value]))
  const minByDate = new Map(minValues.map((value) => [value.date, value]))

  return [...dates].sort().map((date) => ({
    date,
    maxC: maxByDate.get(date)?.value ?? null,
    minC: minByDate.get(date)?.value ?? null,
    status: statusForDate(date),
  }))
}

async function refreshWeatherRange(
  db: D1Database,
  location: WeatherLocation,
  authKey: string,
  from: string,
  to: string,
  statusForDate: (date: string) => WeatherStatus,
): Promise<void> {
  const [maxValues, minValues] = await Promise.all([
    fetchKmaDailyValues(authKey, location.stationId, from, to, 'ta_max'),
    fetchKmaDailyValues(authKey, location.stationId, from, to, 'ta_min'),
  ])
  const records = mergeDailyValues(maxValues, minValues, statusForDate)
    .filter((record) => record.maxC !== null || record.minC !== null)
  if (records.length === 0) throw new Error('KMA returned no daily temperature values')
  await upsertWeatherRecords(db, location, records, Date.now())
}

async function getWeatherSyncState(
  db: D1Database,
  locationId: WeatherLocationId,
  today: string,
): Promise<{ latestConfirmed: string | null; todayFetchedAt: number | null }> {
  const row = await db.prepare(
    `
    SELECT
      MAX(CASE WHEN status = 'confirmed' THEN date_kst END) AS latest_confirmed,
      MAX(CASE WHEN date_kst = ?2 THEN fetched_at END) AS today_fetched_at
    FROM weather_daily
    WHERE location_id = ?1
    `,
  ).bind(locationId, today).first<{ latest_confirmed: string | null; today_fetched_at: number | null }>()
  return {
    latestConfirmed: row?.latest_confirmed ?? null,
    todayFetchedAt: row?.today_fetched_at ?? null,
  }
}

async function refreshWeatherLocation(
  db: D1Database,
  location: WeatherLocation,
  authKey: string,
  today: string,
  yesterday: string,
  historicalNeeded: boolean,
  todayNeeded: boolean,
): Promise<WeatherRefreshResult> {
  let historicalError: string | null = null
  let todayError: string | null = null
  const previousYearStart = `${Number(today.slice(0, 4)) - 1}-01-01`

  if (historicalNeeded) {
    try {
      await refreshWeatherRange(db, location, authKey, previousYearStart, yesterday, () => 'confirmed')
    } catch (error) {
      historicalError = error instanceof Error ? error.message : 'historical refresh failed'
    }
  }

  if (todayNeeded) {
    try {
      await refreshWeatherRange(db, location, authKey, today, today, () => 'provisional')
    } catch (error) {
      todayError = error instanceof Error ? error.message : 'today refresh failed'
    }
  }

  return { historicalError, todayError }
}

async function listWeatherRows(
  db: D1Database,
  locationId: WeatherLocationId,
  from: string,
  to: string,
): Promise<WeatherDbRow[]> {
  const result = await db.prepare(
    `
    SELECT location_id, station_id, station_type, date_kst, max_c, min_c,
           status, source_updated_at, fetched_at, updated_at
    FROM weather_daily
    WHERE location_id = ?1 AND date_kst BETWEEN ?2 AND ?3
    ORDER BY date_kst ASC
    `,
  ).bind(locationId, from, to).all<WeatherDbRow>()
  return result.results
}

export async function loadWeatherPayload(
  db: D1Database,
  bindings: Pick<Bindings, 'KMA_AUTH_KEY'>,
  locationId: WeatherLocationId,
  now = new Date(),
): Promise<WeatherPayload> {
  const location = weatherLocation(locationId)
  const today = kstDateString(now)
  const yesterday = offsetDate(today, -1)
  const from = `${Number(today.slice(0, 4)) - 1}-01-01`
  const state = await getWeatherSyncState(db, location.id, today)
  const historicalNeeded = state.latestConfirmed === null || state.latestConfirmed < yesterday
  const todayNeeded = state.todayFetchedAt === null || Date.now() - state.todayFetchedAt >= WEATHER_TODAY_REFRESH_MS
  let warning: string | null = null

  if (historicalNeeded || todayNeeded) {
    if (!bindings.KMA_AUTH_KEY?.trim()) {
      warning = 'KMA_AUTH_KEY가 설정되지 않아 최신 날씨 데이터를 가져오지 못했습니다.'
    } else {
      const refresh = await refreshWeatherLocation(
        db,
        location,
        bindings.KMA_AUTH_KEY.trim(),
        today,
        yesterday,
        historicalNeeded,
        todayNeeded,
      )
      if (refresh.historicalError || refresh.todayError) {
        warning = '기상청 데이터 갱신에 실패해 저장된 데이터를 표시하고 있습니다.'
        console.warn('Weather refresh failed', {
          location: location.id,
          historical: refresh.historicalError,
          today: refresh.todayError,
        })
      }
    }
  }

  const rows = await listWeatherRows(db, location.id, from, today)
  return {
    version: 1,
    location,
    asOf: today,
    range: { from, to: today },
    dataAvailable: rows.length > 0,
    source: {
      provider: 'KMA API Hub',
      endpoint: 'sfc_aws_day.php',
      stationId: location.stationId,
      stationType: location.stationType,
    },
    records: rows.map((row) => ({
      date: row.date_kst,
      maxC: row.max_c,
      minC: row.min_c,
      status: row.status,
    })),
    warning,
  }
}
