import type { CurrentUser, DeployInfo, MemoRow, MemoUrlSettings } from '../types'
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

export function composeMemoUrl(value: string, settings: MemoUrlSettings): string | null {
  const numeric = isNumericMemoValue(value)
  const prefix = numeric ? settings.numeric_prefix : settings.text_prefix
  const suffix = numeric ? settings.numeric_suffix : settings.text_suffix
  if (!prefix && !suffix) return null

  try {
    const url = new URL(`${prefix}${encodeURIComponent(value)}${suffix}`)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function MemoBoardPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  memos,
  settings,
  draftMemo = '',
  draftValue = '',
  error = null,
}: CommonMemoPageProps & {
  notice?: string | null
  memos: MemoRow[]
  settings: MemoUrlSettings
  draftMemo?: string
  draftValue?: string
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
          <p>메모와 값을 저장하고, 설정한 주소로 바로 이동합니다.</p>
        </div>
      </section>

      <section class="memo-create-card" aria-labelledby="memo-create-title">
        <div class="memo-create-heading">
          <div>
            <h3 id="memo-create-title">새 메모</h3>
            <p>저장한 내용은 본인에게만 표시됩니다.</p>
          </div>
          <div class="memo-template-status" aria-label="URL 설정 상태">
            <span class={hasNumericTemplate ? 'is-configured' : ''}>숫자 {hasNumericTemplate ? '설정됨' : '미설정'}</span>
            <span class={hasTextTemplate ? 'is-configured' : ''}>문자 {hasTextTemplate ? '설정됨' : '미설정'}</span>
          </div>
        </div>
        <ErrorNotice message={error} />
        <form action="/memos" method="post" class="memo-create-form">
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
            const targetUrl = composeMemoUrl(item.value, settings)
            return (
              <article class="memo-row" key={item.id}>
                <div class="memo-copy">
                  <strong>{item.memo}</strong>
                  <time datetime={new Date(item.created_at).toISOString()}>{formatDateTime(item.created_at)}</time>
                </div>
                <div class="memo-value-wrap">
                  <span class={`memo-kind ${numeric ? 'memo-kind-number' : ''}`}>{numeric ? '숫자' : '문자'}</span>
                  {targetUrl ? (
                    <a class="memo-value-link" href={targetUrl} rel="noopener noreferrer" title={targetUrl}>
                      <span>{item.value}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span class="memo-value-disabled" title="이 값 유형의 URL을 먼저 설정하세요.">
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

export function MemoSettingsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  settings,
  error = null,
}: CommonMemoPageProps & {
  settings: MemoUrlSettings
  error?: string | null
}) {
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
      <section class="form-card memo-settings-card">
        <p class="eyebrow">게시판 설정</p>
        <h2>값을 열 주소</h2>
        <p>값의 앞뒤에 붙일 주소를 숫자와 문자 유형별로 지정합니다. 두 칸을 모두 비우면 링크가 꺼집니다.</p>
        <ErrorNotice message={error} />
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
          <p class="form-hint">값은 URL 구성 요소로 안전하게 인코딩됩니다. 완성된 주소는 http 또는 https만 허용합니다.</p>
          <div class="form-actions">
            <a class="button button-secondary" href="/memos">
              취소
            </a>
            <button class="button" type="submit">
              설정 저장
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  )
}
