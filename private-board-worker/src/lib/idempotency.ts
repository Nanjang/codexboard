import { ValidationError } from './validation'

const CREATION_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function creationRequestId(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !CREATION_REQUEST_ID_PATTERN.test(value)) {
    throw new ValidationError('생성 요청 식별자가 올바르지 않습니다. 페이지를 새로고침해 주세요.')
  }
  return value.toLowerCase()
}
