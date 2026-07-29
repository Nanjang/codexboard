import { describe, expect, it } from 'vitest'
import { storedZipStream, type StoredZipEntry } from '../src/lib/zip'

const decoder = new TextDecoder()

async function* entries(values: StoredZipEntry[]): AsyncGenerator<StoredZipEntry> {
  for (const value of values) yield value
}

function uint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true)
}

function uint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

function storedEntries(bytes: Uint8Array): Map<string, string> {
  const result = new Map<string, string>()
  let offset = 0
  while (uint32(bytes, offset) === 0x04034b50) {
    expect(uint16(bytes, offset + 8)).toBe(0)
    const size = uint32(bytes, offset + 18)
    const nameLength = uint16(bytes, offset + 26)
    const extraLength = uint16(bytes, offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength))
    result.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + size)))
    offset = dataStart + size
  }
  expect(uint32(bytes, offset)).toBe(0x02014b50)
  expect(uint32(bytes, bytes.length - 22)).toBe(0x06054b50)
  expect(uint16(bytes, bytes.length - 12)).toBe(result.size)
  return result
}

describe('스트리밍 ZIP 생성', () => {
  it('UTF-8 파일명과 Markdown 내용을 저장 방식 ZIP으로 만든다', async () => {
    const encoder = new TextEncoder()
    const stream = storedZipStream(
      entries([
        {
          name: '2026-07-28-devlog-1.md',
          data: encoder.encode('# 첫 기록\n'),
          modifiedAt: Date.parse('2026-07-28T00:00:00.000Z'),
        },
        {
          name: '2026-07-29-devlog-2.md',
          data: encoder.encode('# 두 번째 기록\n\n![이미지](images/example.png)\n'),
          modifiedAt: Date.parse('2026-07-29T00:00:00.000Z'),
        },
      ]),
    )
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())

    expect(storedEntries(bytes)).toEqual(
      new Map([
        ['2026-07-28-devlog-1.md', '# 첫 기록\n'],
        [
          '2026-07-29-devlog-2.md',
          '# 두 번째 기록\n\n![이미지](images/example.png)\n',
        ],
      ]),
    )
  })

  it('파일이 없어도 유효한 빈 ZIP 끝 레코드를 만든다', async () => {
    const bytes = new Uint8Array(
      await new Response(storedZipStream(entries([]))).arrayBuffer(),
    )
    expect(bytes).toHaveLength(22)
    expect(uint32(bytes, 0)).toBe(0x06054b50)
    expect(uint16(bytes, 10)).toBe(0)
  })

  it('표준 CRC-32 값을 ZIP 헤더에 기록한다', async () => {
    const bytes = new Uint8Array(
      await new Response(
        storedZipStream(
          entries([
            {
              name: 'checksum.txt',
              data: new TextEncoder().encode('123456789'),
              modifiedAt: 0,
            },
          ]),
        ),
      ).arrayBuffer(),
    )
    expect(uint32(bytes, 14)).toBe(0xcbf43926)
  })

  it('상위 경로를 포함하는 위험한 파일명을 거부한다', async () => {
    const stream = storedZipStream(
      entries([{ name: '../secret.md', data: new Uint8Array(), modifiedAt: 0 }]),
    )
    await expect(new Response(stream).arrayBuffer()).rejects.toThrow(
      'ZIP entry name must be a safe relative path.',
    )
  })
})
