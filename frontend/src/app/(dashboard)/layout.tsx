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

  // Auth guard — redirect to /login if no token
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
    }
  }, [router])

  // Load active alert count for sidebar badge
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

        {/* Navigation */}
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

        {/* User info + logout */}
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

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
