import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { parse } from "svg-parser";

// Initialize S3 client for Wasabi (S3-compatible)
function getS3Client() {
  const region = process.env.WASABI_REGION || "us-east-1";
  const endpoint = `https://s3.${region}.wasabisys.com`;

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // Required for Wasabi
  });
}

// Extract the path from an Imgix URL or Wasabi URL to get the Wasabi key
function extractWasabiKey(urlString: string): string {
  try {
    const url = new URL(urlString);
    
    // Check if it's a direct Wasabi URL (s3.us-east-1.wasabisys.com or similar)
    if (url.hostname.includes('wasabisys.com')) {
      // For Wasabi URLs: https://s3.us-east-1.wasabisys.com/bucket-name/key/path
      // The bucket name is the first path segment, the key is everything after
      const pathParts = url.pathname.split("/").filter((part) => part);
      if (pathParts.length < 2) {
        throw new Error(`Invalid Wasabi URL format: ${urlString}`);
      }
      // Skip the bucket name (first part) and join the rest as the key
      return pathParts.slice(1).join("/");
    }
    
    // Otherwise, treat it as an Imgix URL
    // Example: https://pirani-customizer.imgix.net/rendered/.../preview.png
    // Should become: rendered/.../preview.png
    const pathParts = url.pathname.split("/");
    // Remove empty first element and get the rest
    const keyParts = pathParts.filter((part) => part);
    return keyParts.join("/");
  } catch (error) {
    throw new Error(`Invalid URL format: ${urlString}`);
  }
}

// Upload file to Wasabi
async function uploadToWasabi(
  file: Buffer,
  key: string,
  contentType: string
): Promise<void> {
  const s3Client = getS3Client();
  const bucket = process.env.WASABI_BUCKET_NAME!;

  console.log(`Wasabi upload - Bucket: ${bucket}, Key: ${key}, ContentType: ${contentType}, FileSize: ${file.length} bytes`);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);
  console.log(`Successfully uploaded to Wasabi: ${bucket}/${key}`);
}

