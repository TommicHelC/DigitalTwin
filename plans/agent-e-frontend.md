# Agent E: Frontend — Sub-plan implementacji

**Projekt:** HVAC Digital Twin Platform — HellCold sp. z o.o.
**Katalog:** `D:\DEV-LOCAL\DigitalTwin Platform\frontend\`
**Repo:** https://github.com/HellCold-Sp-z-o-o/DigitalHellColdTwin.git

---

## 1. Cel i zakres

Agent E implementuje kompletny frontend aplikacji HVAC Digital Twin Platform. Zakres obejmuje:

- Aplikację Next.js 16 z App Routerem i React 19
- Ekran logowania z custom JWT auth
- Dashboard z listą urządzeń i statusami
- Stronę szczegółów urządzenia z zintegrowanym APS Viewer 3D
- Stronę alertów z filtrowalną tabelą
- Next.js API routes do komunikacji z APS (Autodesk Platform Services)
- Konfigurację Dockerfiles (dev + produkcja)
- Adaptację istniejącego kodu AutodeskViewer z `autodesk-viewer-react`

---

## 2. Zależności — kontrakt API z backendu

Frontend konsumuje backend wystawiony pod `NEXT_PUBLIC_API_URL` (domyślnie `http://localhost:3001/api`). Wszystkie requesty (poza `/auth/login` i `/auth/refresh`) wymagają headera `Authorization: Bearer {accessToken}`.

### Endpointy używane przez frontend

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/auth/login` | Logowanie, zwraca tokeny i dane usera |
| POST | `/auth/refresh` | Odświeżanie access tokena |
| GET | `/clients/:clientId/sites` | Lista site'ów klienta |
| GET | `/sites/:id` | Dane site'a z modelami APS |
| GET | `/sites/:siteId/devices` | Lista urządzeń na site |
| GET | `/devices/:id` | Szczegóły urządzenia |
| PATCH | `/devices/:id` | Aktualizacja urządzenia |
| GET | `/devices/:id/telemetry` | Dane telemetryczne z zakresem czasu |
| GET | `/alerts?limit=50&resolved=false` | Aktywne alerty globalne |
| GET | `/devices/:id/alerts` | Alerty dla urządzenia |
| PATCH | `/alerts/:id/resolve` | Rozwiązanie alertu |
| GET | `/devices/:id/cases` | Sprawy D365 dla urządzenia |
| GET | `/sites/:siteId/models` | Modele APS dla site'a |
| POST | `/sites/:siteId/models` | Dodanie modelu APS |

### APS (Autodesk Platform Services)

Frontend ma własne API route (`/api/aps/token`) które server-side pobiera token APS przy użyciu `AUTODESK_CLIENT_ID` i `AUTODESK_CLIENT_SECRET`. Ten token jest następnie przekazywany do APS Viewer SDK ładowanego z CDN Autodesk.

---

## 3. Lista plików z opisami

```
frontend/
├── package.json                              # Zależności projektu
├── next.config.ts                            # Konfiguracja Next.js (standalone, transpile)
├── tsconfig.json                             # Konfiguracja TypeScript
├── postcss.config.mjs                        # PostCSS dla Tailwind v4
├── Dockerfile                                # Produkcyjny multi-stage build
├── Dockerfile.dev                            # Development z hot reload
└── src/
    ├── app/
    │   ├── globals.css                        # Tailwind v4 + globalne style
    │   ├── layout.tsx                         # Root layout: html, body, fonty
    │   ├── (auth)/
    │   │   ├── layout.tsx                     # Layout dla auth: wycentrowana karta
    │   │   └── login/
    │   │       └── page.tsx                   # Strona logowania z formularzem
    │   ├── (dashboard)/
    │   │   ├── layout.tsx                     # Layout z sidebar + auth guard
    │   │   ├── page.tsx                       # Dashboard: lista urządzeń ze statusem
    │   │   ├── devices/
    │   │   │   └── [id]/
    │   │   │       └── page.tsx               # Szczegóły urządzenia: viewer + panel
    │   │   └── alerts/
    │   │       └── page.tsx                   # Lista alertów z filtrowaniem
    │   └── api/
    │       └── aps/
    │           ├── token/
    │           │   └── route.ts               # GET → APS token (server-side OAuth2)
    │           └── models/
    │               └── [siteId]/
    │                   └── route.ts           # GET → proxy do backend modeli
    ├── components/
    │   ├── AutodeskViewer/                    # Skopiowany + zaadaptowany viewer
    │   │   ├── AutodeskViewer.tsx             # Główny komponent (prop: urn, onElementSelected)
    │   │   ├── viewerRuntime.ts               # Inicjalizacja runtime APS SDK
    │   │   ├── helpers.ts                     # Helpery (NAPRAWIONA literówka env var)
    │   │   ├── types.ts                       # Typy TypeScript dla viewera
    │   │   ├── index.ts                       # Re-eksporty
    │   │   └── FilterExtension/
    │   │       ├── FilterExtension.ts         # Rozszerzenie filtrowania modelu
    │   │       ├── ViewerFilterPanel.ts       # Panel UI filtrów
    │   │       └── index.ts                   # Re-eksporty rozszerzenia
    │   ├── DeviceCard.tsx                     # Karta urządzenia z kolorowym statusem
    │   ├── AlertsBadge.tsx                    # Badge z liczbą aktywnych alertów
    │   ├── AlertsList.tsx                     # Tabela alertów z severity Badge
    │   ├── TelemetryPanel.tsx                 # Live metrics: temp, setpoint, mode, power
    │   ├── DocumentsPanel.tsx                 # Lista dokumentów z ikonami
    │   └── CasesPanel.tsx                     # Lista D365 Cases z linkami
    ├── lib/
    │   ├── api.ts                             # Axios instance + typowane funkcje API
    │   ├── auth.ts                            # JWT storage, login, logout, refresh
    │   └── types.ts                           # Wszystkie interfejsy TypeScript
    └── store/
        └── useDeviceStore.ts                  # Zustand store: device, alerts, telemetry
