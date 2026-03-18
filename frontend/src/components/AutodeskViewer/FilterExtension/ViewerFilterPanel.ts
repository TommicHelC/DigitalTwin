// Filter panel UI for APS Viewer
// Adapted from autodesk-viewer-react

export class ViewerFilterPanel {
  viewer: unknown
  container: HTMLElement | null

  constructor(viewer: unknown) {
    this.viewer = viewer
    this.container = null
  }

  initialize(): void {
    this.container = document.createElement('div')
    this.container.className = 'hvac-filter-panel'
    this.container.style.cssText = `
      position: absolute;
      top: 60px;
      right: 10px;
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 10px;
      border-radius: 4px;
      z-index: 100;
    `
  }

  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
  }
}
