import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// NetSuite API configuration
const NETSUITE_ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID || '7913744'
const NETSUITE_BASE_URL = `https://${NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com`
const NETSUITE_CONSUMER_KEY = process.env.NETSUITE_CONSUMER_KEY || ''
const NETSUITE_TOKEN_ID = process.env.NETSUITE_TOKEN_ID || ''
const NETSUITE_CONSUMER_SECRET = process.env.NETSUITE_CONSUMER_SECRET || ''
const NETSUITE_TOKEN_SECRET = process.env.NETSUITE_TOKEN_SECRET || ''

// OAuth 1.0 HMAC-SHA256 signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Step 1: Collect all parameters and sort them
  const allParams: Array<[string, string]> = Object.entries(params)
    .map(([key, value]): [string, string] => [encodeURIComponent(key), encodeURIComponent(value)])
    .sort(([a], [b]) => a.localeCompare(b))

  // Step 2: Create normalized parameter string
  const normalizedParams = allParams
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  // Step 3: Create signature base string
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(normalizedParams)}`

  // Step 4: Create signing key (secrets should NOT be URL encoded)
  const signingKey = `${consumerSecret}&${tokenSecret}`

  // Step 5: Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBaseString)
    .digest('base64')

  // Step 6: URL encode the signature
  return encodeURIComponent(signature)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { q } = body

    if (!q) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check if OAuth credentials are configured
    if (!NETSUITE_CONSUMER_KEY || !NETSUITE_TOKEN_ID || !NETSUITE_CONSUMER_SECRET || !NETSUITE_TOKEN_SECRET) {
      return NextResponse.json(
        { error: 'NetSuite OAuth credentials not configured' },
        { status: 500 }
      )
    }

    // Generate OAuth signature
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = Math.random().toString(36).substring(2, 15)
    
    // Prepare OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: NETSUITE_CONSUMER_KEY,
      oauth_token: NETSUITE_TOKEN_ID,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    }
    
    // Generate OAuth signature
    const url = `${NETSUITE_BASE_URL}/services/rest/query/v1/suiteql`
    const oauthSignature = generateOAuthSignature(
      'POST',
      url,
      oauthParams,
      NETSUITE_CONSUMER_SECRET,
      NETSUITE_TOKEN_SECRET
    )
    
    // Build OAuth authorization header
    const authHeader = `OAuth realm="${NETSUITE_ACCOUNT_ID}",` +
      `oauth_consumer_key="${NETSUITE_CONSUMER_KEY}",` +
      `oauth_token="${NETSUITE_TOKEN_ID}",` +
      `oauth_signature_method="HMAC-SHA256",` +
      `oauth_timestamp="${timestamp}",` +
      `oauth_nonce="${nonce}",` +
      `oauth_version="1.0",` +
      `oauth_signature="${oauthSignature}"`

    // Make request to NetSuite
    const response = await fetch(`${NETSUITE_BASE_URL}/services/rest/query/v1/suiteql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'transient',
        'Authorization': authHeader,
        'Accept': '*/*',
      },
      body: JSON.stringify({ q }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('NetSuite API error:', response.status, errorText)
      return NextResponse.json(
        { error: `NetSuite API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in NetSuite API route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

