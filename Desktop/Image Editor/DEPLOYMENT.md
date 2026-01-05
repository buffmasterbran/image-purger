# Deployment Guide - Vercel

This guide will help you deploy the Image Editor app to Vercel.

## Prerequisites

1. A GitHub account (or GitLab/Bitbucket)
2. A Vercel account (free tier works great)
3. Your environment variables ready

## Step 1: Initialize Git Repository (if not already done)

```bash
cd "C:\Users\Brandegee\Desktop\Image Editor"
git init
git add .
git commit -m "Initial commit"
```

## Step 2: Push to GitHub

1. Create a new repository on GitHub (don't initialize with README)
2. Then run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js - click "Deploy"
5. **Before deployment completes**, go to "Settings" → "Environment Variables"
6. Add these environment variables:

```
WASABI_ACCESS_KEY_ID=DQHTN0U1YD4XWRJ5F1I0
WASABI_SECRET_ACCESS_KEY=9rsvuYeagpzgCyjQtnSoqzwnULOvGhnPZeQ5tnzo
WASABI_BUCKET_NAME=pirani-customizer
WASABI_REGION=us-east-1
IMGIX_API_KEY=ak_a7fd13077c8cef7b74e17105cc8cf973c060b45de653674541f49ef54ede092e
```

7. After adding variables, go to "Deployments" tab and click the three dots on the latest deployment → "Redeploy"

### Option B: Via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Run:
```bash
vercel
```

3. Follow the prompts (it will ask for environment variables)

## Step 4: Verify Deployment

Once deployed, your app will be available at:
- `https://your-project-name.vercel.app`

## Important Notes

- **Environment Variables**: Make sure all 5 environment variables are set in Vercel
- **Automatic Deployments**: Vercel will automatically deploy when you push to your main branch
- **Preview Deployments**: Every pull request gets its own preview URL
- **Build Settings**: Vercel auto-detects Next.js, so no special configuration needed

## Troubleshooting

If the build fails:
1. Check the build logs in Vercel dashboard
2. Make sure all environment variables are set
3. Verify `npm run build` works locally first

If images don't load:
- Check that Wasabi credentials are correct
- Verify the bucket name and region match

If purge doesn't work:
- Verify IMGIX_API_KEY is set correctly
- Check the function logs in Vercel dashboard

## Alternative Platforms

If you prefer not to use Vercel:

### Netlify
- Similar process, supports Next.js
- Go to netlify.com → "Add new site" → "Import from Git"

### Railway
- Great for full-stack apps
- railway.app → "New Project" → "Deploy from GitHub"

### Render
- Simple deployment
- render.com → "New Web Service" → Connect GitHub repo

