'use client'

import type { TelemetryPoint } from '@/lib/types'

interface TelemetryPanelProps {
  telemetry: TelemetryPoint[]
  isLoading?: boolean
  lastUpdated?: Date | null
}

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
  // Group by metric — take latest point for each
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
