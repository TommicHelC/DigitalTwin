'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClients, getSitesByClient, getDevicesBySite, getDeviceAlerts } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import DeviceCard from '@/components/DeviceCard'
import type { Client, Device, Alert } from '@/lib/types'

interface DeviceWithAlerts {
  device: Device
  alerts: Alert[]
}

export default function DashboardPage() {
  const router = useRouter()
  const user = getStoredUser()
  const [deviceData, setDeviceData] = useState<DeviceWithAlerts[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        if (user?.role === 'admin' && !user?.clientId) {
          const clientList = await getClients()
          setClients(clientList)
          setIsLoading(false)
          return
        }

        if (!user?.clientId) {
          setError('Brak przypisanego klienta dla tego użytkownika')
          setIsLoading(false)
          return
        }

        const sites = await getSitesByClient(user.clientId)
        const allDevicesArrays = await Promise.all(sites.map((site) => getDevicesBySite(site.id)))
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
        setError('Nie udało się załadować danych')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user?.clientId, user?.role])

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

  if (user?.role === 'admin' && !user?.clientId) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Panel administratora</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{clients.length} klientów w systemie</p>
        {clients.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Brak klientów. Dodaj pierwszego klienta przez API.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <div key={client.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{client.contactEmail ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
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
