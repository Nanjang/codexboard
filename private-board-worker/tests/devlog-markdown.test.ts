import { describe, expect, it } from 'vitest'
import {
  devlogMarkdownArchiveFilename,
  devlogMarkdownDocument,
  devlogMarkdownFilename,
  richDevlogHtmlToMarkdown,
} from '../src/lib/devlog-markdown'

describe('개발일지 Markdown 내보내기', () => {
  it('리치 본문과 첨부 이미지를 GitHub용 Markdown으로 변환한다', () => {
    const hash = 'a'.repeat(64)
    const markdown = richDevlogHtmlToMarkdown(
      `<h2>구현 내용</h2>
       <p>본문 <strong>강조</strong><br>다음 줄</p>
       <figure class="devlog-image">
         <img src="/devlog-images/i/${hash}.gif" alt="구조도">
         <figcaption>서비스 구조</figcaption>
       </figure>
       <ol><li>첫 단계</li><li>두 번째</li></ol>`,
    )

    expect(markdown).toContain('## 구현 내용')
    expect(markdown).toContain('본문 **강조**')
    expect(markdown).toContain(`![구조도](images/${hash}.gif)`)
    expect(markdown).toContain('*서비스 구조*')
    expect(markdown).toContain('1. 첫 단계')
    expect(markdown).toContain('2. 두 번째')
    expect(markdown).not.toContain('/devlog-images/')
  })

  it('외부 이미지도 URL의 파일명만 images 하위 경로에 사용한다', () => {
    expect(
      richDevlogHtmlToMarkdown(
        '<p><img src="https://images.example.com/private-images/example.avif" alt="결과"></p>',
      ),
    ).toBe('![결과](images/example.avif)')
  })

  it('제목과 본문을 문서로 만들고 서울 날짜 기반 파일명을 만든다', () => {
    const post = {
      id: 42,
      title: 'VPC [연결]',
      body: '<p>완료했습니다.</p>',
      body_format: 'rich' as const,
      created_at: Date.parse('2026-07-28T16:00:00.000Z'),
    }

    expect(devlogMarkdownDocument(post)).toBe('# VPC \\[연결\\]\n\n완료했습니다.\n')
    expect(devlogMarkdownFilename(post)).toBe('2026-07-29-devlog-42.md')
  })

  it('작성자 식별자를 안전한 ZIP 파일명으로 변환한다', () => {
    expect(devlogMarkdownArchiveFilename('user_01@example.com')).toBe(
      'user_01-example-com-devlog-markdown.zip',
    )
    expect(devlogMarkdownArchiveFilename('***')).toBe('user-devlog-markdown.zip')
  })
})
