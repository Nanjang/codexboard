import { describe, expect, it } from 'vitest'
import { creationRequestId } from '../src/lib/idempotency'
import { ValidationError } from '../src/lib/validation'

describe('생성 요청 멱등성', () => {
  it('UUID v4 요청 식별자를 정규화한다', () => {
    expect(creationRequestId('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    )
  })

  it('유효하지 않은 요청 식별자를 거부한다', () => {
    expect(() => creationRequestId('reused-key')).toThrow(ValidationError)
    expect(() => creationRequestId(null)).toThrow(ValidationError)
  })
})
