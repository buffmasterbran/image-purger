import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.IMGIX_API_KEY;
  
  return NextResponse.json({
    hasKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey?.substring(0, 10) || 'N/A',
    keySuffix: apiKey?.substring(Math.max(0, (apiKey?.length || 0) - 10)) || 'N/A',
    // Don't return the full key for security
  });
}

