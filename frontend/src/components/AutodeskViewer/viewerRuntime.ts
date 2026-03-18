// Viewer runtime initialization helper
// Ensures viewer runtime is initialized only once globally

import { ViewerRuntimeOptions } from './types'
import { getAccessToken } from './helpers'

interface RuntimeState {
  options: ViewerRuntimeOptions | null
  ready: Promise<void> | null
  scriptsLoaded: boolean
  viewerInitialized: boolean // separate flag: Initializer called only once
}

const runtime: RuntimeState = {
  options: null,
  ready: null,
  scriptsLoaded: false,
  viewerInitialized: false,
}

export function loadViewerScripts(): Promise<void> {
  if (runtime.scriptsLoaded) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.async = true
    script.onload = () => {
      runtime.scriptsLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Autodesk Viewer scripts'))
    document.head.appendChild(script)
  })
}

export function initializeViewerRuntime(options: ViewerRuntimeOptions = {}): Promise<void> {
  if (runtime.ready) return runtime.ready

  runtime.options = {
    env: 'AutodeskProduction2',
    api: 'streamingV2_EU', // EU region — required for PL/EU clients
    getAccessToken,
    ...options,
  }

  runtime.ready = loadViewerScripts().then(() => {
    return new Promise<void>((resolve) => {
      if (!window.Autodesk?.Viewing) throw new Error('Autodesk Viewing namespace not found')

      // Autodesk.Viewing.Initializer must NOT be called twice
      // (React StrictMode, language reinit). If already called — resolve immediately.
      if (runtime.viewerInitialized) {
        resolve()
        return
      }

      window.Autodesk.Viewing.Initializer(runtime.options as Parameters<typeof window.Autodesk.Viewing.Initializer>[0], () => {
        runtime.viewerInitialized = true
        resolve()
      })
    })
  })

  return runtime.ready
}

export function getRuntime(): RuntimeState {
  return runtime
}

export function resetViewerRuntime(): void {
  runtime.options = null
  runtime.ready = null
  // viewerInitialized and scriptsLoaded are NOT reset — scripts/SDK already in DOM
}
