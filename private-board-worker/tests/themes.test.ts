import { describe, expect, it } from 'vitest'
import {
  BUILTIN_THEMES,
  normalizeThemeShareCode,
  themeCss,
  themePaletteFromForm,
} from '../src/lib/themes'
import { ValidationError } from '../src/lib/validation'

describe('색상 테마', () => {
  it('색상 입력을 검증하고 정규화한다', () => {
    const form = new FormData()
    const palette = BUILTIN_THEMES[0]!.palette
    for (const [key, value] of Object.entries(palette)) form.set(key, value.toUpperCase())

    expect(themePaletteFromForm(form)).toEqual(palette)

    form.set('primary', 'red')
    expect(() => themePaletteFromForm(form)).toThrow(ValidationError)
  })

  it('공유 코드를 대문자로 정규화하고 형식을 제한한다', () => {
    expect(normalizeThemeShareCode(' theme-0123abcdef45 ')).toBe('THEME-0123ABCDEF45')
    expect(() => normalizeThemeShareCode('THEME-short')).toThrow(ValidationError)
  })

  it('선택한 팔레트를 CSP 친화적인 외부 CSS 변수로 만든다', () => {
    const css = themeCss(BUILTIN_THEMES[1]!.palette)

    expect(css).toContain('color-scheme: dark')
    expect(css).toContain('--background: #0f172a')
    expect(css).toContain('--primary: #60a5fa')
    expect(css).not.toContain('<style')
  })
})
