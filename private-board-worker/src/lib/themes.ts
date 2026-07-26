import type { D1Database } from '@cloudflare/workers-types'
import type { UserRole } from '../types'
import { ValidationError } from './validation'

export type BuiltinThemeKey = 'default' | 'midnight' | 'forest'
export type ThemeSelectionKind = 'builtin' | 'owned' | 'shared'

export interface ThemePalette {
  background: string
  surface: string
  surfaceMuted: string
  text: string
  textMuted: string
  border: string
  borderStrong: string
  primary: string
  primaryHover: string
  primarySoft: string
  danger: string
  dangerHover: string
  dangerSoft: string
  successSoft: string
}

export interface BuiltinThemePreset {
  key: BuiltinThemeKey
  name: string
  palette: ThemePalette
}

export interface CustomThemePreset {
  id: number
  ownerId: string
  ownerNickname: string
  ownerRole: UserRole
  name: string
  palette: ThemePalette
  shareCode: string | null
  updatedAt: number
}

export interface ThemeSelection {
  kind: ThemeSelectionKind
  builtinKey: BuiltinThemeKey | null
  themeId: number | null
}

export interface ThemeLibrary {
  builtins: BuiltinThemePreset[]
  owned: CustomThemePreset[]
  shared: CustomThemePreset[]
  selection: ThemeSelection
}

interface CustomThemeDbRow {
  id: number
  owner_id: string
  owner_nickname: string
  owner_role: UserRole
  name: string
  background: string
  surface: string
  surface_muted: string
  text: string
  text_muted: string
  border: string
  border_strong: string
  primary_color: string
  primary_hover: string
  primary_soft: string
  danger: string
  danger_hover: string
  danger_soft: string
  success_soft: string
  share_code: string | null
  updated_at: number
}

interface ThemePreferenceRow {
  selected_kind: ThemeSelectionKind
  selected_builtin_key: BuiltinThemeKey | null
  selected_theme_id: number | null
}

export const MAX_CUSTOM_THEMES_PER_USER = 20
export const MAX_SHARED_THEMES_PER_USER = 50

export const THEME_COLOR_FIELDS = [
  { key: 'background', label: '페이지 배경' },
  { key: 'surface', label: '카드 배경' },
  { key: 'surfaceMuted', label: '보조 배경' },
  { key: 'text', label: '기본 글자' },
  { key: 'textMuted', label: '보조 글자' },
  { key: 'border', label: '기본 테두리' },
  { key: 'borderStrong', label: '강조 테두리' },
  { key: 'primary', label: '주요 색상' },
  { key: 'primaryHover', label: '주요 호버' },
  { key: 'primarySoft', label: '주요 연한 배경' },
  { key: 'danger', label: '위험 색상' },
  { key: 'dangerHover', label: '위험 호버' },
  { key: 'dangerSoft', label: '위험 연한 배경' },
  { key: 'successSoft', label: '성공 연한 배경' },
] as const satisfies ReadonlyArray<{ key: keyof ThemePalette; label: string }>

export const BUILTIN_THEMES: readonly BuiltinThemePreset[] = [
  {
    key: 'default',
    name: '기본 블루',
    palette: {
      background: '#f5f6f8',
      surface: '#ffffff',
      surfaceMuted: '#f0f2f5',
      text: '#16191f',
      textMuted: '#626a76',
      border: '#dce0e5',
      borderStrong: '#c5cbd3',
      primary: '#2457d6',
      primaryHover: '#1745b8',
      primarySoft: '#eaf0ff',
      danger: '#b42318',
      dangerHover: '#8f1c13',
      dangerSoft: '#fff0ee',
      successSoft: '#ecf8f1',
    },
  },
  {
    key: 'midnight',
    name: '미드나이트',
    palette: {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceMuted: '#273449',
      text: '#f8fafc',
      textMuted: '#cbd5e1',
      border: '#3b4a61',
      borderStrong: '#64748b',
      primary: '#60a5fa',
      primaryHover: '#93c5fd',
      primarySoft: '#1e3a5f',
      danger: '#f87171',
      dangerHover: '#fca5a5',
      dangerSoft: '#4c1d1d',
      successSoft: '#173d2b',
    },
  },
  {
    key: 'forest',
    name: '포레스트',
    palette: {
      background: '#eef4ec',
      surface: '#fbfdf9',
      surfaceMuted: '#e3ede0',
      text: '#1d2b1d',
      textMuted: '#5d6f5b',
      border: '#cad8c5',
      borderStrong: '#a9bca3',
      primary: '#347548',
      primaryHover: '#275c37',
      primarySoft: '#dcecdf',
      danger: '#a33c32',
      dangerHover: '#7f2d27',
      dangerSoft: '#f8e4df',
      successSoft: '#dcefe1',
    },
  },
] as const

