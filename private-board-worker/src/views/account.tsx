import type { CurrentUser, DeployInfo } from '../types'
import {
  THEME_COLOR_FIELDS,
  type BuiltinThemePreset,
  type CustomThemePreset,
  type ThemeLibrary,
  type ThemeSelectionKind,
} from '../lib/themes'
import { AuthorName, CsrfInput } from './components'
import { AppLayout } from './layout'

function ThemeTypeTag({ kind }: { kind: ThemeSelectionKind }) {
  const label = kind === 'builtin' ? '내장 기본제공' : kind === 'owned' ? '내가 만든 테마' : '공유받은 테마'
  return (
    <span class={`theme-type-tag theme-type-${kind}`}>
      <span class="theme-pixel-icon" role="img" aria-label={`${label} 픽셀아트 아이콘`}>
        {Array.from({ length: 16 }, (_, index) => (
          <i key={index}></i>
        ))}
      </span>
      {label}
    </span>
  )
}

function isSelected(
  library: ThemeLibrary,
  kind: ThemeSelectionKind,
  identifier: string | number,
): boolean {
  if (library.selection.kind !== kind) return false
  return kind === 'builtin'
    ? library.selection.builtinKey === identifier
    : library.selection.themeId === identifier
}

function SelectThemeButton({
  csrfToken,
  action,
  selected,
}: {
  csrfToken: string
  action: string
  selected: boolean
}) {
  return (
    <form action={action} method="post">
      <CsrfInput token={csrfToken} />
      <button class={selected ? 'button button-secondary button-small' : 'button button-small'} type="submit" disabled={selected}>
        {selected ? '사용 중' : '이 테마 사용'}
      </button>
    </form>
  )
}

function BuiltinThemeCard({
  theme,
  selected,
  csrfToken,
}: {
  theme: BuiltinThemePreset
  selected: boolean
  csrfToken: string
}) {
  return (
    <article class={`theme-card${selected ? ' is-selected' : ''}`}>
      <div class="theme-card-heading">
        <div>
          <ThemeTypeTag kind="builtin" />
          <h3>{theme.name}</h3>
        </div>
        <SelectThemeButton
          csrfToken={csrfToken}
          action={`/account/themes/builtin/${theme.key}/select`}
          selected={selected}
        />
      </div>
      <div class="theme-color-strip" aria-label={`${theme.name} 대표 색상`}>
        {['background', 'surface', 'primary', 'text'].map((key) => (
          <span class={`theme-color-chip theme-color-${theme.key}-${key}`} key={key}></span>
        ))}
      </div>
    </article>
  )
}

function OwnedThemeCard({
  theme,
  selected,
  csrfToken,
}: {
  theme: CustomThemePreset
  selected: boolean
  csrfToken: string
}) {
  return (
    <article class={`theme-card theme-card-owned${selected ? ' is-selected' : ''}`}>
      <div class="theme-card-heading">
        <div>
          <ThemeTypeTag kind="owned" />
          <h3>{theme.name}</h3>
        </div>
        <SelectThemeButton
          csrfToken={csrfToken}
          action={`/account/themes/${theme.id}/select-owned`}
          selected={selected}
        />
      </div>

      {theme.shareCode ? (
        <div class="theme-share-code">
          <div>
            <span>공유 코드</span>
            <code>{theme.shareCode}</code>
          </div>
          <button class="button button-secondary button-small" type="button" data-copy-value={theme.shareCode}>
            코드 복사
          </button>
        </div>
      ) : (
        <form action={`/account/themes/${theme.id}/publish`} method="post">
          <CsrfInput token={csrfToken} />
          <button class="button button-secondary button-small" type="submit">
            공개하고 코드 만들기
          </button>
        </form>
      )}

      <details class="theme-editor">
        <summary>색상 직접 설정</summary>
        <form action={`/account/themes/${theme.id}/update`} method="post" class="theme-editor-form">
          <CsrfInput token={csrfToken} />
          <label class="theme-name-field">
            <span>테마 이름</span>
            <input type="text" name="name" value={theme.name} maxlength={60} required />
          </label>
          <div class="theme-color-fields">
            {THEME_COLOR_FIELDS.map((field) => (
              <label>
                <span>{field.label}</span>
                <input type="color" name={field.key} value={theme.palette[field.key]} required />
              </label>
            ))}
          </div>
          <div class="form-actions form-actions-end">
            <button class="button button-small" type="submit">
              색상 저장
            </button>
          </div>
        </form>
      </details>

      <form
        action={`/account/themes/${theme.id}/delete`}
        method="post"
        class="theme-delete-form"
        data-confirm="이 테마를 삭제할까요? 공유받아 사용 중인 회원은 기본 테마로 돌아갑니다."
      >
        <CsrfInput token={csrfToken} />
        <button class="text-button text-danger" type="submit">
          테마 삭제
        </button>
      </form>
    </article>
  )
}

function SharedThemeCard({
  theme,
  selected,
  csrfToken,
}: {
  theme: CustomThemePreset
  selected: boolean
  csrfToken: string
}) {
  return (
    <article class={`theme-card${selected ? ' is-selected' : ''}`}>
      <div class="theme-card-heading">
        <div>
          <ThemeTypeTag kind="shared" />
          <h3>{theme.name}</h3>
          <p>
            <AuthorName nickname={theme.ownerNickname} role={theme.ownerRole} />
            님의 원본 변경이 자동으로 반영됩니다.
          </p>
        </div>
        <SelectThemeButton
          csrfToken={csrfToken}
          action={`/account/themes/${theme.id}/select-shared`}
          selected={selected}
        />
      </div>
    </article>
  )
}

