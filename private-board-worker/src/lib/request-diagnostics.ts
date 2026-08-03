export interface RequestProcessDiagnostic {
  label: string
  value: string
}

export function safeRuntimeReason(error: unknown): string {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : 'UnknownError: 알 수 없는 런타임 오류'
  return raw
    .replaceAll(/\s+/gu, ' ')
    .replaceAll(/\bBearer\s+[^\s,;]+/giu, 'Bearer [REDACTED]')
    .replaceAll(
      /\b(authorization|cookie|csrf|token|secret|password)\s*([:=])\s*[^\s,;]+/giu,
      '$1$2[REDACTED]',
    )
    .trim()
    .slice(0, 500)
}

export class RequestProcessError extends Error {
  readonly diagnostics: RequestProcessDiagnostic[]
  readonly originalError: unknown

  constructor(
    completedSteps: RequestProcessDiagnostic[],
    failedStep: string,
    startedAt: number,
    originalError: unknown,
  ) {
    const reason = safeRuntimeReason(originalError)
    const nextStep = completedSteps.length + 1
    super(reason)
    this.name = 'RequestProcessError'
    this.originalError = originalError
    this.diagnostics = [
      ...completedSteps,
      {
        label: `${nextStep}. ${failedStep}`,
        value: `실패 · ${Math.max(0, Date.now() - startedAt)}ms 경과`,
      },
      { label: `${nextStep + 1}. 상세 사유`, value: reason },
    ]
  }
}
