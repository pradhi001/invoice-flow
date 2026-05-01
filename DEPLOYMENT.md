# Invoice Flow - Cloud Deployment Guide

## Overview
This guide will help you deploy Invoice Flow to the cloud using Vercel and Supabase.

---

## Prerequisites
- GitHub account (for Vercel integration)
- Supabase account (free tier available)
- Node.js 16+ installed locally
- Git installed

---

## Step 1: Set Up Supabase (Database)

### 1.1 Create a Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Enter project details:
   - **Name**: invoice-flow-production
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your location
4. Wait for project to initialize (2-3 minutes)

### 1.2 Get Supabase Credentials
1. Go to **Settings** → **API** in your Supabase project
2. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **Service Role** key → `SUPABASE_SERVICE_KEY`
   - **Anon Public** key → `SUPABASE_ANON_KEY`

### 1.3 Create Database Schema
1. Go to **SQL Editor** in your Supabase project
2. Click **New Query**
3. Copy the content from `/supabase/schema.sql`
4. Paste into the SQL editor and click **Run**

---

## Step 2: Deploy Backend to Vercel

### 2.1 Prepare Your Repository
```bash
# Navigate to your project folder
cd "d:\New folder (pradhi)"

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"
```

### 2.2 Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository named `invoice-flow`
3. Follow the instructions to push your local code

### 2.3 Deploy to Vercel
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **Add New** → **Project**
4. Select your `invoice-flow` repository
5. Click **Import**

### 2.4 Set Environment Variables in Vercel
1. In Vercel project settings, go to **Environment Variables**
2. Add these variables:
   ```
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_KEY=<your-service-key>
   SUPABASE_ANON_KEY=<your-anon-key>
   NODE_ENV=production
   ```
3. Click **Deploy**

### 2.5 Get Your Deployment URL
- After deployment completes, copy your Vercel URL
- Example: `https://invoice-flow-xxx.vercel.app`

---

## Step 3: Update Frontend Configuration

### 3.1 Update API Base URL
1. Open `js/app.js`
2. Find line 11:
   ```javascript
   const API_BASE = 'https://invoice-flow-xxx.vercel.app';
   ```
3. Replace with your Vercel deployment URL

### 3.2 Update index.html Static Asset Paths
- Ensure all CSS and JS paths are relative:
  ```html
  <link rel="stylesheet" href="css/global.css">
  <script src="js/app.js"></script>
  ```
- ✓ All paths are already relative - no changes needed

### 3.3 Verify Supabase Configuration
1. Open `lib/lib/supabase.js`
2. Ensure environment variables are being used:
   ```javascript
   const supabaseUrl = process.env.SUPABASE_URL;
   const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
   ```
3. ✓ Already configured correctly

---

## Step 4: Deploy Frontend to Vercel (or CDN)

### Option A: Deploy with Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
vercel --prod
```

### Option B: Deploy Static Files to Vercel
The frontend files (index.html, css/, js/, etc.) will be served automatically by Vercel.

---

## Step 5: Testing Your Cloud Deployment

### 5.1 Test Backend API
1. Open your browser console
2. Run this command:
   ```javascript
   fetch('https://your-vercel-url.vercel.app/api/ping')
     .then(r => r.json())
     .then(d => console.log(d))
   ```

### 5.2 Test Frontend Connection
1. Visit your deployed URL
2. Open browser DevTools (F12)
3. Check **Network** tab - API calls should go to your Vercel backend
4. Check **Console** - look for any errors

### 5.3 Test Database Connection
1. Log in with credentials (Admin / Chellam@1)
2. Try to load data (Dashboard, Invoices, etc.)
3. Data should load from Supabase cloud database

---

## Step 6: Custom Domain (Optional)

### 6.1 Configure Domain in Vercel
1. Go to Vercel project **Settings** → **Domains**
2. Enter your custom domain
3. Follow DNS configuration instructions
4. Vercel will provide DNS records to add to your domain registrar

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Database service role key | `eyJhbGc...` |
| `SUPABASE_ANON_KEY` | Public anon key | `eyJhbGc...` |
| `NODE_ENV` | Environment type | `production` |
| `VITE_API_BASE_URL` | Frontend API endpoint | `https://your-vercel-url.vercel.app` |

---

## Troubleshooting

### CORS Errors
- Check that CORS headers are properly configured in `api/index.js`
- Verify Supabase CORS settings allow your domain
- Solution: Add your domain to Supabase **Settings** → **API** → **CORS**

### Database Connection Errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Check Supabase project is not paused
- Verify database schema exists (run `schema.sql` again)

### API Not Found (404)
- Ensure handler file exists in `api/_handlers/`
- Check URL routing in `api/index.js`
- Verify endpoint names match handler names

### Slow Performance
- Check Vercel function cold start times
- Optimize database queries in handlers
- Consider caching frequently accessed data

---

## Production Best Practices

1. **Secure Credentials**: Never commit `.env` files to Git
2. **Use `.env.example`**: Keep this file in Git for reference
3. **Monitoring**: Set up Vercel monitoring and alerts
4. **Backups**: Enable Supabase automated backups
5. **Updates**: Keep dependencies updated regularly
6. **Testing**: Test deployment in staging before production

---

## Deployment Checklist

- [ ] Supabase project created and credentials obtained
- [ ] Database schema initialized in Supabase
- [ ] GitHub repository created and code pushed
- [ ] Vercel project created and deployed
- [ ] Environment variables configured in Vercel
- [ ] API base URL updated in frontend
- [ ] Frontend tested and working
- [ ] Database connectivity verified
- [ ] Custom domain configured (if needed)
- [ ] Monitoring and alerts set up

---

## Support & Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Supabase Documentation**: https://supabase.com/docs
- **GitHub Issues**: Create an issue in your repository for problems
- **Email Support**: Contact Vercel or Supabase support for critical issues

---

## Next Steps

After deployment:
1. Monitor error logs in Vercel and Supabase dashboards
2. Set up automated backups
3. Configure CDN for static assets (optional)
4. Implement additional security measures as needed
5. Plan for scaling if traffic increases

---

**Last Updated**: April 30, 2026  
**Version**: 1.1.3