const DEFAULT_THEME = BUILTIN_THEMES[0]!

function customThemeSelectSql(whereSql: string): string {
  return `
    SELECT
      t.id,
      t.owner_id,
      u.nickname AS owner_nickname,
      u.role AS owner_role,
      t.name,
      t.background,
      t.surface,
      t.surface_muted,
      t.text,
      t.text_muted,
      t.border,
      t.border_strong,
      t.primary_color,
      t.primary_hover,
      t.primary_soft,
      t.danger,
      t.danger_hover,
      t.danger_soft,
      t.success_soft,
      t.share_code,
      t.updated_at
    FROM custom_themes t
    JOIN users u ON u.id = t.owner_id
    ${whereSql}
  `
}

function mapCustomTheme(row: CustomThemeDbRow): CustomThemePreset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerNickname: row.owner_nickname,
    ownerRole: row.owner_role,
    name: row.name,
    palette: {
      background: row.background,
      surface: row.surface,
      surfaceMuted: row.surface_muted,
      text: row.text,
      textMuted: row.text_muted,
      border: row.border,
      borderStrong: row.border_strong,
      primary: row.primary_color,
      primaryHover: row.primary_hover,
      primarySoft: row.primary_soft,
      danger: row.danger,
      dangerHover: row.danger_hover,
      dangerSoft: row.danger_soft,
      successSoft: row.success_soft,
    },
    shareCode: row.share_code,
    updatedAt: row.updated_at,
  }
}

function defaultSelection(): ThemeSelection {
  return { kind: 'builtin', builtinKey: DEFAULT_THEME.key, themeId: null }
}

function preferenceUpsertSql(): string {
  return `
    INSERT INTO user_theme_preferences (
      user_id,
      selected_kind,
      selected_builtin_key,
      selected_theme_id,
      orphan_notice_pending,
      created_at,
      updated_at
    )
    VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5)
    ON CONFLICT(user_id) DO UPDATE SET
      selected_kind = excluded.selected_kind,
      selected_builtin_key = excluded.selected_builtin_key,
      selected_theme_id = excluded.selected_theme_id,
      orphan_notice_pending = 0,
      updated_at = excluded.updated_at
  `
}

async function getThemePreference(db: D1Database, userId: string): Promise<ThemeSelection> {
  const row = await db
    .prepare(
      `
      SELECT selected_kind, selected_builtin_key, selected_theme_id
      FROM user_theme_preferences
      WHERE user_id = ?1
      LIMIT 1
      `,
    )
    .bind(userId)
    .first<ThemePreferenceRow>()

  return row
    ? {
        kind: row.selected_kind,
        builtinKey: row.selected_builtin_key,
        themeId: row.selected_theme_id,
      }
    : defaultSelection()
}

async function getCustomTheme(db: D1Database, themeId: number): Promise<CustomThemePreset | null> {
  const row = await db
    .prepare(`${customThemeSelectSql('WHERE t.id = ?1')} LIMIT 1`)
    .bind(themeId)
    .first<CustomThemeDbRow>()
  return row ? mapCustomTheme(row) : null
}

export function builtinTheme(key: string | null | undefined): BuiltinThemePreset | null {
  return BUILTIN_THEMES.find((theme) => theme.key === key) ?? null
}

export function themePaletteFromForm(form: FormData): ThemePalette {
  const palette = {} as ThemePalette
  for (const field of THEME_COLOR_FIELDS) {
    const value = form.get(field.key)
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/iu.test(value)) {
      throw new ValidationError(`${field.label} 색상은 #RRGGBB 형식이어야 합니다.`)
    }
    palette[field.key] = value.toLowerCase()
  }
  return palette
}

export function normalizeThemeShareCode(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') throw new ValidationError('공유 코드를 입력하세요.')
  const normalized = value.trim().toUpperCase()
  if (!/^THEME-[0-9A-F]{12}$/u.test(normalized)) {
    throw new ValidationError('공유 코드는 THEME- 다음에 영문 대문자와 숫자 12자가 와야 합니다.')
  }
  return normalized
}

export async function resolveUserTheme(db: D1Database, userId: string): Promise<ThemePalette> {
  const selection = await getThemePreference(db, userId)
  if (selection.kind === 'builtin') {
    return (builtinTheme(selection.builtinKey) ?? DEFAULT_THEME).palette
  }
  if (!selection.themeId) return DEFAULT_THEME.palette
  return (await getCustomTheme(db, selection.themeId))?.palette ?? DEFAULT_THEME.palette
}