```

---

## 4. Pełna zawartość plików

### `package.json`

```json
{
  "name": "hvac-digital-twin-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "16.1.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "axios": "^1.7.0",
    "zustand": "^5.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.400.0",
    "tailwind-merge": "^2.4.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.1.1"
  }
}
```

> Komponenty shadcn/ui instaluj przez CLI po zainicjowaniu projektu:
> `npx shadcn@latest init` a następnie `npx shadcn@latest add button card badge table input dialog separator skeleton`

---

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // APS Viewer SDK jest ładowany z CDN Autodesk i wymaga środowiska browser.
  // Dlatego komponent AutodeskViewer MUSI być importowany z dynamic(..., { ssr: false }).
  // Poniższa konfiguracja nie jest wymagana do działania SSR-disable via dynamic(),
  // ale zostawiona jako dokumentacja intencji.
  experimental: {
    // React 19 concurrent features
    reactCompiler: false,
  },
  // Pozwól na używanie Web Workers przez APS Viewer
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }
    return config
  },
}

export default nextConfig
```

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### `postcss.config.mjs`

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

---

### `src/app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

/* APS Viewer wymaga żeby kontener miał jawnie ustawioną wysokość */
.aps-viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
}
```

---

### `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HVAC Digital Twin — HellCold',
  description: 'Digital Twin Platform for HVAC systems',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

---

### `src/lib/types.ts`

```typescript
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
```

---

### `src/lib/auth.ts`

```typescript
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
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function clearAuthData(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}
```

---

### `src/lib/api.ts`

```typescript
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
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        )
        const newToken = data.accessToken
        // Aktualizuj token w localStorage
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
```

---

### `src/store/useDeviceStore.ts`

```typescript
import { create } from 'zustand'
import type { Device, Alert, TelemetryPoint, D365Case } from '@/lib/types'

interface DeviceStore {
  selectedDevice: Device | null
  alerts: Alert[]
  telemetry: TelemetryPoint[]
  cases: D365Case[]
  isLoadingTelemetry: boolean
  setSelectedDevice: (device: Device | null) => void
  setAlerts: (alerts: Alert[]) => void
  setTelemetry: (telemetry: TelemetryPoint[]) => void
  setCases: (cases: D365Case[]) => void
  setIsLoadingTelemetry: (loading: boolean) => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  selectedDevice: null,
  alerts: [],
  telemetry: [],
  cases: [],
  isLoadingTelemetry: false,
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  setAlerts: (alerts) => set({ alerts }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setCases: (cases) => set({ cases }),
  setIsLoadingTelemetry: (loading) => set({ isLoadingTelemetry: loading }),
}))
```

---

### `src/app/api/aps/token/route.ts`

```typescript
import { NextResponse } from 'next/server'

// Server-side only — nie eksponuje kluczy API klientowi
// Używa AUTODESK_CLIENT_ID i AUTODESK_CLIENT_SECRET z env (bez prefiksu NEXT_PUBLIC_)

export async function GET() {
  const clientId = process.env.AUTODESK_CLIENT_ID
  const clientSecret = process.env.AUTODESK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'APS credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'data:read viewables:read',
    })

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(
      'https://developer.api.autodesk.com/authentication/v2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: params.toString(),
        // Nie cachuj tokenu — ma krótki czas życia
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('APS token error:', errorText)
      return NextResponse.json(
        { error: 'Failed to obtain APS token' },
        { status: response.status }
      )
    }

    const tokenData = await response.json()

    // Zwróć access_token i expires_in do klienta (viewera)
    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    })
  } catch (error) {
    console.error('APS token fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### `src/app/api/aps/models/[siteId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

// Proxy do backendu — odczytuje BACKEND_URL (server-side) zamiast NEXT_PUBLIC_API_URL
// Dzięki temu klient nie musi mieć bezpośredniego dostępu do backendu w sieci Docker

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const backendUrl = process.env.BACKEND_URL || 'http://backend:3001'
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/sites/${params.siteId}/models`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch models' },
        { status: response.status }
      )
    }

    const models = await response.json()
    return NextResponse.json(models)
  } catch (error) {
    console.error('Models proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

### `src/components/AutodeskViewer/types.ts`

```typescript
// Typy dla APS Viewer SDK (ładowanego z CDN — brak typów npm)
// Deklaracje globalne pozwalają używać Autodesk.Viewing.* bez błędów TS

export interface ViewerConfig {
  extensions?: string[]
  useADP?: boolean
  theme?: string
}

export interface ApsToken {
  access_token: string
  expires_in: number
}

export interface ViewerInitOptions {
  env: string
  api: string
  getAccessToken: (callback: (token: string, expires: number) => void) => void
}

// Augmentacja globalnego namespace Autodesk (załadowanego z CDN)
declare global {
  interface Window {
    Autodesk: {
      Viewing: {
        Initializer: (options: ViewerInitOptions, callback: () => void) => void
        GuiViewer3D: new (
          container: HTMLElement,
          config?: ViewerConfig
        ) => AutodeskViewer3D
        Extension: {
          new (viewer: AutodeskViewer3D, options: unknown): unknown
        }
        AGGREGATE_SELECTION_CHANGED_EVENT: string
        GEOMETRY_LOADED_EVENT: string
        TOOLBAR: {
          MODELTOOLSID: string
        }
      }
    }
  }
}

export interface AutodeskViewer3D {
  start: () => void
  finish: () => void
  loadDocumentNode: (
    doc: AutodeskDocument,
    viewable: unknown,
    options?: unknown
  ) => Promise<unknown>
  addEventListener: (event: string, callback: (e: unknown) => void) => void
  removeEventListener: (event: string, callback: (e: unknown) => void) => void
  getSelection: () => number[]
  select: (dbIds: number[]) => void
  fitToView: (dbIds?: number[]) => void
  getExtension: (name: string) => unknown
  loadExtension: (name: string, options?: unknown) => Promise<unknown>
  toolbar: unknown
  impl: {
    invalidate: (needsClear: boolean, needsRender: boolean) => void
  }
}

export interface AutodeskDocument {
  getRoot: () => { getDefaultGeometry: () => unknown }
}
```

---

### `src/components/AutodeskViewer/helpers.ts`

> **WAŻNE:** Naprawiona literówka w nazwie zmiennej środowiskowej.
> Oryginał miał `DEAFAULT_API_URL` — zmieniono na `NEXT_PUBLIC_API_URL`.

```typescript
// Pobiera token APS z naszej Next.js API route (server-side proxy)
// Nie używa NEXT_PUBLIC_API_URL bezpośrednio — token APS pochodzi z /api/aps/token
export async function getApsToken(): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('/api/aps/token')
  if (!response.ok) {
    throw new Error(`Failed to fetch APS token: ${response.statusText}`)
  }
  return response.json()
}

