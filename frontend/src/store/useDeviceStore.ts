import { create } from 'zustand'
import type { Device, Alert, TelemetryPoint, D365Case } from '@/lib/types'

interface DeviceStore {
  selectedDevice: Device | null
  alerts: Alert[]
  telemetry: TelemetryPoint[]
  cases: D365Case[]
  isLoadingTelemetry: boolean
  setSelectedDevice: (device: Device | null) => void
  setAlerts: (alerts: Alert[]) => void
  setTelemetry: (telemetry: TelemetryPoint[]) => void
  setCases: (cases: D365Case[]) => void
  setIsLoadingTelemetry: (loading: boolean) => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  selectedDevice: null,
  alerts: [],
  telemetry: [],
  cases: [],
  isLoadingTelemetry: false,
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  setAlerts: (alerts) => set({ alerts }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setCases: (cases) => set({ cases }),
  setIsLoadingTelemetry: (loading) => set({ isLoadingTelemetry: loading }),
}))
