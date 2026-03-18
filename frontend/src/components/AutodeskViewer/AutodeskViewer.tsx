'use client'

import { useEffect, useRef, useState } from 'react'
import { initializeViewerRuntime } from './viewerRuntime'
import type { AutodeskViewer3D, AutodeskDocument } from './types'

interface AutodeskViewerProps {
  /** APS model URN to load (base64 encoded) */
  urn: string
  /** Callback invoked when user selects elements in the model */
  onElementSelected?: (dbIds: number[]) => void
  className?: string
}

function loadViewerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('autodesk-viewer-script')) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.id = 'autodesk-viewer-script'
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Autodesk Viewer SDK'))
    document.head.appendChild(script)
  })
}

export default function AutodeskViewer({
  urn,
  onElementSelected,
  className,
}: AutodeskViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<AutodeskViewer3D | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let isCancelled = false

    async function setupViewer() {
      try {
        setIsLoading(true)
        setError(null)

        // 1. Load SDK from CDN
        await loadViewerScript()
        if (isCancelled) return

        // 2. Initialize APS runtime (singleton — safe to call multiple times)
        await initializeViewerRuntime({})
        if (isCancelled || !containerRef.current) return

        // 3. Create viewer instance
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
          extensions: [],
          theme: 'dark-theme',
        })
        viewer.start()
        viewerRef.current = viewer

        // 4. Subscribe to element selection events
        if (onElementSelected) {
          const selectionHandler = () => {
            const dbIds = viewer.getSelection()
            onElementSelected(dbIds)
          }
          viewer.addEventListener(
            window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
            selectionHandler
          )
        }

        // 5. Load model by URN
        await loadModelByUrn(viewer, urn)

        if (!isCancelled) {
          setIsLoading(false)
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Viewer initialization error:', err)
          setError(err instanceof Error ? err.message : 'Failed to initialize viewer')
          setIsLoading(false)
        }
      }
    }

    setupViewer()

    return () => {
      isCancelled = true
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Initialize only once — viewer handles URN change separately

  // Reload model when `urn` prop changes
  useEffect(() => {
    if (!viewerRef.current || !urn) return
    loadModelByUrn(viewerRef.current, urn).catch((err) => {
      console.error('Error reloading model:', err)
      setError('Failed to reload model')
    })
  }, [urn])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-red-400 ${className}`}>
        <p>Błąd ładowania viewera: {error}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-white">Ładowanie modelu 3D...</div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}

async function loadModelByUrn(
  viewer: AutodeskViewer3D,
  urn: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const documentId = urn.startsWith('urn:') ? urn : `urn:${urn}`

    window.Autodesk.Viewing.Document.load(
      documentId,
      (doc: AutodeskDocument) => {
        const viewable = doc.getRoot().getDefaultGeometry()
        viewer
          .loadDocumentNode(doc, viewable)
          .then(() => resolve())
          .catch(reject)
      },
      (errorCode: number, errorMsg: string) => {
        reject(new Error(`Document load error ${errorCode}: ${errorMsg}`))
      }
    )
  })
}
