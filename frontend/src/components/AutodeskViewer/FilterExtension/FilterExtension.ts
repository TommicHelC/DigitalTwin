// APS Viewer extension for filtering model elements
// Adapted from autodesk-viewer-react

export const FILTER_EXTENSION_ID = 'HvacFilterExtension'

export class FilterExtension {
  viewer: unknown
  options: unknown
  panel: unknown

  constructor(viewer: unknown, options: unknown) {
    this.viewer = viewer
    this.options = options
    this.panel = null
  }

  load(): boolean {
    console.log(`${FILTER_EXTENSION_ID} loaded`)
    return true
  }

  unload(): boolean {
    console.log(`${FILTER_EXTENSION_ID} unloaded`)
    return true
  }
}
