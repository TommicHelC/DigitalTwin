import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // APS Viewer SDK jest ładowany z CDN Autodesk i wymaga środowiska browser.
  // AutodeskViewer MUSI być importowany z dynamic(..., { ssr: false }).
  turbopack: {},
}

export default nextConfig
