# Image Editor - Barcode File Replacer

A Next.js application that allows you to replace images, SVGs, and DXF files associated with barcodes. The application uploads new files to Wasabi storage and purges the Imgix cache to ensure updated files are served immediately.

## Features

- Fetch barcode data from Shopify endpoint
- Upload and replace preview images (PNG/JPG)
- Upload and replace SVG files
- Upload and replace DXF files
- Automatically purge Imgix cache after file replacement
- Simple, intuitive UI built with Next.js and Tailwind CSS

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the root directory with the following variables:
   ```env
   WASABI_ACCESS_KEY_ID=your_wasabi_access_key_id
   WASABI_SECRET_ACCESS_KEY=your_wasabi_secret_access_key
   WASABI_BUCKET_NAME=your_wasabi_bucket_name
   WASABI_REGION=us-east-1
   IMGIX_API_KEY=your_imgix_api_key
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter the barcode URL (e.g., `https://pir-prod.pirani.life/co/251002/PD2qqdLt`)
2. Click "Fetch Data" to load the current file URLs
3. Select the files you want to replace (image, SVG, and/or DXF)
4. Click "Replace Files & Purge Cache" to upload the new files and purge the Imgix cache

## How It Works

1. **Fetch Barcode Data**: The app fetches JSON data from the barcode endpoint to get the current file URLs
2. **Extract Wasabi Keys**: The app extracts the Wasabi storage key from the Imgix URL
3. **Upload to Wasabi**: New files are uploaded to Wasabi, replacing the existing files at the same path
4. **Purge Imgix Cache**: The Imgix cache is purged for each replaced file to ensure the new version is served immediately

## Deployment

### Vercel (Recommended)

1. Push your code to a Git repository
2. Import your project in Vercel
3. Add your environment variables in Vercel's project settings
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

Make sure to set all environment variables in your deployment platform's settings.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WASABI_ACCESS_KEY_ID` | Your Wasabi access key ID | Yes |
| `WASABI_SECRET_ACCESS_KEY` | Your Wasabi secret access key | Yes |
| `WASABI_BUCKET_NAME` | Your Wasabi bucket name | Yes |
| `WASABI_REGION` | Your Wasabi region (default: us-east-1) | Yes |
| `IMGIX_API_KEY` | Your Imgix API key for cache purging | Yes |

## Notes

- Files are replaced at the same path in Wasabi, maintaining the original URLs
- Imgix cache purging may take a few seconds to propagate
- If a purge request returns a 409 status (duplicate), it's treated as successful since the cache was already purged
- At least one file must be selected for upload

