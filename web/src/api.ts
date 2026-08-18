export const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:7071/api').replace(/\/$/, '')
export const tokenStorageKey = 'mcu-token'

const renewalWindowMs = 7 * 24 * 60 * 60 * 1000

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function readToken(): string | null {
  return localStorage.getItem(tokenStorageKey)
}

export function storeToken(token: string): void {
  localStorage.setItem(tokenStorageKey, token)
}

export function clearToken(): void {
  localStorage.removeItem(tokenStorageKey)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken()
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Request failed with ${response.status}`)
  return body
}

/** True when the session is close enough to expiry that it should be silently renewed. */
export function sessionNeedsRenewal(token: string): boolean {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return false
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const payload = JSON.parse(atob(base64)) as { exp?: unknown }
    return typeof payload.exp === 'number' && payload.exp * 1000 - Date.now() <= renewalWindowMs
  } catch {
    return false
  }
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
