const encoder = new TextEncoder()
const MAX_UINT16 = 0xffff
const MAX_UINT32 = 0xffffffff
const UTF8_FLAG = 0x0800
const STORE_METHOD = 0

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export interface StoredZipEntry {
  name: string
  data: Uint8Array
  modifiedAt: number
}

interface CentralDirectoryEntry {
  name: Uint8Array
  crc32: number
  size: number
  modifiedTime: number
  modifiedDate: number
  localHeaderOffset: number
}

function setUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true)
}

function setUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true)
}

function crc32(data: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of data) {
    value = CRC32_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function dosTimestamp(timestamp: number): { date: number; time: number } {
  const raw = new Date(timestamp)
  const date = Number.isNaN(raw.getTime()) ? new Date(0) : raw
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()))
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
  }
}

function validatedName(value: string): Uint8Array {
  const normalized = value.replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    parts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('ZIP entry name must be a safe relative path.')
  }
  const bytes = encoder.encode(normalized)
  if (bytes.length > MAX_UINT16) throw new Error('ZIP entry name is too long.')
  return bytes
}

function localHeader(entry: CentralDirectoryEntry): Uint8Array {
  const header = new Uint8Array(30 + entry.name.length)
  const view = new DataView(header.buffer)
  setUint32(view, 0, 0x04034b50)
  setUint16(view, 4, 20)
  setUint16(view, 6, UTF8_FLAG)
  setUint16(view, 8, STORE_METHOD)
  setUint16(view, 10, entry.modifiedTime)
  setUint16(view, 12, entry.modifiedDate)
  setUint32(view, 14, entry.crc32)
  setUint32(view, 18, entry.size)
  setUint32(view, 22, entry.size)
  setUint16(view, 26, entry.name.length)
  setUint16(view, 28, 0)
  header.set(entry.name, 30)
  return header
}

function centralDirectoryHeader(entry: CentralDirectoryEntry): Uint8Array {
  const header = new Uint8Array(46 + entry.name.length)
  const view = new DataView(header.buffer)
  setUint32(view, 0, 0x02014b50)
  setUint16(view, 4, 20)
  setUint16(view, 6, 20)
  setUint16(view, 8, UTF8_FLAG)
  setUint16(view, 10, STORE_METHOD)
  setUint16(view, 12, entry.modifiedTime)
  setUint16(view, 14, entry.modifiedDate)
  setUint32(view, 16, entry.crc32)
  setUint32(view, 20, entry.size)
  setUint32(view, 24, entry.size)
  setUint16(view, 28, entry.name.length)
  setUint16(view, 30, 0)
  setUint16(view, 32, 0)
  setUint16(view, 34, 0)
  setUint16(view, 36, 0)
  setUint32(view, 38, 0)
  setUint32(view, 42, entry.localHeaderOffset)
  header.set(entry.name, 46)
  return header
}

function endOfCentralDirectory(entryCount: number, size: number, offset: number): Uint8Array {
  const footer = new Uint8Array(22)
  const view = new DataView(footer.buffer)
  setUint32(view, 0, 0x06054b50)
  setUint16(view, 4, 0)
  setUint16(view, 6, 0)
  setUint16(view, 8, entryCount)
  setUint16(view, 10, entryCount)
  setUint32(view, 12, size)
  setUint32(view, 16, offset)
  setUint16(view, 20, 0)
  return footer
}

async function* storedZipChunks(
  entries: AsyncIterable<StoredZipEntry>,
): AsyncGenerator<Uint8Array> {
  const centralDirectory: CentralDirectoryEntry[] = []
  let offset = 0

  for await (const source of entries) {
    if (centralDirectory.length >= MAX_UINT16) throw new Error('ZIP entry limit exceeded.')
    if (source.data.length > MAX_UINT32) throw new Error('ZIP entry is too large.')

    const name = validatedName(source.name)
    const timestamp = dosTimestamp(source.modifiedAt)
    const entry: CentralDirectoryEntry = {
      name,
      crc32: crc32(source.data),
      size: source.data.length,
      modifiedTime: timestamp.time,
      modifiedDate: timestamp.date,
      localHeaderOffset: offset,
    }
    const header = localHeader(entry)
    const nextOffset = offset + header.length + source.data.length
    if (nextOffset > MAX_UINT32) throw new Error('ZIP archive is too large.')

    centralDirectory.push(entry)
    offset = nextOffset
    yield header
    yield source.data
  }

  const centralDirectoryOffset = offset
  for (const entry of centralDirectory) {
    const header = centralDirectoryHeader(entry)
    offset += header.length
    if (offset > MAX_UINT32) throw new Error('ZIP archive is too large.')
    yield header
  }

  yield endOfCentralDirectory(
    centralDirectory.length,
    offset - centralDirectoryOffset,
    centralDirectoryOffset,
  )
}

export function storedZipStream(entries: AsyncIterable<StoredZipEntry>): ReadableStream<Uint8Array> {
  const iterator = storedZipChunks(entries)
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(next.value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return(undefined)
    },
  })
}
