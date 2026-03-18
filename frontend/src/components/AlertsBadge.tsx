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
