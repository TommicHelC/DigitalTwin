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
