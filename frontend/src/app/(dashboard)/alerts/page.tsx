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

      {/* Filters */}
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

      {/* Alerts table */}
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