export async function listThemeLibrary(db: D1Database, userId: string): Promise<ThemeLibrary> {
  const [selection, ownedResult, sharedResult] = await Promise.all([
    getThemePreference(db, userId),
    db
      .prepare(`${customThemeSelectSql('WHERE t.owner_id = ?1')} ORDER BY t.updated_at DESC, t.id DESC`)
      .bind(userId)
      .all<CustomThemeDbRow>(),
    db
      .prepare(
        `
        ${customThemeSelectSql('JOIN user_shared_themes s ON s.theme_id = t.id')}
        WHERE s.user_id = ?1
        ORDER BY s.imported_at DESC, t.id DESC
        `,
      )
      .bind(userId)
      .all<CustomThemeDbRow>(),
  ])

  return {
    builtins: [...BUILTIN_THEMES],
    owned: ownedResult.results.map(mapCustomTheme),
    shared: sharedResult.results.map(mapCustomTheme),
    selection,
  }
}

export async function selectBuiltinTheme(
  db: D1Database,
  userId: string,
  key: string,
): Promise<void> {
  const theme = builtinTheme(key)
  if (!theme) throw new ValidationError('존재하지 않는 내장 테마입니다.')
  const now = Date.now()
  await db.prepare(preferenceUpsertSql()).bind(userId, 'builtin', theme.key, null, now).run()
}

export async function selectOwnedTheme(
  db: D1Database,
  userId: string,
  themeId: number,
): Promise<boolean> {
  const theme = await db
    .prepare('SELECT id FROM custom_themes WHERE id = ?1 AND owner_id = ?2 LIMIT 1')
    .bind(themeId, userId)
    .first<{ id: number }>()
  if (!theme) return false
  await db.prepare(preferenceUpsertSql()).bind(userId, 'owned', null, themeId, Date.now()).run()
  return true
}

export async function selectSharedTheme(
  db: D1Database,
  userId: string,
  themeId: number,
): Promise<boolean> {
  const imported = await db
    .prepare('SELECT theme_id FROM user_shared_themes WHERE user_id = ?1 AND theme_id = ?2 LIMIT 1')
    .bind(userId, themeId)
    .first<{ theme_id: number }>()
  if (!imported) return false
  await db.prepare(preferenceUpsertSql()).bind(userId, 'shared', null, themeId, Date.now()).run()
  return true
}

export async function createOwnedTheme(
  db: D1Database,
  userId: string,
  name: string,
): Promise<number> {
  const count = await db
    .prepare('SELECT COUNT(*) AS count FROM custom_themes WHERE owner_id = ?1')
    .bind(userId)
    .first<{ count: number }>()
  if ((count?.count ?? 0) >= MAX_CUSTOM_THEMES_PER_USER) {
    throw new ValidationError(`개인 테마는 최대 ${MAX_CUSTOM_THEMES_PER_USER}개까지 만들 수 있습니다.`)
  }

  const palette = await resolveUserTheme(db, userId)
  const now = Date.now()
  const result = await db
    .prepare(
      `
      INSERT INTO custom_themes (
        owner_id,
        name,
        background,
        surface,
        surface_muted,
        text,
        text_muted,
        border,
        border_strong,
        primary_color,
        primary_hover,
        primary_soft,
        danger,
        danger_hover,
        danger_soft,
        success_soft,
        created_at,
        updated_at
      )
      VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17
      )
      `,
    )
    .bind(
      userId,
      name,
      palette.background,
      palette.surface,
      palette.surfaceMuted,
      palette.text,
      palette.textMuted,
      palette.border,
      palette.borderStrong,
      palette.primary,
      palette.primaryHover,
      palette.primarySoft,
      palette.danger,
      palette.dangerHover,
      palette.dangerSoft,
      palette.successSoft,
      now,
    )
    .run()

  const themeId = result.meta.last_row_id
  if (!themeId) throw new Error('개인 테마 ID를 확인할 수 없습니다.')
  await db.prepare(preferenceUpsertSql()).bind(userId, 'owned', null, themeId, now).run()
  return themeId
}

