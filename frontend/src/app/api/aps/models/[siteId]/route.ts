import { NextRequest, NextResponse } from 'next/server'

// Proxy to backend — uses BACKEND_URL (server-side) instead of NEXT_PUBLIC_API_URL
// Prevents client from needing direct access to backend in Docker network

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const backendUrl = process.env.BACKEND_URL || 'http://backend:3001'
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/sites/${params.siteId}/models`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch models' },
        { status: response.status }
      )
    }

    const models = await response.json()
    return NextResponse.json(models)
  } catch (error) {
    console.error('Models proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
