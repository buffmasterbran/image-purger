import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.IMGIX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "IMGIX_API_KEY is not configured" },
        { status: 500 }
      );
    }

    console.log(`Attempting to purge Imgix cache for: ${url}`);
    console.log(`Using API key: ${apiKey.substring(0, 10)}...`);

    try {
      const response = await axios.post(
        "https://api.imgix.com/api/v1/purge",
        {
          data: {
            attributes: {
              url,
            },
            type: "purges",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        return NextResponse.json({
          success: true,
          message: "Cache purged successfully",
          status: response.status,
        });
      } else {
        return NextResponse.json(
          {
            error: `Imgix purge failed: ${response.statusText}`,
            status: response.status,
          },
          { status: 500 }
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If it's a 409 (duplicate purge), that's okay
        if (error.response?.status === 409) {
          return NextResponse.json({
            success: true,
            message: "Cache already purged",
            status: 409,
          });
        }
        
        return NextResponse.json(
          {
            error: `Imgix purge error: ${error.message}`,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          },
          { status: error.response?.status || 500 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in test-imgix route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to purge cache",
      },
      { status: 500 }
    );
  }
}

