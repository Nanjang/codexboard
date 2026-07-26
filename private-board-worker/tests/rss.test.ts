import { describe, expect, it } from 'vitest'
import { normalizeRssUrl, parseRssFeed, RssFeedError } from '../src/lib/rss'

describe('RSS 처리', () => {
  it('RSS 2.0 항목을 날짜순으로 정리하고 HTML을 일반 텍스트로 바꾼다', () => {
    const feed = parseRssFeed(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>개발 &amp; 소식</title>
          <item>
            <title>이전 글</title>
            <link>/posts/older</link>
            <description><![CDATA[<p>이전 <strong>요약</strong></p>]]></description>
            <pubDate>Fri, 24 Jul 2026 01:00:00 GMT</pubDate>
          </item>
          <item>
            <title>최신 글</title>
            <link>https://example.com/posts/latest</link>
            <description>최신 &amp; 중요한 소식</description>
            <pubDate>Sat, 25 Jul 2026 01:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      'https://example.com/feed.xml',
    )

    expect(feed.title).toBe('개발 & 소식')
    expect(feed.items.map((item) => item.title)).toEqual(['최신 글', '이전 글'])
    expect(feed.items[1]?.url).toBe('https://example.com/posts/older')
    expect(feed.items[1]?.summary).toBe('이전 요약')
  })

  it('Atom의 alternate 링크와 상대 주소를 읽는다', () => {
    const feed = parseRssFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <entry>
          <title>Atom 글</title>
          <link rel="self" href="/entry.atom" />
          <link rel="alternate" href="/articles/1" />
          <summary>Atom 요약</summary>
          <updated>2026-07-26T03:00:00Z</updated>
        </entry>
      </feed>`,
      'https://example.com/feed.atom',
    )

    expect(feed.items[0]).toMatchObject({
      title: 'Atom 글',
      url: 'https://example.com/articles/1',
      summary: 'Atom 요약',
    })
  })

  it('RSS가 아닌 문서와 내부 주소를 거부한다', () => {
    expect(() => parseRssFeed('<html><title>문서</title></html>', 'https://example.com/')).toThrow(
      RssFeedError,
    )
    expect(() => normalizeRssUrl('https://localhost/feed.xml')).toThrow(RssFeedError)
    expect(() => normalizeRssUrl('https://192.168.0.1/feed.xml')).toThrow(RssFeedError)
    expect(() => normalizeRssUrl('http://example.com/feed.xml')).toThrow(RssFeedError)
  })
})
