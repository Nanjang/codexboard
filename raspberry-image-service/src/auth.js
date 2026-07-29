import { timingSafeEqual } from 'node:crypto'

function equalSecret(left, right) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

export function hasServiceAuthorization(header, expectedToken) {
  if (typeof header !== 'string') return false
  const match = /^Bearer ([^\s]+)$/u.exec(header)
  return match ? equalSecret(match[1], expectedToken) : false
}