// Funkcja tokenCallback wymagana przez Autodesk.Viewing.Initializer
export function createTokenCallback(
  callback: (token: string, expires: number) => void
): () => void {
  return async () => {
    try {
      const tokenData = await getApsToken()
      callback(tokenData.access_token, tokenData.expires_in)
    } catch (error) {
      console.error('Error fetching APS token:', error)
      callback('', 0)
    }
  }
}

// Bazowy URL API backendu (do użytku po stronie klienta)
// NAPRAWIONE: było DEAFAULT_API_URL (literówka), teraz NEXT_PUBLIC_API_URL
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
```

---

### `src/components/AutodeskViewer/viewerRuntime.ts`

```typescript
// Zarządza cyklem życia runtime APS Viewer SDK.
// SDK jest ładowane z CDN Autodesk przez <script> tag w komponencie.
// Runtime inicjalizowany jest tylko raz — singleton pattern.

let runtimeInitialized = false
let initializationPromise: Promise<void> | null = null

export function isRuntimeInitialized(): boolean {
  return runtimeInitialized
}

export function initializeViewerRuntime(
  getAccessToken: (callback: (token: string, expires: number) => void) => void
): Promise<void> {
  if (runtimeInitialized) {
    return Promise.resolve()
  }

  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.Autodesk) {
      reject(new Error('Autodesk Viewer SDK not loaded'))
      return
    }

    // EU region — api: 'streamingV2_EU' jest WYMAGANE dla klientów EU
    window.Autodesk.Viewing.Initializer(
      {
        env: 'AutodeskProduction2',
        api: 'streamingV2_EU',
        getAccessToken,
      },
      () => {
        runtimeInitialized = true
        initializationPromise = null
        resolve()
      }
    )
  })

  return initializationPromise
}

export function teardownViewerRuntime(): void {
  runtimeInitialized = false
  initializationPromise = null
}
```

---

### `src/components/AutodeskViewer/FilterExtension/FilterExtension.ts`

```typescript
// Rozszerzenie APS Viewer umożliwiające filtrowanie elementów modelu 3D
// Skopiowane z autodesk-viewer-react i zaadaptowane do nowego projektu

export const FILTER_EXTENSION_ID = 'HvacFilterExtension'

export class FilterExtension {
  viewer: unknown
  options: unknown
  panel: unknown

  constructor(viewer: unknown, options: unknown) {
    this.viewer = viewer
    this.options = options
    this.panel = null
  }

  load(): boolean {
    console.log(`${FILTER_EXTENSION_ID} loaded`)
    return true
  }

  unload(): boolean {
    console.log(`${FILTER_EXTENSION_ID} unloaded`)
    return true
  }
}
```

---

### `src/components/AutodeskViewer/FilterExtension/ViewerFilterPanel.ts`

```typescript
// Panel UI filtrów w APS Viewer
// Skopiowane z autodesk-viewer-react

export class ViewerFilterPanel {
  viewer: unknown
  container: HTMLElement | null

  constructor(viewer: unknown) {
    this.viewer = viewer
    this.container = null
  }

