import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // APS Viewer SDK jest ładowany z CDN Autodesk i wymaga środowiska browser.
  // AutodeskViewer MUSI być importowany z dynamic(..., { ssr: false }).
  experimental: {
    reactCompiler: false,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }
    return config
  },
}

export default nextConfig