export async function updateOwnedTheme(
  db: D1Database,
  userId: string,
  themeId: number,
  name: string,
  palette: ThemePalette,
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE custom_themes
      SET
        name = ?1,
        background = ?2,
        surface = ?3,
        surface_muted = ?4,
        text = ?5,
        text_muted = ?6,
        border = ?7,
        border_strong = ?8,
        primary_color = ?9,
        primary_hover = ?10,
        primary_soft = ?11,
        danger = ?12,
        danger_hover = ?13,
        danger_soft = ?14,
        success_soft = ?15,
        updated_at = ?16
      WHERE id = ?17 AND owner_id = ?18
      `,
    )
    .bind(
      name,
      palette.background,
      palette.surface,
      palette.surfaceMuted,
      palette.text,
      palette.textMuted,
      palette.border,
      palette.borderStrong,
      palette.primary,
      palette.primaryHover,
      palette.primarySoft,
      palette.danger,
      palette.dangerHover,
      palette.dangerSoft,
      palette.successSoft,
      Date.now(),
      themeId,
      userId,
    )
    .run()
  return result.meta.changes > 0
}

function randomShareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `THEME-${value}`
}

export async function publishOwnedTheme(
  db: D1Database,
  userId: string,
  themeId: number,
): Promise<string | null> {
  const existing = await db
    .prepare('SELECT share_code FROM custom_themes WHERE id = ?1 AND owner_id = ?2 LIMIT 1')
    .bind(themeId, userId)
    .first<{ share_code: string | null }>()
  if (!existing) return null
  if (existing.share_code) return existing.share_code

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = randomShareCode()
    try {
      const result = await db
        .prepare(
          `
          UPDATE custom_themes
          SET share_code = ?1, updated_at = ?2
          WHERE id = ?3 AND owner_id = ?4 AND share_code IS NULL
          `,
        )
        .bind(code, Date.now(), themeId, userId)
        .run()
      if (result.meta.changes > 0) return code

      const raced = await db
        .prepare('SELECT share_code FROM custom_themes WHERE id = ?1 AND owner_id = ?2 LIMIT 1')
        .bind(themeId, userId)
        .first<{ share_code: string | null }>()
      return raced?.share_code ?? null
    } catch (error) {
      if (!(error instanceof Error) || !/UNIQUE|constraint/i.test(error.message)) throw error
    }
  }
  throw new Error('테마 공유 코드를 생성하지 못했습니다.')
}

export async function importSharedTheme(
  db: D1Database,
  userId: string,
  shareCode: string,
): Promise<number> {
  const theme = await db
    .prepare('SELECT id, owner_id FROM custom_themes WHERE share_code = ?1 LIMIT 1')
    .bind(shareCode)
    .first<{ id: number; owner_id: string }>()
  if (!theme) throw new ValidationError('공유 코드에 해당하는 테마를 찾을 수 없습니다.')
  if (theme.owner_id === userId) throw new ValidationError('내가 만든 테마는 공유 코드로 가져올 필요가 없습니다.')

  const existing = await db
    .prepare('SELECT theme_id FROM user_shared_themes WHERE user_id = ?1 AND theme_id = ?2 LIMIT 1')
    .bind(userId, theme.id)
    .first<{ theme_id: number }>()
  if (!existing) {
    const count = await db
      .prepare('SELECT COUNT(*) AS count FROM user_shared_themes WHERE user_id = ?1')
      .bind(userId)
      .first<{ count: number }>()
    if ((count?.count ?? 0) >= MAX_SHARED_THEMES_PER_USER) {
      throw new ValidationError(`공유 테마는 최대 ${MAX_SHARED_THEMES_PER_USER}개까지 가져올 수 있습니다.`)
    }
  }

  const now = Date.now()
  await db.batch([
    db
      .prepare(
        `
        INSERT OR IGNORE INTO user_shared_themes (user_id, theme_id, imported_at)
        VALUES (?1, ?2, ?3)
        `,
      )
      .bind(userId, theme.id, now),
    db.prepare(preferenceUpsertSql()).bind(userId, 'shared', null, theme.id, now),
  ])
  return theme.id
}

export async function deleteOwnedTheme(
  db: D1Database,
  userId: string,
  themeId: number,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM custom_themes WHERE id = ?1 AND owner_id = ?2')
    .bind(themeId, userId)
    .run()
  return result.meta.changes > 0
}

export async function acknowledgeThemeOrphanNotice(db: D1Database, userId: string): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE user_theme_preferences
      SET orphan_notice_pending = 0, updated_at = ?1
      WHERE user_id = ?2 AND orphan_notice_pending = 1
      `,
    )
    .bind(Date.now(), userId)
    .run()
  return result.meta.changes > 0
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return (red ?? 0) * 0.2126 + (green ?? 0) * 0.7152 + (blue ?? 0) * 0.0722
}

export function themeCss(palette: ThemePalette): string {
  const colorScheme = relativeLuminance(palette.background) < 0.25 ? 'dark' : 'light'
  return `:root {
  color-scheme: ${colorScheme};
  --background: ${palette.background};
  --surface: ${palette.surface};
  --surface-muted: ${palette.surfaceMuted};
  --text: ${palette.text};
  --text-muted: ${palette.textMuted};
  --border: ${palette.border};
  --border-strong: ${palette.borderStrong};
  --primary: ${palette.primary};
  --primary-hover: ${palette.primaryHover};
  --primary-soft: ${palette.primarySoft};
  --danger: ${palette.danger};
  --danger-hover: ${palette.dangerHover};
  --danger-soft: ${palette.dangerSoft};
  --success-soft: ${palette.successSoft};
}
`
}
