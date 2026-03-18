import { NextResponse } from 'next/server'

// Server-side only — does not expose API keys to the client
// Uses AUTODESK_CLIENT_ID and AUTODESK_CLIENT_SECRET (no NEXT_PUBLIC_ prefix)

export async function GET() {
  const clientId = process.env.AUTODESK_CLIENT_ID
  const clientSecret = process.env.AUTODESK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'APS credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'data:read viewables:read',
    })

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(
      'https://developer.api.autodesk.com/authentication/v2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: params.toString(),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('APS token error:', errorText)
      return NextResponse.json(
        { error: 'Failed to obtain APS token' },
        { status: response.status }
      )
    }

    const tokenData = await response.json()

    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    })
  } catch (error) {
    console.error('APS token fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
