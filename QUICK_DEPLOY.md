# Quick Deployment Guide

## Option 1: Manual GitHub + Render (Recommended)

### Step 1: Create GitHub Repository
1. Go to https://github.com
2. Click "New repository"
3. Name it: `hospice-scheduler`
4. Make it Public
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Push Your Code
Run these commands in your terminal:

```bash
git remote add origin https://github.com/vazaventures/hospice-scheduler.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Render
1. Go to https://render.com
2. Sign up/Login with GitHub
3. Click "New" → "Blueprint"
4. Connect your `hospice-scheduler` repository
5. Render will automatically detect the `render.yaml` file
6. Click "Apply" to deploy

Your app will be available at:
- Frontend: `https://hospice-scheduler-frontend.onrender.com`
- Backend: `https://hospice-scheduler-api.onrender.com`

## Option 2: Netlify + Railway (Alternative)

### Frontend (Netlify):
1. Build your app: `npm run build`
2. Go to https://netlify.com
3. Drag and drop the `dist` folder
4. Set environment variable: `VITE_API_URL=https://your-railway-app.railway.app/api`

### Backend (Railway):
1. Go to https://railway.app
2. Connect your GitHub repo
3. Deploy the `hospice-scheduler-api` folder
4. Copy the Railway URL and update your Netlify environment variable

## Option 3: Vercel (Frontend Only - For Demo)

If you just want to show the frontend to ChatGPT:

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts
4. Your app will be available at: `https://your-app.vercel.app`

Note: This will only deploy the frontend. You'll need to update the API URL to point to a deployed backend.

## Troubleshooting

### If Render deployment fails:
1. Check the build logs in Render dashboard
2. Make sure all dependencies are in package.json
3. Verify the render.yaml file is correct

### If API calls fail:
1. Check CORS settings in the backend
2. Verify the VITE_API_URL environment variable
3. Make sure the backend is running

### Database Connection:
Your Snowflake database should work from the deployed backend. If not, check:
1. Network access from Render to Snowflake
2. Credentials are correct
3. Snowflake account allows external connections 