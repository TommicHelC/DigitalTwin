import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { getAccessToken, getRefreshToken, storeAuthData, clearAuthData } from './auth'
import type {
  LoginResponse,
  Client,
  Site,
  SiteModel,
  Device,
  TelemetryPoint,
  Alert,
  D365Case,
} from './types'

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — dodaje Authorization header
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — przy 401 próba refresh tokena
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: AxiosError | null, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearAuthData()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
          { refreshToken }
        )
        const newToken = data.accessToken
        localStorage.setItem('hvac_access_token', newToken)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        processQueue(null, newToken)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        clearAuthData()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Auth
export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

// Clients
export async function getClients(): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients')
  return data
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await api.get<Client>(`/clients/${id}`)
  return data
}

// Sites
export async function getSitesByClient(clientId: string): Promise<Site[]> {
  const { data } = await api.get<Site[]>(`/clients/${clientId}/sites`)
  return data
}

export async function getSite(id: string): Promise<Site & { models: SiteModel[] }> {
  const { data } = await api.get<Site & { models: SiteModel[] }>(`/sites/${id}`)
  return data
}

// Devices
export async function getDevicesBySite(siteId: string): Promise<Device[]> {
  const { data } = await api.get<Device[]>(`/sites/${siteId}/devices`)
  return data
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await api.get<Device>(`/devices/${id}`)
  return data
}

export async function patchDevice(id: string, payload: Partial<Device>): Promise<Device> {
  const { data } = await api.patch<Device>(`/devices/${id}`, payload)
  return data
}

// Telemetry
export async function getDeviceTelemetry(
  id: string,
  params?: { from?: string; to?: string; metrics?: string }
): Promise<TelemetryPoint[]> {
  const { data } = await api.get<TelemetryPoint[]>(`/devices/${id}/telemetry`, { params })
  return data
}

// Alerts
export async function getAlerts(params?: {
  limit?: number
  resolved?: boolean
}): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>('/alerts', { params })
  return data
}

export async function getDeviceAlerts(deviceId: string): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>(`/devices/${deviceId}/alerts`)
  return data
}

export async function resolveAlert(alertId: string): Promise<Alert> {
  const { data } = await api.patch<Alert>(`/alerts/${alertId}/resolve`)
  return data
}

// Cases (D365)
export async function getDeviceCases(deviceId: string): Promise<D365Case[]> {
  const { data } = await api.get<D365Case[]>(`/devices/${deviceId}/cases`)
  return data
}

// Models (APS URNs)
export async function getSiteModels(siteId: string): Promise<SiteModel[]> {
  const { data } = await api.get<SiteModel[]>(`/sites/${siteId}/models`)
  return data
}

export async function createSiteModel(
  siteId: string,
  payload: { name: string; apsUrn: string }
): Promise<SiteModel> {
  const { data } = await api.post<SiteModel>(`/sites/${siteId}/models`, payload)
  return data
}

export default api