export function AccountPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  error,
  themeError,
  themeLibrary,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
  error?: string | null
  themeError?: string | null
  themeLibrary: ThemeLibrary
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="내 계정"
      topbarTitle="내 계정"
      user={user}
      csrfToken={csrfToken}
      activeNav="account"
      notice={notice}
    >
      <section class="account-grid">
        <article class="form-card">
          <p class="eyebrow">공개 프로필</p>
          <h2>닉네임</h2>
          <p>게시글과 댓글에는 Google 이름 대신 이 닉네임이 표시됩니다.</p>
          {error ? <div class="notice notice-error">{error}</div> : null}
          <form action="/account/nickname" method="post" class="stack-form compact-form">
            <CsrfInput token={csrfToken} />
            <label>
              <span>닉네임</span>
              <input type="text" name="nickname" value={user.nickname} minlength={2} maxlength={24} required />
            </label>
            <div class="form-actions form-actions-end">
              <button class="button" type="submit">
                변경
              </button>
            </div>
          </form>
        </article>

        <article class="account-info-card">
          <p class="eyebrow">로그인 정보</p>
          <h2>Google 계정</h2>
          <dl>
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>권한</dt>
              <dd>{user.role === 'admin' ? '관리자' : '일반 회원'}</dd>
            </div>
          </dl>
          <p class="form-hint">Google 비밀번호와 프로필 이미지는 이 서비스에 저장하지 않습니다.</p>
        </article>
      </section>

      <section class="theme-settings" aria-labelledby="theme-settings-title">
        <div class="theme-settings-heading">
          <div>
            <p class="eyebrow">개인 설정</p>
            <h2 id="theme-settings-title">색상 테마</h2>
            <p>모든 테마는 프리셋으로 관리됩니다. 새 테마는 현재 사용 중인 색상을 복제합니다.</p>
          </div>
        </div>

        {themeError ? <div class="notice notice-error">{themeError}</div> : null}

        <div class="theme-create-grid">
          <form action="/account/themes" method="post" class="theme-quick-form">
            <CsrfInput token={csrfToken} />
            <div>
              <strong>내 테마 만들기</strong>
              <p>현재 테마를 복제한 뒤 원하는 색상으로 수정할 수 있습니다.</p>
            </div>
            <label>
              <span>새 테마 이름</span>
              <input type="text" name="name" maxlength={60} placeholder="나만의 테마" required />
            </label>
            <button class="button" type="submit">
              복제하여 만들기
            </button>
          </form>

          <form action="/account/themes/import" method="post" class="theme-quick-form">
            <CsrfInput token={csrfToken} />
            <div>
              <strong>공유 테마 가져오기</strong>
              <p>원본 테마가 바뀌면 가져온 테마에도 그대로 반영됩니다.</p>
            </div>
            <label>
              <span>공유 코드</span>
              <input type="text" name="shareCode" maxlength={18} placeholder="THEME-000000000000" required />
            </label>
            <button class="button" type="submit">
              코드로 가져오기
            </button>
          </form>
        </div>

        <section class="theme-library-group" aria-labelledby="builtin-themes-title">
          <div class="section-title-row">
            <h3 id="builtin-themes-title">내장 기본제공</h3>
            <span>{themeLibrary.builtins.length}</span>
          </div>
          <div class="theme-card-grid">
            {themeLibrary.builtins.map((theme) => (
              <BuiltinThemeCard
                theme={theme}
                selected={isSelected(themeLibrary, 'builtin', theme.key)}
                csrfToken={csrfToken}
                key={theme.key}
              />
            ))}
          </div>
        </section>

        <section class="theme-library-group" aria-labelledby="owned-themes-title">
          <div class="section-title-row">
            <h3 id="owned-themes-title">내가 만든 것</h3>
            <span>{themeLibrary.owned.length}</span>
          </div>
          {themeLibrary.owned.length > 0 ? (
            <div class="theme-card-grid">
              {themeLibrary.owned.map((theme) => (
                <OwnedThemeCard
                  theme={theme}
                  selected={isSelected(themeLibrary, 'owned', theme.id)}
                  csrfToken={csrfToken}
                  key={theme.id}
                />
              ))}
            </div>
          ) : (
            <p class="theme-library-empty">아직 직접 만든 테마가 없습니다.</p>
          )}
        </section>

        <section class="theme-library-group" aria-labelledby="shared-themes-title">
          <div class="section-title-row">
            <h3 id="shared-themes-title">공유 코드로 가져온 것</h3>
            <span>{themeLibrary.shared.length}</span>
          </div>
          {themeLibrary.shared.length > 0 ? (
            <div class="theme-card-grid">
              {themeLibrary.shared.map((theme) => (
                <SharedThemeCard
                  theme={theme}
                  selected={isSelected(themeLibrary, 'shared', theme.id)}
                  csrfToken={csrfToken}
                  key={theme.id}
                />
              ))}
            </div>
          ) : (
            <p class="theme-library-empty">가져온 공유 테마가 없습니다.</p>
          )}
        </section>
      </section>
    </AppLayout>
  )
}