  initialize(): void {
    this.container = document.createElement('div')
    this.container.className = 'hvac-filter-panel'
    this.container.style.cssText = `
      position: absolute;
      top: 60px;
      right: 10px;
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 10px;
      border-radius: 4px;
      z-index: 100;
    `
  }

  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
  }
}
```

---

### `src/components/AutodeskViewer/FilterExtension/index.ts`

```typescript
export { FilterExtension, FILTER_EXTENSION_ID } from './FilterExtension'
export { ViewerFilterPanel } from './ViewerFilterPanel'
```

---

### `src/components/AutodeskViewer/AutodeskViewer.tsx`

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { initializeViewerRuntime } from './viewerRuntime'
import { createTokenCallback } from './helpers'
import type { AutodeskViewer3D, AutodeskDocument } from './types'

interface AutodeskViewerProps {
  /** APS URN modelu do załadowania (base64 encoded) */
  urn: string
  /** Callback wywoływany gdy użytkownik zaznacza elementy w modelu */
  onElementSelected?: (dbIds: number[]) => void
  className?: string
}

// Ładuje skrypt APS SDK z CDN Autodesk (tylko raz)
function loadViewerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('autodesk-viewer-script')) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.id = 'autodesk-viewer-script'
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Autodesk Viewer SDK'))
    document.head.appendChild(script)
  })
}

export default function AutodeskViewer({
  urn,
  onElementSelected,
  className,
}: AutodeskViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<AutodeskViewer3D | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inicjalizuje viewer i ładuje model
  useEffect(() => {
    if (!containerRef.current) return

    let isCancelled = false

    async function setupViewer() {
      try {
        setIsLoading(true)
        setError(null)

        // 1. Załaduj SDK z CDN
        await loadViewerScript()

        if (isCancelled) return

        // 2. Zainicjalizuj runtime APS (singleton — bezpieczne do wielokrotnego wołania)
        const tokenCallback = createTokenCallback((token, expires) => {
          return { token, expires }
        })

        await initializeViewerRuntime((callback) => {
          getApsTokenForViewer(callback)
        })

        if (isCancelled || !containerRef.current) return

        // 3. Stwórz instancję viewer
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
          extensions: [],
          theme: 'dark-theme',
        })
        viewer.start()
        viewerRef.current = viewer

        // 4. Subskrybuj zdarzenie zaznaczenia elementów
        if (onElementSelected) {
          const selectionHandler = () => {
            const dbIds = viewer.getSelection()
            onElementSelected(dbIds)
          }
          viewer.addEventListener(
            window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
            selectionHandler
          )
        }

        // 5. Załaduj model przez URN
        await loadModelByUrn(viewer, urn)

        if (!isCancelled) {
          setIsLoading(false)
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Viewer initialization error:', err)
          setError(err instanceof Error ? err.message : 'Failed to initialize viewer')
          setIsLoading(false)
        }
      }
    }

    setupViewer()

    return () => {
      isCancelled = true
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Inicjalizacja tylko raz — viewer obsługuje zmianę URN osobno

  // Odświeżanie modelu gdy zmienia się prop `urn`
  useEffect(() => {
    if (!viewerRef.current || !urn) return
    loadModelByUrn(viewerRef.current, urn).catch((err) => {
      console.error('Error reloading model:', err)
      setError('Failed to reload model')
    })
  }, [urn])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-red-400 ${className}`}>
        <p>Błąd ładowania viewera: {error}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-white">Ładowanie modelu 3D...</div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}

async function getApsTokenForViewer(
  callback: (token: string, expires: number) => void
): Promise<void> {
  try {
    const response = await fetch('/api/aps/token')
    if (!response.ok) throw new Error('Failed to fetch APS token')
    const data = await response.json()
    callback(data.access_token, data.expires_in)
  } catch (err) {
    console.error('APS token error:', err)
    callback('', 0)
  }
}

async function loadModelByUrn(
  viewer: AutodeskViewer3D,
  urn: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const documentId = urn.startsWith('urn:') ? urn : `urn:${urn}`

    window.Autodesk.Viewing.Document.load(
      documentId,
      (doc: AutodeskDocument) => {
        const viewable = doc.getRoot().getDefaultGeometry()
        viewer
          .loadDocumentNode(doc, viewable)
          .then(() => resolve())
          .catch(reject)
      },
      (errorCode: number, errorMsg: string) => {
        reject(new Error(`Document load error ${errorCode}: ${errorMsg}`))
      }
    )
  })
}
```

> **Uwaga dotycząca deklaracji globalnej:** Powyższy kod używa `window.Autodesk.Viewing.Document.load` — ta metoda musi być dodana do deklaracji globalnych w `types.ts` (poniżej uzupełnienie).

---

### `src/components/AutodeskViewer/index.ts`

```typescript
export { default } from './AutodeskViewer'
export type { } from './types'
```

---

### `src/app/(auth)/layout.tsx`

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  )
}
```

---

