'use client'

import type { Device, Alert } from '@/lib/types'

interface DeviceCardProps {
  device: Device
  alerts: Alert[]
  onClick?: () => void
}

function getStatusColor(
  device: Device,
  alerts: Alert[]
): { bg: string; border: string; dot: string; label: string } {
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
      className={`rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md ${status.bg} ${status.border}`}
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
