import { randomBytes } from 'crypto';

export function randomToken(size = 16): string {
  return randomBytes(size).toString('hex');
}

export function parseOptionsCsv(csv: string): Set<string> {
  return new Set(
    csv
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function buildOptionsCsv(options: Iterable<string>): string {
  return Array.from(new Set(options)).join(',');
}

export function hasSecretOption(csv: string): boolean {
  return parseOptionsCsv(csv).has('secret');
}

export function splitNoticeList(raw: string): number[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function joinNoticeList(ids: number[]): string {
  return Array.from(new Set(ids)).join(',');
}

export function yyyymmdd(now = new Date()): { yy: string; mm: string; dd: string } {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return { yy, mm, dd };
}
