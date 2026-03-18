// Types for APS Viewer SDK (loaded from CDN — no npm types)
// Global declarations allow using Autodesk.Viewing.* without TS errors

export interface ViewerConfig {
  extensions?: string[]
  useADP?: boolean
  theme?: string
}

export interface ApsToken {
  access_token: string
  expires_in: number
}

export interface ViewerInitOptions {
  env: string
  api: string
  getAccessToken: (callback: (token: string, expires: number) => void) => void
}

export interface ViewerRuntimeOptions {
  env?: string
  api?: string
  getAccessToken?: (callback: (token: string, expires: number) => void) => void
}

// Augment global Autodesk namespace (loaded from CDN)
declare global {
  interface Window {
    Autodesk: {
      Viewing: {
        Initializer: (options: ViewerInitOptions, callback: () => void) => void
        GuiViewer3D: new (
          container: HTMLElement,
          config?: ViewerConfig
        ) => AutodeskViewer3D
        Document: {
          load: (
            documentId: string,
            onSuccess: (doc: AutodeskDocument) => void,
            onError: (errorCode: number, errorMsg: string) => void
          ) => void
        }
        Extension: {
          new (viewer: AutodeskViewer3D, options: unknown): unknown
        }
        AGGREGATE_SELECTION_CHANGED_EVENT: string
        GEOMETRY_LOADED_EVENT: string
        TOOLBAR: {
          MODELTOOLSID: string
        }
      }
    }
  }
}

export interface AutodeskViewer3D {
  start: () => void
  finish: () => void
  loadDocumentNode: (
    doc: AutodeskDocument,
    viewable: unknown,
    options?: unknown
  ) => Promise<unknown>
  addEventListener: (event: string, callback: (e: unknown) => void) => void
  removeEventListener: (event: string, callback: (e: unknown) => void) => void
  getSelection: () => number[]
  select: (dbIds: number[]) => void
  fitToView: (dbIds?: number[]) => void
  getExtension: (name: string) => unknown
  loadExtension: (name: string, options?: unknown) => Promise<unknown>
  toolbar: unknown
  impl: {
    invalidate: (needsClear: boolean, needsRender: boolean) => void
  }
}

export interface AutodeskDocument {
  getRoot: () => { getDefaultGeometry: () => unknown }
}