// Convert SVG to DXF format
function convertSvgToDxf(svgContent: string): string {
  try {
    const svgDoc = parse(svgContent);
    const dxfLines: string[] = [];

    // DXF Header
    dxfLines.push("0");
    dxfLines.push("SECTION");
    dxfLines.push("2");
    dxfLines.push("HEADER");
    dxfLines.push("9");
    dxfLines.push("$ACADVER");
    dxfLines.push("1");
    dxfLines.push("AC1015");
    dxfLines.push("0");
    dxfLines.push("ENDSEC");

    // DXF Tables
    dxfLines.push("0");
    dxfLines.push("SECTION");
    dxfLines.push("2");
    dxfLines.push("TABLES");
    dxfLines.push("0");
    dxfLines.push("ENDSEC");

    // DXF Blocks
    dxfLines.push("0");
    dxfLines.push("SECTION");
    dxfLines.push("2");
    dxfLines.push("BLOCKS");
    dxfLines.push("0");
    dxfLines.push("ENDSEC");

    // DXF Entities
    dxfLines.push("0");
    dxfLines.push("SECTION");
    dxfLines.push("2");
    dxfLines.push("ENTITIES");

    // Recursively process SVG nodes
    function processNode(node: any, transform: { x: number; y: number; scale: number } = { x: 0, y: 0, scale: 1 }) {
      if (!node || typeof node !== "object") return;

      if (node.type === "element") {
        const tagName = node.tagName?.toLowerCase();
        const properties = node.properties || {};

        // Handle SVG path elements
        if (tagName === "path" && properties.d) {
          const pathData = properties.d;
          // Convert SVG path to DXF POLYLINE or LWPOLYLINE
          // This is a simplified conversion - complex paths may need more processing
          const pathCommands = parseSvgPath(pathData);
          for (const cmd of pathCommands) {
            if (cmd.type === "M" || cmd.type === "L") {
              // Move or Line command
              dxfLines.push("0");
              dxfLines.push("LINE");
              dxfLines.push("8");
              dxfLines.push("0"); // Layer
              dxfLines.push("10");
              dxfLines.push((cmd.x * transform.scale + transform.x).toString());
              dxfLines.push("20");
              dxfLines.push((cmd.y * transform.scale + transform.y).toString());
              dxfLines.push("11");
              dxfLines.push((cmd.x2 * transform.scale + transform.x).toString());
              dxfLines.push("21");
              dxfLines.push((cmd.y2 * transform.scale + transform.y).toString());
            }
          }
        }

        // Handle SVG line elements
        if (tagName === "line") {
          const x1 = parseFloat(properties.x1 || "0") * transform.scale + transform.x;
          const y1 = parseFloat(properties.y1 || "0") * transform.scale + transform.y;
          const x2 = parseFloat(properties.x2 || "0") * transform.scale + transform.x;
          const y2 = parseFloat(properties.y2 || "0") * transform.scale + transform.y;

          dxfLines.push("0");
          dxfLines.push("LINE");
          dxfLines.push("8");
          dxfLines.push("0");
          dxfLines.push("10");
          dxfLines.push(x1.toString());
          dxfLines.push("20");
          dxfLines.push(y1.toString());
          dxfLines.push("11");
          dxfLines.push(x2.toString());
          dxfLines.push("21");
          dxfLines.push(y2.toString());
        }

        // Handle SVG circle elements
        if (tagName === "circle") {
          const cx = parseFloat(properties.cx || "0") * transform.scale + transform.x;
          const cy = parseFloat(properties.cy || "0") * transform.scale + transform.y;
          const r = parseFloat(properties.r || "0") * transform.scale;

          dxfLines.push("0");
          dxfLines.push("CIRCLE");
          dxfLines.push("8");
          dxfLines.push("0");
          dxfLines.push("10");
          dxfLines.push(cx.toString());
          dxfLines.push("20");
          dxfLines.push(cy.toString());
          dxfLines.push("30");
          dxfLines.push("0.0");
          dxfLines.push("40");
          dxfLines.push(r.toString());
        }

        // Handle SVG rect elements
        if (tagName === "rect") {
          const x = parseFloat(properties.x || "0") * transform.scale + transform.x;
          const y = parseFloat(properties.y || "0") * transform.scale + transform.y;
          const width = parseFloat(properties.width || "0") * transform.scale;
          const height = parseFloat(properties.height || "0") * transform.scale;

          // Convert rectangle to 4 lines
          const points = [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
            [x, y], // Close the rectangle
          ];

          for (let i = 0; i < points.length - 1; i++) {
            dxfLines.push("0");
            dxfLines.push("LINE");
            dxfLines.push("8");
            dxfLines.push("0");
            dxfLines.push("10");
            dxfLines.push(points[i][0].toString());
            dxfLines.push("20");
            dxfLines.push(points[i][1].toString());
            dxfLines.push("11");
            dxfLines.push(points[i + 1][0].toString());
            dxfLines.push("21");
            dxfLines.push(points[i + 1][1].toString());
          }
        }

        // Process children
        if (node.children) {
          for (const child of node.children) {
            processNode(child, transform);
          }
        }
      }
    }

    // Parse SVG path data (simplified - handles M, L, Z commands)
    function parseSvgPath(pathData: string): any[] {
      const commands: any[] = [];
      const regex = /([MLZ])\s*([^MLZ]*)/gi;
      let match;
      let lastX = 0;
      let lastY = 0;

      while ((match = regex.exec(pathData)) !== null) {
        const cmd = match[1].toUpperCase();
        const coords = match[2]
          .trim()
          .split(/[\s,]+/)
          .filter((s) => s)
          .map(parseFloat);

        if (cmd === "M" && coords.length >= 2) {
          lastX = coords[0];
          lastY = coords[1];
        } else if (cmd === "L" && coords.length >= 2) {
          commands.push({
            type: "L",
            x: lastX,
            y: lastY,
            x2: coords[0],
            y2: coords[1],
          });
          lastX = coords[0];
          lastY = coords[1];
        } else if (cmd === "Z") {
          // Close path - would need to connect to start point
        }
      }

      return commands;
    }

    // Process the SVG document
    if (svgDoc.children) {
      for (const child of svgDoc.children) {
        processNode(child);
      }
    }

    // End Entities section
    dxfLines.push("0");
    dxfLines.push("ENDSEC");

    // End of file
    dxfLines.push("0");
    dxfLines.push("EOF");

    return dxfLines.join("\n");
  } catch (error) {
    throw new Error(`Failed to convert SVG to DXF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Purge Imgix cache
async function purgeImgixCache(url: string): Promise<void> {
  const apiKey = process.env.IMGIX_API_KEY;
  if (!apiKey) {
    throw new Error("IMGIX_API_KEY is not configured");
  }
  
  // Debug: Log first few characters of key (don't log full key for security)
  console.log(`Imgix API Key present: ${apiKey ? 'Yes' : 'No'}, Length: ${apiKey?.length || 0}, Starts with: ${apiKey?.substring(0, 5) || 'N/A'}...`);

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

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Imgix purge failed: ${response.statusText}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // If it's a 409 (duplicate purge), that's okay - it means it was already purged
      if (error.response?.status === 409) {
        console.log(`Cache already purged for ${url}`);
        return;
      }
      throw new Error(`Imgix purge error: ${error.message}`);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const barcodeUrl = formData.get("barcodeUrl") as string;
    const previewUrl = formData.get("previewUrl") as string;
    const svgUrl = formData.get("svgUrl") as string;
    const dxfUrl = formData.get("dxfUrl") as string | null;

    const imageFile = formData.get("imageFile") as File | null;
    const svgFile = formData.get("svgFile") as File | null;
    const dxfFile = formData.get("dxfFile") as File | null;

    if (!imageFile && !svgFile && !dxfFile) {
      return NextResponse.json(
        { error: "At least one file must be provided" },
        { status: 400 }
      );
    }

    const results: string[] = [];
    const errors: string[] = [];

    // Process image file
    if (imageFile && previewUrl) {
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const wasabiKey = extractWasabiKey(previewUrl);
        const contentType = imageFile.type || "image/png";

        console.log(`Uploading image to Wasabi - Key: ${wasabiKey}, Bucket: ${process.env.WASABI_BUCKET_NAME}, Region: ${process.env.WASABI_REGION}`);
        await uploadToWasabi(buffer, wasabiKey, contentType);
        console.log(`Successfully uploaded image to Wasabi: ${wasabiKey}`);
        results.push(`Image replaced: ${previewUrl}`);
        
        // Only purge Imgix cache if it's an Imgix URL
        if (previewUrl.includes('imgix.net')) {
          try {
            await purgeImgixCache(previewUrl);
            results.push(`Cache purged: ${previewUrl}`);
          } catch (purgeError) {
            const purgeErrorMsg = `Cache purge failed (image was still replaced): ${purgeError instanceof Error ? purgeError.message : "Unknown error"}`;
            errors.push(purgeErrorMsg);
            console.error(purgeErrorMsg);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to replace image: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
    }

    // Process SVG file
    if (svgFile && svgUrl) {
      try {
        const arrayBuffer = await svgFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const wasabiKey = extractWasabiKey(svgUrl);
        const contentType = "image/svg+xml";

        await uploadToWasabi(buffer, wasabiKey, contentType);
        results.push(`SVG replaced: ${svgUrl}`);
        
        // Only purge Imgix cache if it's an Imgix URL
        if (svgUrl.includes('imgix.net')) {
          try {
            await purgeImgixCache(svgUrl);
            results.push(`Cache purged: ${svgUrl}`);
          } catch (purgeError) {
            const purgeErrorMsg = `Cache purge failed (SVG was still replaced): ${purgeError instanceof Error ? purgeError.message : "Unknown error"}`;
            errors.push(purgeErrorMsg);
            console.error(purgeErrorMsg);
          }
        }

        // Determine DXF URL - use provided dxfUrl or construct from svgUrl
        let targetDxfUrl = dxfUrl;
        if (!targetDxfUrl) {
          // Construct DXF URL by replacing /art.svg with /art.dxf
          targetDxfUrl = svgUrl.replace(/\/art\.svg$/i, "/art.dxf");
        }

        // If DXF URL exists (provided or constructed) and no DXF file was uploaded, auto-generate DXF from SVG
        if (targetDxfUrl && !dxfFile) {
          try {
            const svgText = buffer.toString("utf-8");
            const dxfContent = convertSvgToDxf(svgText);
            const dxfBuffer = Buffer.from(dxfContent, "utf-8");
            const dxfWasabiKey = extractWasabiKey(targetDxfUrl);

            await uploadToWasabi(dxfBuffer, dxfWasabiKey, "application/dxf");
            results.push(`DXF auto-generated from SVG: ${targetDxfUrl}`);
            
            // Only purge Imgix cache if it's an Imgix URL
            if (targetDxfUrl.includes('imgix.net')) {
              try {
                await purgeImgixCache(targetDxfUrl);
                results.push(`Cache purged: ${targetDxfUrl}`);
              } catch (purgeError) {
                const purgeErrorMsg = `Cache purge failed (DXF was still generated): ${purgeError instanceof Error ? purgeError.message : "Unknown error"}`;
                errors.push(purgeErrorMsg);
                console.error(purgeErrorMsg);
              }
            }
          } catch (error) {
            const errorMsg = `Failed to auto-generate DXF from SVG: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            console.error(errorMsg, error);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to replace SVG: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Process DXF file
    if (dxfFile) {
      try {
        // Determine DXF URL - use provided dxfUrl or construct from svgUrl
        let targetDxfUrl = dxfUrl;
        if (!targetDxfUrl && svgUrl) {
          // Construct DXF URL by replacing /art.svg with /art.dxf
          targetDxfUrl = svgUrl.replace(/\/art\.svg$/i, "/art.dxf");
        }

        if (!targetDxfUrl) {
          throw new Error("Cannot determine DXF location - SVG URL is required");
        }

        const arrayBuffer = await dxfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const wasabiKey = extractWasabiKey(targetDxfUrl);
        const contentType = "application/dxf";

        await uploadToWasabi(buffer, wasabiKey, contentType);
        results.push(`DXF replaced: ${targetDxfUrl}`);
        
        // Only purge Imgix cache if it's an Imgix URL
        if (targetDxfUrl.includes('imgix.net')) {
          try {
            await purgeImgixCache(targetDxfUrl);
            results.push(`Cache purged: ${targetDxfUrl}`);
          } catch (purgeError) {
            const purgeErrorMsg = `Cache purge failed (DXF was still replaced): ${purgeError instanceof Error ? purgeError.message : "Unknown error"}`;
            errors.push(purgeErrorMsg);
            console.error(purgeErrorMsg);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to replace DXF: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Only fail if all operations failed (no successful uploads)
    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json(
        { error: "All operations failed", details: errors },
        { status: 500 }
      );
    }

    // If we have results, it's a success (even if some purges failed)
    return NextResponse.json({
      success: true,
      message: results.length > 0 ? "Files processed successfully" : "No files processed",
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in replace-files route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process files",
      },
      { status: 500 }
    );
  }
}

