# Deployment Instructions

## Option 1: Deploy to Render.com (Recommended - Free)

1. **Create a Render.com account** at https://render.com
2. **Connect your GitHub repository** to Render
3. **Deploy using the render.yaml file**:
   - Go to your Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repo
   - Render will automatically detect the `render.yaml` file and deploy both services

## Option 2: Deploy to Vercel (Frontend) + Railway (Backend)

### Frontend (Vercel):
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel` in the root directory
3. Set environment variable: `VITE_API_URL=https://your-backend-url.railway.app/api`

### Backend (Railway):
1. Go to https://railway.app
2. Connect your GitHub repo
3. Deploy the `hospice-scheduler-api` folder
4. Set environment variables for Snowflake connection

## Option 3: Deploy to Netlify (Frontend) + Heroku (Backend)

### Frontend (Netlify):
1. Build: `npm run build`
2. Deploy the `dist` folder to Netlify
3. Set environment variable: `VITE_API_URL=https://your-backend-url.herokuapp.com/api`

### Backend (Heroku):
1. Install Heroku CLI
2. Create Heroku app: `heroku create your-app-name`
3. Deploy: `git push heroku main`

## Important Notes:

1. **Environment Variables**: Make sure to set the following in your deployment platform:
   - `VITE_API_URL` (for frontend)
   - `PORT` (for backend)
   - Snowflake credentials (if needed)

2. **CORS**: The backend is configured to accept requests from any origin for deployment

3. **Database**: Your Snowflake database connection should work from the deployed backend

4. **Free Tier Limitations**: 
   - Render: Services may sleep after inactivity
   - Vercel: 100GB bandwidth/month
   - Railway: $5 credit/month
   - Netlify: 100GB bandwidth/month
   - Heroku: No free tier anymore

## Quick Deploy to Render:

1. Push your code to GitHub
2. Go to https://render.com
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render will automatically deploy both frontend and backend
6. Your app will be available at: `https://hospice-scheduler-frontend.onrender.com` 