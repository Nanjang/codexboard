import { describe, expect, it } from 'vitest'
import {
  kmaDateParameter,
  kstDateString,
  offsetDate,
  parseKmaDailyText,
  weatherLocationId,
} from '../src/lib/weather'

describe('weather helpers', () => {
  it('parses KMA daily value rows with a header', () => {
    const values = parseKmaDailyText(`
# START7777
#  TM STN LON LAT HT VAL
 20250804 572 127.12 37.42 35 31.4
 20250805 572 127.12 37.42 35 -
# END7777
`)

    expect(values).toEqual([
      { date: '2025-08-04', value: 31.4, sourceUpdatedAt: '20250804' },
      { date: '2025-08-05', value: null, sourceUpdatedAt: '20250805' },
    ])
  })

  it('supports the AWS fixed-column fallback when headers are absent', () => {
    expect(parseKmaDailyText('20250804 572 127.12 37.42 35 31.4')).toEqual([
      { date: '2025-08-04', value: 31.4, sourceUpdatedAt: '20250804' },
    ])
  })

  it('normalizes the supported location list', () => {
    expect(weatherLocationId('seongnam')).toBe('seongnam')
    expect(weatherLocationId('jeju')).toBe('jeju')
    expect(weatherLocationId('gwangju')).toBe('gwangju')
    expect(weatherLocationId('yangsan')).toBe('yangsan')
    expect(weatherLocationId('pangyo')).toBe('seoul')
    expect(weatherLocationId(null)).toBe('seoul')
  })

  it('uses KST dates and date offsets', () => {
    expect(kstDateString(new Date('2026-08-03T15:30:00.000Z'))).toBe('2026-08-04')
    expect(offsetDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(kmaDateParameter('2026-08-04')).toBe('20260804')
  })
})
