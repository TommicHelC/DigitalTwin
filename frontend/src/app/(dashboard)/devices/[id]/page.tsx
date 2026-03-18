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

// CRITICAL: APS Viewer must be loaded client-side only (ssr: false)
// Autodesk SDK uses window, document, WebGL — not available in Node.js
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

const TELEMETRY_POLL_INTERVAL = 30_000 // 30 seconds

export default function DeviceDetailPage() {
  const params = useParams()
  const deviceId = params.id as string

  const { selectedDevice, alerts, telemetry, cases, setSelectedDevice, setAlerts, setTelemetry, setCases } =
    useDeviceStore()

  const [models, setModels] = useState<SiteModel[]>([])
  const [selectedUrn, setSelectedUrn] = useState<string>('')
  const [isLoadingDevice, setIsLoadingDevice] = useState(true)
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false)
  const [isLoadingCases] = useState(false)
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load device data
  useEffect(() => {
    if (!deviceId) return

    async function loadDevice() {
      try {
        setIsLoadingDevice(true)
        setError(null)

        const device = await getDevice(deviceId)
        setSelectedDevice(device)

        // Load alerts, models and cases in parallel
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

  // Load telemetry with 30s polling
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

  function handleElementSelected(dbIds: number[]) {
    console.log('Selected APS object IDs:', dbIds)
  }

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

        {/* Model selector (if more than one) */}
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

      {/* Main content: viewer (70%) + panel (30%) */}
      <div className="flex flex-1 overflow-hidden">
        {/* APS Viewer */}
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

        {/* Right panel */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4 space-y-4">
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <TelemetryPanel
                telemetry={telemetry}
                isLoading={isLoadingTelemetry}
                lastUpdated={lastTelemetryUpdate}
              />
            </section>

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

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Sprawy Dynamics 365
              </h3>
              <CasesPanel cases={cases} isLoading={isLoadingCases} />
            </section>

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
