import type {
  CurrentUser,
  DeployInfo,
  MemoRow,
  MemoUrlPatternRow,
  MemoUrlSettings,
} from '../types'
import { isNumericMemoValue } from '../lib/validation'
import { CsrfInput, EmptyState, ErrorNotice } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

interface CommonMemoPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
}

export interface MemoPatternDraft {
  id: number | null
  name: string
  prefix: string
  suffix: string
}

type UrlPatternParts = Pick<MemoUrlPatternRow, 'prefix' | 'suffix'>

export function composeMemoUrl(
  value: string,
  settings: MemoUrlSettings,
  customPattern: UrlPatternParts | null = null,
): string | null {
  const numeric = isNumericMemoValue(value)
  const prefix = customPattern
    ? customPattern.prefix
    : numeric
      ? settings.numeric_prefix
      : settings.text_prefix
  const suffix = customPattern
    ? customPattern.suffix
    : numeric
      ? settings.numeric_suffix
      : settings.text_suffix
  if (!prefix && !suffix) return null

  try {
    const url = new URL(`${prefix}${encodeURIComponent(value)}${suffix}`)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function MemoValueDialog({ memo }: { memo: MemoRow }) {
  const dialogId = `memo-value-dialog-${memo.id}`
  const titleId = `${dialogId}-title`

  return (
    <dialog id={dialogId} class="ticket-dialog memo-value-dialog" aria-labelledby={titleId}>
      <div class="memo-value-dialog-content">
        <div class="dialog-header">
          <div>
            <span class="eyebrow">메모 값</span>
            <h2 id={titleId}>{memo.memo}</h2>
          </div>
          <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
            ×
          </button>
        </div>
        <p class="memo-value-dialog-value">{memo.value}</p>
      </div>
    </dialog>
  )
}

export function MemoBoardPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  memos,
  settings,
  patterns,
  draftMemo = '',
  draftValue = '',
  draftPatternId = 'none',
  error = null,
}: CommonMemoPageProps & {
  notice?: string | null
  memos: MemoRow[]
  settings: MemoUrlSettings
  patterns: MemoUrlPatternRow[]
  draftMemo?: string
  draftValue?: string
  draftPatternId?: string
  error?: string | null
}) {
  const hasNumericTemplate = Boolean(settings.numeric_prefix || settings.numeric_suffix)
  const hasTextTemplate = Boolean(settings.text_prefix || settings.text_suffix)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="내 메모"
      topbarTitle="내 메모"
      user={user}
      csrfToken={csrfToken}
      activeNav="memos"
      notice={notice}
      contextAction={{ kind: 'link', label: 'URL 설정', href: '/memos/settings' }}
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">개인 전용</p>
          <h2>메모 게시판</h2>
          <p>기본은 링크 없이 저장하며, 자동 또는 직접 선택한 패턴으로 링크를 만들 수 있습니다.</p>
        </div>
      </section>

      <section class="memo-create-card" aria-labelledby="memo-create-title">
        <div class="memo-create-heading">
          <div>
            <h3 id="memo-create-title">새 메모</h3>
            <p>기본값인 없음을 선택하면 링크를 만들지 않고 본문만 저장합니다.</p>
          </div>
          <div class="memo-template-status" aria-label="URL 설정 상태">
            <span class={hasNumericTemplate ? 'is-configured' : ''}>숫자 {hasNumericTemplate ? '설정됨' : '미설정'}</span>
            <span class={hasTextTemplate ? 'is-configured' : ''}>문자 {hasTextTemplate ? '설정됨' : '미설정'}</span>
            <span class={patterns.length > 0 ? 'is-configured' : ''}>내 패턴 {patterns.length}개</span>
          </div>
        </div>
        <ErrorNotice message={error} />
        <form action="/memos" method="post" class="memo-create-form memo-create-form-with-pattern">
          <CsrfInput token={csrfToken} />
          <label>
            <span>메모</span>
            <input
              type="text"
              name="memo"
              value={draftMemo}
              maxlength={240}
              placeholder="이 값에 대한 설명"
              required
              autofocus
              autocomplete="off"
            />
          </label>
          <label>
            <span>값</span>
            <input
              type="text"
              name="value"
              value={draftValue}
              maxlength={500}
              placeholder="숫자 또는 단어"
              required
              autocomplete="off"
            />
          </label>
          <label>
            <span>타입</span>
            <select name="patternId">
              <option value="none" selected={draftPatternId === 'none'}>
                없음
              </option>
              <option value="link" selected={draftPatternId === 'link'}>
                링크 (입력한 URL 그대로)
              </option>
              <option value="auto" selected={draftPatternId === 'auto'}>
                자동 (숫자/문자 판별)
              </option>
              {patterns.map((pattern) => (
                <option value={pattern.id} selected={draftPatternId === String(pattern.id)} key={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </label>
          <button class="button" type="submit">
            저장
          </button>
        </form>
      </section>

      {memos.length === 0 ? (
        <EmptyState title="저장된 메모가 없습니다" description="위 입력란에서 첫 메모를 저장해 보세요." />
      ) : (
        <section class="memo-list" aria-label="저장된 메모 목록">
          <header class="memo-list-header">
            <span>메모</span>
            <span>값</span>
            <span class="memo-list-count">{memos.length}개</span>
          </header>
          {memos.map((item) => {
            const numeric = isNumericMemoValue(item.value)
            const customPattern =
              item.link_mode === 'custom' &&
              item.pattern_id !== null &&
              item.pattern_prefix !== null &&
              item.pattern_suffix !== null
                ? { prefix: item.pattern_prefix, suffix: item.pattern_suffix }
                : null
            const targetUrl =
              item.link_mode === 'none'
                ? null
                : item.link_mode === 'link'
                  ? item.value
                  : composeMemoUrl(item.value, settings, customPattern)
            const kindLabel =
              item.link_mode === 'none'
                ? '없음'
                : item.link_mode === 'link'
                  ? '링크'
                  : item.pattern_name ?? (numeric ? '숫자' : '문자')
            return (
              <article class="memo-row" key={item.id}>
                <div class="memo-copy">
                  <strong>{item.memo}</strong>
                  <time datetime={new Date(item.created_at).toISOString()}>{formatDateTime(item.created_at)}</time>
                </div>
                <div class="memo-value-wrap">
                  <span
                    class={`memo-kind ${
                      item.link_mode === 'link'
                        ? 'memo-kind-link'
                        : item.pattern_name
                          ? 'memo-kind-custom'
                          : numeric
                            ? 'memo-kind-number'
                            : ''
                    }`}
                  >
                    {kindLabel}
                  </span>
                  {item.link_mode === 'none' ? (
                    <button
                      type="button"
                      class="memo-value-disabled memo-value-dialog-trigger"
                      data-dialog-open={`memo-value-dialog-${item.id}`}
                      aria-controls={`memo-value-dialog-${item.id}`}
                      aria-haspopup="dialog"
                      aria-label={`전체 값 보기: ${item.memo}`}
                      title="전체 값 보기"
                    >
                      {item.value}
                    </button>
                  ) : targetUrl ? (
                    <a class="memo-value-link" href={targetUrl} rel="noopener noreferrer" title={targetUrl}>
                      <span>{item.value}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span
                      class="memo-value-disabled"
                      title="이 값 유형의 URL을 먼저 설정하세요."
                    >
                      {item.value}
                    </span>
                  )}
                </div>
                <form action={`/memos/${item.id}/delete`} method="post" data-confirm="이 메모를 삭제할까요?">
                  <CsrfInput token={csrfToken} />
                  <button class="text-button text-danger" type="submit">
                    삭제
                  </button>
                </form>
                {item.link_mode === 'none' ? <MemoValueDialog memo={item} /> : null}
              </article>
            )
          })}
        </section>
      )}
    </AppLayout>
  )
}

function UrlPartsFields({
  kind,
  label,
  prefix,
  suffix,
  exampleValue,
}: {
  kind: 'numeric' | 'text'
  label: string
  prefix: string
  suffix: string
  exampleValue: string
}) {
  return (
    <fieldset class="memo-settings-group">
      <legend>{label}</legend>
      <p>
        <code>{prefix || '앞 URL'}</code>
        <mark>{exampleValue}</mark>
        <code>{suffix || '뒤 URL'}</code>
      </p>
      <label>
        <span>앞에 붙일 URL</span>
        <input
          type="text"
          inputmode="url"
          name={`${kind}Prefix`}
          value={prefix}
          maxlength={1000}
          placeholder="https://example.com/search?q="
          autocomplete="off"
        />
      </label>
      <label>
        <span>뒤에 붙일 URL</span>
        <input
          type="text"
          inputmode="url"
          name={`${kind}Suffix`}
          value={suffix}
          maxlength={1000}
          placeholder="&source=memo"
          autocomplete="off"
        />
      </label>
    </fieldset>
  )
}

function PatternFields({ draft }: { draft: Omit<MemoPatternDraft, 'id'> }) {
  return (
    <>
      <label>
        <span>패턴 이름</span>
        <input
          type="text"
          name="name"
          value={draft.name}
          maxlength={60}
          placeholder="예: 상품 검색"
          required
          autocomplete="off"
        />
      </label>
      <label>
        <span>앞 URL</span>
        <input
          type="text"
          inputmode="url"
          name="prefix"
          value={draft.prefix}
          maxlength={1000}
          placeholder="https://example.com/items/"
          autocomplete="off"
        />
      </label>
      <label>
        <span>뒤 URL</span>
        <input
          type="text"
          inputmode="url"
          name="suffix"
          value={draft.suffix}
          maxlength={1000}
          placeholder="?from=memo"
          autocomplete="off"
        />
      </label>
    </>
  )
}

export function MemoSettingsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  settings,
  patterns,
  error = null,
  patternDraft,
}: CommonMemoPageProps & {
  settings: MemoUrlSettings
  patterns: MemoUrlPatternRow[]
  error?: string | null
  patternDraft?: MemoPatternDraft
}) {
  const newPatternDraft =
    patternDraft?.id === null ? patternDraft : { id: null, name: '', prefix: '', suffix: '' }

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="메모 URL 설정"
      topbarTitle="메모 URL 설정"
      user={user}
      csrfToken={csrfToken}
      activeNav="memos"
      backHref="/memos"
    >
      <div class="memo-settings-stack">
        <section class="form-card memo-settings-card">
          <p class="eyebrow">자동 패턴</p>
          <h2>숫자·문자 자동 판별</h2>
          <p>메모에서 패턴을 선택하지 않았을 때 적용할 주소입니다. 두 칸을 모두 비우면 해당 링크가 꺼집니다.</p>
          {!patternDraft ? <ErrorNotice message={error} /> : null}
          <form action="/memos/settings" method="post" class="stack-form">
            <CsrfInput token={csrfToken} />
            <UrlPartsFields
              kind="numeric"
              label="숫자 값"
              prefix={settings.numeric_prefix}
              suffix={settings.numeric_suffix}
              exampleValue="123"
            />
            <UrlPartsFields
              kind="text"
              label="문자 값"
              prefix={settings.text_prefix}
              suffix={settings.text_suffix}
              exampleValue="단어"
            />
            <p class="form-hint">
              값은 URL 구성 요소로 안전하게 인코딩됩니다. 완성된 주소는 http 또는 https만 허용합니다.
            </p>
            <div class="form-actions">
              <button class="button" type="submit">
                자동 패턴 저장
              </button>
            </div>
          </form>
        </section>

        <section class="form-card memo-settings-card">
          <p class="eyebrow">직접 선택</p>
          <h2>내 패턴</h2>
          <p>자주 쓰는 URL 조합을 이름 붙여 추가하면 메모를 저장할 때 직접 선택할 수 있습니다.</p>
          {patternDraft ? <ErrorNotice message={error} /> : null}

          <form action="/memos/patterns" method="post" class="memo-pattern-form memo-pattern-create-form">
            <CsrfInput token={csrfToken} />
            <PatternFields draft={newPatternDraft} />
            <button class="button" type="submit">
              패턴 추가
            </button>
          </form>

          {patterns.length === 0 ? (
            <div class="memo-pattern-empty">추가한 패턴이 없습니다.</div>
          ) : (
            <div class="memo-pattern-list" aria-label="내 메모 패턴">
              {patterns.map((pattern) => {
                const draft =
                  patternDraft?.id === pattern.id
                    ? patternDraft
                    : { id: pattern.id, name: pattern.name, prefix: pattern.prefix, suffix: pattern.suffix }
                return (
                  <article class="memo-pattern-row" key={pattern.id}>
                    <form action={`/memos/patterns/${pattern.id}/update`} method="post" class="memo-pattern-form">
                      <CsrfInput token={csrfToken} />
                      <PatternFields draft={draft} />
                      <button class="button button-secondary button-small" type="submit">
                        저장
                      </button>
                    </form>
                    <form
                      action={`/memos/patterns/${pattern.id}/delete`}
                      method="post"
                      data-confirm="이 패턴을 삭제할까요? 이 패턴을 쓰던 메모는 자동 판별로 전환됩니다."
                    >
                      <CsrfInput token={csrfToken} />
                      <button class="text-button text-danger" type="submit">
                        삭제
                      </button>
                    </form>
                  </article>
                )
              })}
            </div>
          )}
          <p class="memo-pattern-limit">{patterns.length} / 50개</p>
        </section>

        <div class="memo-settings-back">
          <a class="button button-secondary" href="/memos">
            메모 목록으로
          </a>
        </div>
      </div>
    </AppLayout>
  )
}
