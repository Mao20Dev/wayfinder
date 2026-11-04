export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter = 0,
    public code?: string,
  ) {
    super(message)
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(150_000)
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const details = data?.details
      ? Object.entries(data.details)
          .map(
            ([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
          )
          .join(' · ')
      : ''
    throw new ApiError(
      details || data?.error || `Request failed (${response.status}). Please try again.`,
      response.status,
      Number(data?.retry_after_seconds ?? response.headers.get('Retry-After') ?? 0),
      data?.code,
    )
  }
  return data as T
}

export function localDateTime(date = new Date(Date.now() + 30 * 60_000)) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function clock(epoch: number, timeZone: string, includeDate = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    ...(includeDate ? { month: 'short', day: 'numeric' } : {}),
  }).format(epoch * 1000)
}
