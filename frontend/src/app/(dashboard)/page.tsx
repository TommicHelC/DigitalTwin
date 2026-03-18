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
        const sites = await getSitesByClient(user!.clientId)

        const allDevicesPromises = sites.map((site) => getDevicesBySite(site.id))
        const allDevicesArrays = await Promise.all(allDevicesPromises)
        const allDevices = allDevicesArrays.flat()

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