### `src/app/(auth)/login/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginApi } from '@/lib/api'
import { storeAuthData } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const data = await loginApi(email, password)
      storeAuthData(data)
      router.push('/')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Błąd logowania. Sprawdź dane.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-800">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          HellCold Digital Twin
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          Zaloguj się do platformy HVAC
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user@hellcold.pl"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Hasło
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isLoading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  )
}
```

---

### `src/app/(dashboard)/layout.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated, getStoredUser, clearAuthData } from '@/lib/auth'
import { getAlerts } from '@/lib/api'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const user = getStoredUser()
  const [activeAlertCount, setActiveAlertCount] = useState(0)

  // Auth guard — przekieruj na /login jeśli brak tokena
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
    }
  }, [router])

  // Załaduj liczbę aktywnych alertów do sidebar badge
  useEffect(() => {
    getAlerts({ limit: 50, resolved: false })
      .then((alerts) => setActiveAlertCount(alerts.length))
      .catch(() => setActiveAlertCount(0))
  }, [pathname])

  function handleLogout() {
    clearAuthData()
    router.push('/login')
  }

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '◈' },
    { href: '/devices', label: 'Urządzenia', icon: '⊞' },
    { href: '/alerts', label: 'Alerty', icon: '⚠', badge: activeAlertCount },
  ]

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            HellCold
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
              Digital Twin Platform
            </span>
          </h1>
        </div>

        {/* Nawigacja */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 ? (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        {/* Separator + user info + logout */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-4 space-y-2">
          <p className="px-3 text-xs text-gray-400 dark:text-gray-500 truncate">
            {user?.email ?? 'Nieznany użytkownik'}
          </p>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Główna treść */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

---

### `src/app/(dashboard)/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSitesByClient, getDevicesBySite, getDeviceAlerts } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import DeviceCard from '@/components/DeviceCard'
import type { Device, Alert } from '@/lib/types'

interface DeviceWithAlerts {
  device: Device
  alerts: Alert[]
}

export default function DashboardPage() {
  const router = useRouter()
  const user = getStoredUser()
  const [deviceData, setDeviceData] = useState<DeviceWithAlerts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.clientId) {
      setError('Brak danych użytkownika')
      setIsLoading(false)
      return
    }

    async function loadDevices() {
      try {
        // Pobierz sites klienta
        const sites = await getSitesByClient(user!.clientId)

        // Pobierz urządzenia dla wszystkich site'ów
        const allDevicesPromises = sites.map((site) => getDevicesBySite(site.id))
        const allDevicesArrays = await Promise.all(allDevicesPromises)
        const allDevices = allDevicesArrays.flat()

        // Pobierz alerty dla każdego urządzenia
        const devicesWithAlerts = await Promise.all(
          allDevices.map(async (device) => {
            const alerts = await getDeviceAlerts(device.id).catch(() => [])
            return { device, alerts }
          })
        )

        setDeviceData(devicesWithAlerts)
      } catch (err) {
        console.error('Dashboard load error:', err)
        setError('Nie udało się załadować urządzeń')
      } finally {
        setIsLoading(false)
      }
    }

    loadDevices()
  }, [user?.clientId])

  if (isLoading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Dashboard
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {deviceData.length} urządzeń monitorowanych
        </p>
      </div>

      {deviceData.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Brak urządzeń do wyświetlenia.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deviceData.map(({ device, alerts }) => (
            <DeviceCard
              key={device.id}
              device={device}
              alerts={alerts}
              onClick={() => router.push(`/devices/${device.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/DeviceCard.tsx`

```typescript
'use client'

import type { Device, Alert } from '@/lib/types'

interface DeviceCardProps {
  device: Device
  alerts: Alert[]
  onClick?: () => void
}

// Wyznacza kolor statusu na podstawie aktywności i alertów
function getStatusColor(device: Device, alerts: Alert[]): {
  bg: string
  border: string
  dot: string
  label: string
} {
  const activeAlerts = alerts.filter((a) => !a.isResolved)
  const hasCritical = activeAlerts.some((a) => a.severity === 'critical')
  const hasWarning = activeAlerts.some((a) => a.severity === 'warning')

  if (!device.isActive) {
    return {
      bg: 'bg-gray-50 dark:bg-gray-900',
      border: 'border-gray-200 dark:border-gray-700',
      dot: 'bg-gray-400',
      label: 'Nieaktywne',
    }
  }

  if (hasCritical) {
    return {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-300 dark:border-red-800',
      dot: 'bg-red-500',
      label: 'Alarm krytyczny',
    }
  }

  if (hasWarning) {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      border: 'border-yellow-300 dark:border-yellow-800',
      dot: 'bg-yellow-500',
      label: 'Ostrzeżenie',
    }
  }

  return {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-300 dark:border-green-800',
    dot: 'bg-green-500',
    label: 'OK',
  }
}

export default function DeviceCard({ device, alerts, onClick }: DeviceCardProps) {
  const status = getStatusColor(device, alerts)
  const activeAlertCount = alerts.filter((a) => !a.isResolved).length

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md
        ${status.bg} ${status.border}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {status.label}
          </span>
        </div>
        {activeAlertCount > 0 && (
          <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full font-medium">
            {activeAlertCount} alert{activeAlertCount > 1 ? 'y' : ''}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate mb-1">
        {device.name}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Typ: {device.type}
      </p>
    </div>
  )
}
```

---

### `src/components/AlertsBadge.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getAlerts } from '@/lib/api'

interface AlertsBadgeProps {
  className?: string
}

export default function AlertsBadge({ className }: AlertsBadgeProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    getAlerts({ limit: 50, resolved: false })
      .then((alerts) => setCount(alerts.length))
      .catch(() => setCount(0))
  }, [])

  if (count === 0) return null

  return (
    <span
      className={`inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
```

---

### `src/components/AlertsList.tsx`

```typescript
'use client'

import { useState } from 'react'
import { resolveAlert } from '@/lib/api'
import type { Alert } from '@/lib/types'

interface AlertsListProps {
  alerts: Alert[]
  onAlertResolved?: (alertId: string) => void
}

const severityConfig: Record<Alert['severity'], { label: string; classes: string }> = {
  critical: {
    label: 'Krytyczny',
    classes: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  warning: {
    label: 'Ostrzeżenie',
    classes: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  info: {
    label: 'Info',
    classes: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
}

export default function AlertsList({ alerts, onAlertResolved }: AlertsListProps) {
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  async function handleResolve(alertId: string) {
    setResolvingIds((prev) => new Set(prev).add(alertId))
    try {
      await resolveAlert(alertId)
      onAlertResolved?.(alertId)
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(alertId)
        return next
      })
    }
  }

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
        Brak aktywnych alertów
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity]
        return (
          <div
            key={alert.id}
            className={`rounded-lg border px-3 py-2.5 ${config.classes}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${config.classes}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(alert.createdAt).toLocaleString('pl-PL')}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{alert.message}</p>
              </div>
              {!alert.isResolved && (
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingIds.has(alert.id)}
                  className="text-xs whitespace-nowrap px-2 py-1 rounded border border-current opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40"
                >
                  {resolvingIds.has(alert.id) ? '...' : 'Rozwiąż'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

### `src/components/TelemetryPanel.tsx`

```typescript
'use client'

import type { TelemetryPoint } from '@/lib/types'

interface TelemetryPanelProps {
  telemetry: TelemetryPoint[]
  isLoading?: boolean
  lastUpdated?: Date | null
}

// Mapowanie nazw metryk na czytelne etykiety i jednostki
const METRIC_CONFIG: Record<string, { label: string; unit: string }> = {
  temperature: { label: 'Temperatura', unit: '°C' },
  setpoint: { label: 'Setpoint', unit: '°C' },
  humidity: { label: 'Wilgotność', unit: '%' },
  power: { label: 'Moc', unit: 'kW' },
  mode: { label: 'Tryb', unit: '' },
  pressure: { label: 'Ciśnienie', unit: 'bar' },
  flow: { label: 'Przepływ', unit: 'm³/h' },
}

function formatValue(metric: string, value: number): string {
  if (metric === 'mode') {
    const modes: Record<number, string> = {
      0: 'off',
      1: 'cooling',
      2: 'heating',
      3: 'fan',
      4: 'auto',
    }
    return modes[value] ?? String(value)
  }
  return value.toFixed(1)
}

export default function TelemetryPanel({
  telemetry,
  isLoading,
  lastUpdated,
}: TelemetryPanelProps) {
  // Grupuj po metryce — weź ostatni punkt dla każdej
  const latestByMetric = new Map<string, TelemetryPoint>()
  for (const point of telemetry) {
    const existing = latestByMetric.get(point.metric)
    if (!existing || new Date(point.ts) > new Date(existing.ts)) {
      latestByMetric.set(point.metric, point)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Live Metrics
        </h3>
        {lastUpdated && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {lastUpdated.toLocaleTimeString('pl-PL')}
          </span>
        )}
      </div>

      {isLoading && latestByMetric.size === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : latestByMetric.size === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Brak danych telemetrycznych</p>
      ) : (
        <div className="space-y-2">
          {Array.from(latestByMetric.entries()).map(([metric, point]) => {
            const config = METRIC_CONFIG[metric] ?? { label: metric, unit: '' }
            return (
              <div
                key={metric}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <span className="text-sm text-gray-600 dark:text-gray-400">{config.label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatValue(metric, point.value)}
                  {config.unit && (
                    <span className="text-xs text-gray-400 ml-1">{config.unit}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/CasesPanel.tsx`

```typescript
'use client'

import type { D365Case } from '@/lib/types'

interface CasesPanelProps {
  cases: D365Case[]
  isLoading?: boolean
}

const statusColors: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function CasesPanel({ cases, isLoading }: CasesPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">Brak spraw w Dynamics 365</p>
    )
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => {
        const statusClass = statusColors[c.status.toLowerCase()] ?? statusColors.active
        return (
          <div
            key={c.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                {c.title}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusClass}`}>
                {c.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {new Date(c.createdOn).toLocaleDateString('pl-PL')}
            </p>
          </div>
        )
      })}
    </div>
  )
}
```

---

### `src/components/DocumentsPanel.tsx`

```typescript
'use client'

// Sekcja dokumentów — na razie statyczne placeholder linki.
// W przyszłości można podłączyć do SharePoint/Blob Storage przez osobny endpoint.

interface Document {
  id: string
  name: string
  type: 'pdf' | 'dwg' | 'xlsx' | 'docx' | 'other'
  url?: string
}

interface DocumentsPanelProps {
  // W przyszłości: documents: Document[]
  deviceId?: string
}

function getDocumentIcon(type: Document['type']): string {
  const icons: Record<Document['type'], string> = {
    pdf: '📄',
    dwg: '📐',
    xlsx: '📊',
    docx: '📝',
    other: '📎',
  }
  return icons[type]
}

// Placeholder dokumenty — zastąpić prawdziwym fetch gdy endpoint będzie dostępny
const PLACEHOLDER_DOCS: Document[] = [
  { id: '1', name: 'Instrukcja obsługi', type: 'pdf' },
  { id: '2', name: 'Schemat elektryczny', type: 'dwg' },
  { id: '3', name: 'Karta gwarancyjna', type: 'pdf' },
]

export default function DocumentsPanel({ deviceId }: DocumentsPanelProps) {
  const docs = PLACEHOLDER_DOCS

  if (docs.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">Brak dokumentów</p>
    )
  }

  return (
    <div className="space-y-1">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <span className="text-base" aria-hidden>
            {getDocumentIcon(doc.type)}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase ml-auto flex-shrink-0">
            {doc.type}
          </span>
        </div>
      ))}
    </div>
  )
}
```

---

### `src/app/(dashboard)/alerts/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getAlerts, resolveAlert } from '@/lib/api'
import type { Alert } from '@/lib/types'

