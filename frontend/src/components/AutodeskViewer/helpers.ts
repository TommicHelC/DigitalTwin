// Fetches APS token from our Next.js API route (server-side proxy)
// FIXED: was DEAFAULT_API_URL (typo) — now NEXT_PUBLIC_API_URL
export async function getApsToken(): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('/api/aps/token')
  if (!response.ok) {
    throw new Error(`Failed to fetch APS token: ${response.statusText}`)
  }
  return response.json()
}

// Token callback required by Autodesk.Viewing.Initializer
export function createTokenCallback(
  callback: (token: string, expires: number) => void
): () => void {
  return async () => {
    try {
      const tokenData = await getApsToken()
      callback(tokenData.access_token, tokenData.expires_in)
    } catch (error) {
      console.error('Error fetching APS token:', error)
      callback('', 0)
    }
  }
}

// Alias used by viewerRuntime.ts
export const getAccessToken = (callback: (token: string, expires: number) => void): void => {
  getApsToken()
    .then((data) => callback(data.access_token, data.expires_in))
    .catch(() => callback('', 0))
}

// Backend API base URL (client-side)
// FIXED: was DEAFAULT_API_URL (typo)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
