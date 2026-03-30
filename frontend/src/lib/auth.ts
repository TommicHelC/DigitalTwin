import type { User, LoginResponse } from './types'

const ACCESS_TOKEN_KEY = 'hvac_access_token'
const REFRESH_TOKEN_KEY = 'hvac_refresh_token'
const USER_KEY = 'hvac_user'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function storeAuthData(data: LoginResponse): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
  try {
    const payload = JSON.parse(atob(data.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const user: User = { id: payload.sub, email: payload.email, clientId: payload.clientId ?? null, role: payload.role }
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // ignore decode errors
  }
}

export function clearAuthData(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}
