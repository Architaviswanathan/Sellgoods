export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function responseError(status: number, detail: unknown, fallback: string): ApiError {
  const message = typeof detail === 'string'
    ? detail
    : Array.isArray(detail)
      ? detail.map((issue: { loc?: string[]; msg?: string }) => `${issue.loc?.[issue.loc.length - 1] ?? 'Field'}: ${issue.msg ?? 'Invalid value'}`).join('. ')
      : fallback;
  return new ApiError(message, status);
}
