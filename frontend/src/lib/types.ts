export interface User {
  id: string
  email: string
  role: 'admin' | 'user' | 'guest'
  clientId: string
}

export interface Client {
  id: string
  name: string
  contactEmail?: string
  subscriptionTier: string
}

export interface Site {
  id: string
  clientId: string
  name: string
  address?: string
  models?: SiteModel[]
}

export interface SiteModel {
  id: string
  siteId: string
  name: string
  apsUrn: string
  description?: string
}

export interface Device {
  id: string
  siteId: string
  name: string
  type: string
  tbDeviceId?: string
  apsObjectId?: number
  isActive: boolean
}

export interface TelemetryPoint {
  metric: string
  value: number
  ts: string
}

export interface Alert {
  id: string
  deviceId: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  isResolved: boolean
  createdAt: string
  dataverseCaseId?: string
}

export interface D365Case {
  id: string
  title: string
  status: string
  createdOn: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}
