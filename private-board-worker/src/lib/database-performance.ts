export interface DatabaseQueryMeasurement<T = Record<string, unknown>> {
  label: string
  sql: string
  elapsedMs: number
  d1DurationMs: number | null
  sqlDurationMs: number | null
  rowsRead: number
  rowsWritten: number
  resultCount: number
  rows: T[]
}

function roundedMilliseconds(value: number): number {
  return Math.round(value * 100) / 100
}

export async function measureD1Query<T = Record<string, unknown>>(
  db: D1Database,
  label: string,
  sql: string,
  values: unknown[] = [],
): Promise<DatabaseQueryMeasurement<T>> {
  const startedAt = performance.now()
  const statement = db.prepare(sql)
  const result = await (values.length > 0 ? statement.bind(...values) : statement).all<T>()
  const elapsedMs = roundedMilliseconds(performance.now() - startedAt)
  const meta = result.meta

  return {
    label,
    sql,
    elapsedMs,
    d1DurationMs: Number.isFinite(meta.duration) ? roundedMilliseconds(meta.duration) : null,
    sqlDurationMs: Number.isFinite(meta.timings?.sql_duration_ms ?? NaN)
      ? roundedMilliseconds(meta.timings?.sql_duration_ms ?? 0)
      : null,
    rowsRead: Number.isFinite(meta.rows_read) ? meta.rows_read : 0,
    rowsWritten: Number.isFinite(meta.rows_written) ? meta.rows_written : 0,
    resultCount: result.results.length,
    rows: result.results,
  }
}
