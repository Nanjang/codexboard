const encoder = new TextEncoder()

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function encryptionKey(masterSecret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`codexboard:image-service:v1:${masterSecret}`),
  )
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(value: string, masterSecret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(masterSecret),
    encoder.encode(value),
  )
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`
}

export async function decryptSecret(value: string, masterSecret: string): Promise<string> {
  const [version, ivValue, ciphertextValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !ciphertextValue) throw new Error('저장된 이미지 서비스 인증 정보를 읽을 수 없습니다.')

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(ivValue).buffer as ArrayBuffer },
      await encryptionKey(masterSecret),
      fromBase64Url(ciphertextValue).buffer as ArrayBuffer,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('저장된 이미지 서비스 인증 정보를 복호화할 수 없습니다.')
  }
}