const SEVERITY_OPTIONS = ['all', 'critical', 'warning', 'info'] as const
type SeverityFilter = (typeof SEVERITY_OPTIONS)[number]

const severityLabels: Record<SeverityFilter, string> = {
  all: 'Wszystkie',
  critical: 'Krytyczne',
  warning: 'Ostrzeżenia',
  info: 'Informacje',
}

const severityBadge: Record<Alert['severity'], string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIsLoading(true)
    getAlerts({ limit: 100, resolved: showResolved })
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setIsLoading(false))
  }, [showResolved])

  async function handleResolve(alertId: string) {
    setResolvingIds((prev) => new Set(prev).add(alertId))
    try {
      await resolveAlert(alertId)
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isResolved: true } : a))
      )
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(alertId)
        return next
      })
    }
  }

  const filteredAlerts = alerts.filter((a) =>
    severityFilter === 'all' ? true : a.severity === severityFilter
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Alerty</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {filteredAlerts.length} alertów
        </p>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SEVERITY_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              severityFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {severityLabels[s]}
          </button>
        ))}

        <label className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Pokaż rozwiązane
        </label>
      </div>

      {/* Tabela alertów */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
            Brak alertów spełniających kryteria
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ważność
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Wiadomość
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${severityBadge[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white max-w-xs truncate">
                    {alert.message}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(alert.createdAt).toLocaleString('pl-PL')}
                  </td>
                  <td className="px-6 py-4">
                    {alert.isResolved ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Rozwiązany
                      </span>
                    ) : (
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        Aktywny
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!alert.isResolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        disabled={resolvingIds.has(alert.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                      >
                        {resolvingIds.has(alert.id) ? 'Rozwiązywanie...' : 'Rozwiąż'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

---

### `src/app/(dashboard)/devices/[id]/page.tsx`

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getDevice, getSite, getDeviceAlerts, getDeviceTelemetry, getDeviceCases } from '@/lib/api'
import { useDeviceStore } from '@/store/useDeviceStore'
import AlertsList from '@/components/AlertsList'
import TelemetryPanel from '@/components/TelemetryPanel'
import CasesPanel from '@/components/CasesPanel'
import DocumentsPanel from '@/components/DocumentsPanel'
import type { SiteModel } from '@/lib/types'

// KLUCZOWE: APS Viewer musi być ładowany wyłącznie po stronie klienta (ssr: false)
// SDK Autodesk używa window, document i WebGL — nie działają na serwerze Node.js
const AutodeskViewer = dynamic(
  () => import('@/components/AutodeskViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">Ładowanie viewera 3D...</p>
      </div>
    ),
  }
)

const TELEMETRY_POLL_INTERVAL = 30_000 // 30 sekund

export default function DeviceDetailPage() {
  const params = useParams()
  const deviceId = params.id as string

  const { selectedDevice, alerts, telemetry, cases, setSelectedDevice, setAlerts, setTelemetry, setCases } =
    useDeviceStore()

  const [models, setModels] = useState<SiteModel[]>([])
  const [selectedUrn, setSelectedUrn] = useState<string>('')
  const [isLoadingDevice, setIsLoadingDevice] = useState(true)
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false)
  const [isLoadingCases, setIsLoadingCases] = useState(false)
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Załaduj dane urządzenia
  useEffect(() => {
    if (!deviceId) return

    async function loadDevice() {
      try {
        setIsLoadingDevice(true)
        setError(null)

        const device = await getDevice(deviceId)
        setSelectedDevice(device)

        // Pobierz alerty, modele i cases równolegle
        const [deviceAlerts, site, deviceCases] = await Promise.all([
          getDeviceAlerts(deviceId),
          getSite(device.siteId),
          getDeviceCases(deviceId).catch(() => []),
        ])

        setAlerts(deviceAlerts)
        setCases(deviceCases)

        if (site.models && site.models.length > 0) {
          setModels(site.models)
          setSelectedUrn(site.models[0].apsUrn)
        }
      } catch (err) {
        console.error('Device load error:', err)
        setError('Nie udało się załadować danych urządzenia')
      } finally {
        setIsLoadingDevice(false)
      }
    }

    loadDevice()

    return () => {
      setSelectedDevice(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  // Załaduj telemetrię z pollingiem co 30s
  const loadTelemetry = useCallback(async () => {
    if (!deviceId) return
    setIsLoadingTelemetry(true)
    try {
      const data = await getDeviceTelemetry(deviceId)
      setTelemetry(data)
      setLastTelemetryUpdate(new Date())
    } catch (err) {
      console.error('Telemetry load error:', err)
    } finally {
      setIsLoadingTelemetry(false)
    }
  }, [deviceId, setTelemetry])

  useEffect(() => {
    loadTelemetry()
    const interval = setInterval(loadTelemetry, TELEMETRY_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadTelemetry])

  // Gdy użytkownik zaznacza element w viewerze — znajdź urządzenie po apsObjectId
  function handleElementSelected(dbIds: number[]) {
    console.log('Selected APS object IDs:', dbIds)
    // Tu można dodać logikę nawigacji do urządzenia po apsObjectId
  }

  // Podświetl element w modelu odpowiadający urządzeniu
  // Viewer obsługuje to przez prop — gdy device.apsObjectId jest dostępne,
  // można przekazać je do viewera i wywołać viewer.select([apsObjectId])

  if (isLoadingDevice) {
    return (
      <div className="p-6">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <div className="flex gap-4 h-[calc(100vh-160px)]">
          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div className="w-80 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !selectedDevice) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error ?? 'Nie znaleziono urządzenia'}</p>
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block">
          Wróć do dashboardu
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          Dashboard
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {selectedDevice.name}
        </span>
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
          {selectedDevice.type}
        </span>

        {/* Selector modelu (jeśli więcej niż jeden) */}
        {models.length > 1 && (
          <div className="ml-auto">
            <select
              value={selectedUrn}
              onChange={(e) => setSelectedUrn(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {models.map((m) => (
                <option key={m.id} value={m.apsUrn}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Główna treść: viewer (70%) + panel (30%) */}
      <div className="flex flex-1 overflow-hidden">
        {/* APS Viewer — 70% */}
        <div className="flex-1 bg-gray-900 relative">
          {selectedUrn ? (
            <AutodeskViewer
              urn={selectedUrn}
              onElementSelected={handleElementSelected}
              className="w-full h-full aps-viewer-container"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400">Brak modelu 3D dla tego urządzenia</p>
            </div>
          )}
        </div>

        {/* Panel prawy — 30% */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Sekcja: Live Metrics */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <TelemetryPanel
                telemetry={telemetry}
                isLoading={isLoadingTelemetry}
                lastUpdated={lastTelemetryUpdate}
              />
            </section>

            {/* Sekcja: Aktywne Alerty */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Aktywne Alerty
              </h3>
              <AlertsList
                alerts={alerts.filter((a) => !a.isResolved)}
                onAlertResolved={(id) =>
                  setAlerts(alerts.map((a) => (a.id === id ? { ...a, isResolved: true } : a)))
                }
              />
            </section>

            {/* Sekcja: D365 Cases */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Sprawy Dynamics 365
              </h3>
              <CasesPanel cases={cases} isLoading={isLoadingCases} />
            </section>

            {/* Sekcja: Dokumenty */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Dokumenty
              </h3>
              <DocumentsPanel deviceId={selectedDevice.id} />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### `Dockerfile` (produkcja)

```dockerfile
# Stage 1: Instalacja zależności
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Budowanie aplikacji
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Zmienne środowiskowe wymagane podczas buildu
# NEXT_PUBLIC_* muszą być dostępne w czasie build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Uruchomienie (standalone output)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Skopiuj standalone output (zawiera minimalny server.js)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

---

### `Dockerfile.dev`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

---

## 5. Adaptacja AutodeskViewer — szczegółowe wytyczne

### Problem oryginalnego kodu

Oryginalny `AutodeskViewer.tsx` w `autodesk-viewer-react` pobierał URN modelu wewnętrznie przez własny fetch do `/api/models`. W nowym systemie URN pochodzi z odpowiedzi backendu (`SiteModel.apsUrn`) i jest przekazywany jako prop.

### Zmiany wymagane

| Aspekt | Oryginał | Nowa wersja |
|--------|----------|-------------|
| Źródło URN | Wewnętrzny fetch `/api/models` | Prop `urn: string` |
| API URL | `DEAFAULT_API_URL` (literówka) | `NEXT_PUBLIC_API_URL` (naprawione) |
| Callback zaznaczenia | Brak | `onElementSelected?: (dbIds: number[]) => void` |
| Odświeżanie modelu | Przy mount | `useEffect([urn])` — reaguje na zmianę prop |
| Import w page.tsx | Bezpośredni | `dynamic(..., { ssr: false })` |

### Odświeżanie modelu przy zmianie URN

```typescript
// Osobny useEffect obserwuje zmianę prop `urn`
useEffect(() => {
  if (!viewerRef.current || !urn) return
  loadModelByUrn(viewerRef.current, urn)
}, [urn])
```

Viewer NIE jest niszczony i tworzony ponownie przy zmianie URN — tylko model jest przeładowywany przez `loadDocumentNode`. To ważne dla wydajności.

### Selekcja elementu po apsObjectId

Na stronie DeviceDetail, po załadowaniu modelu można wywołać:

```typescript
// W callbacku GEOMETRY_LOADED_EVENT:
viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
  if (device.apsObjectId) {
    viewer.select([device.apsObjectId])
    viewer.fitToView([device.apsObjectId])
  }
})
```

---

## 6. APS Viewer i SSR — jak obsłużyć

### Dlaczego APS Viewer nie działa z SSR

Autodesk Platform Services Viewer SDK jest biblioteką przeznaczoną wyłącznie dla przeglądarki:
- Używa globalnych obiektów `window`, `document`, `navigator`
- Inicjalizuje WebGL context przez `canvas` element
- Ładuje WASM moduły i Web Workers
- Żaden z tych mechanizmów nie jest dostępny w środowisku Node.js (Next.js server-side)

### Rozwiązanie: `dynamic` z `ssr: false`

```typescript
// src/app/(dashboard)/devices/[id]/page.tsx
import dynamic from 'next/dynamic'

const AutodeskViewer = dynamic(
  () => import('@/components/AutodeskViewer'),
  {
    ssr: false,  // KRYTYCZNE — bez tego build się nie skompiluje
    loading: () => <div>Ładowanie viewera 3D...</div>,
  }
)
```

### Plik `AutodeskViewer.tsx` musi mieć `'use client'`

Dyrektywa `'use client'` na początku pliku jest wymagana, bo komponent używa hooków React (`useEffect`, `useRef`, `useState`) i bezpośrednio manipuluje DOM.

### SDK ładowane z CDN (nie npm)

APS Viewer v7 nie ma pakietu npm kompatybilnego z Next.js bundlerem. SDK jest ładowane dynamicznie przez `<script>` tag wstrzykiwany do `document.head` przy pierwszym renderze komponentu. Funkcja `loadViewerScript()` jest idempotentna — sprawdza czy skrypt już istnieje przed dodaniem.

### Zmienne środowiskowe w API route (token APS)

```
AUTODESK_CLIENT_ID     — bez prefiksu NEXT_PUBLIC_, dostępne tylko na serwerze
AUTODESK_CLIENT_SECRET — bez prefiksu NEXT_PUBLIC_, dostępne tylko na serwerze
```

Token APS jest pobierany przez Next.js API route (`/api/aps/token`) i przekazywany do viewera. Klucze API nigdy nie trafiają do klienta.

---

## 7. Weryfikacja

### Build check

```bash
cd frontend
npm install
npm run build
```

Build MUSI przejść bez błędów. Najczęstsze problemy:
- Brak `'use client'` w komponentach używających hooków
- Import `AutodeskViewer` bez `dynamic(..., { ssr: false })` — TypeScript/Next.js nie może zserializować `window.Autodesk`
- Brakujące typy dla globalnego `window.Autodesk` — sprawdzić `types.ts`

### Lista stron do ręcznego przetestowania

| Strona | URL | Co testować |
|--------|-----|-------------|
| Logowanie | `/login` | Formularz działa, błędne dane → komunikat błędu, poprawne → redirect na `/` |
| Auth guard | `/` (bez tokena) | Redirect na `/login` |
| Dashboard | `/` | Lista urządzeń ładuje się, kolory statusów poprawne (zielony/żółty/czerwony), kliknięcie → nawigacja do `/devices/:id` |
| Device Detail | `/devices/:id` | Viewer 3D ładuje się (sprawdź DevTools → brak błędów SSR), Live Metrics co 30s się odświeża, alerty widoczne, sekcja Cases wyświetlona |
| APS Viewer | `/devices/:id` | Model 3D renderuje się, EU region w Network → wywołania `streamingV2_EU`, kliknięcie elementu → `onElementSelected` callback |
| Zmiana modelu | `/devices/:id` (selektor) | Wybór innego modelu → viewer przeładowuje model bez refreshu strony |
| Alerty | `/alerts` | Tabela ładuje się, filtrowanie po severity działa, resolve alertu zmienia status |
| Token APS | `/api/aps/token` | GET zwraca `{ access_token, expires_in }`, nie eksponuje client_secret |
| Logout | Sidebar → Wyloguj | Czyści localStorage, redirect na `/login` |

### Zmienne środowiskowe — plik `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
AUTODESK_CLIENT_ID=twoj_client_id
AUTODESK_CLIENT_SECRET=twoj_client_secret
BACKEND_URL=http://backend:3001
```

### Instalacja shadcn/ui (po inicjalizacji projektu)

```bash
npx shadcn@latest init
npx shadcn@latest add button card badge table input dialog separator skeleton
```

Komponenty shadcn/ui trafią do `src/components/ui/` i mogą być używane w pozostałych komponentach przez import `@/components/ui/button` itd.
