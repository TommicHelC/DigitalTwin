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
