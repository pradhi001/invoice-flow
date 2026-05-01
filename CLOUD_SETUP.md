# Invoice Flow - Cloud Setup Guide

## Quick Start - Making Your Site Fully Cloud-Ready

This guide explains how to make Invoice Flow a fully cloud-based application using Vercel and Supabase.

---

## What Has Been Configured

✅ **Backend (Vercel)**
- Serverless API functions configured
- CORS and security headers enabled
- Environment variable support

✅ **Database (Supabase)**
- Cloud PostgreSQL database
- Real-time subscriptions support
- Row-level security enabled

✅ **Frontend**
- Static assets ready for CDN
- Cloud configuration utilities
- Environment variable detection

✅ **Configuration Files**
- `.env.example` - Reference environment variables
- `.env.production` - Production configuration
- `api/config.js` - Backend configuration utilities
- `lib/cloudConfig.js` - Frontend configuration utilities
- `DEPLOYMENT.md` - Complete deployment instructions

---

## Environment Setup

### For Local Development
1. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your development values:
   ```
   SUPABASE_URL=https://your-dev-project.supabase.co
   SUPABASE_SERVICE_KEY=your-dev-service-key
   SUPABASE_ANON_KEY=your-dev-anon-key
   VITE_API_BASE_URL=http://localhost:3000
   NODE_ENV=development
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

### For Production (Vercel)
1. Set environment variables in Vercel project settings:
   - Go to Vercel dashboard
   - Select your project
   - Settings → Environment Variables
   - Add all variables from `.env.production`

2. Deploy:
   ```bash
   npm run deploy
   ```

---

## Key Configuration Files

### Backend Configuration
**File**: `api/config.js`

Provides cloud-specific utilities:
- `getApiBaseUrl()` - Returns correct API URL for environment
- `getSupabaseConfig()` - Returns database credentials
- `validateCloudEnvironment()` - Checks all required variables
- `getCorsHeaders()` - Returns CORS configuration
- `getSecurityHeaders()` - Returns security headers

Usage in handlers:
```javascript
const { getSupabaseConfig } = require('../config');
const { url, key } = getSupabaseConfig();
```

### Frontend Configuration
**File**: `lib/cloudConfig.js`

Provides frontend cloud utilities:
- Detects environment (development/staging/production)
- Gets API base URL from multiple sources
- Configures Supabase connection
- Validates cloud setup

Usage in app.js:
```javascript
const config = window.cloudConfig;
const apiConfig = config.getApiConfig();
console.log('API Base:', config.apiBase);
```

### Main API Router
**File**: `api/index.js`

- Validates cloud environment on startup
- Sets CORS headers on all requests
- Adds security headers
- Routes requests to appropriate handlers

---

## API Endpoints Available

All endpoints are accessible via `https://your-vercel-url.vercel.app/api/`:

### Data Management
- `/api/companies` - Supplier/Customer management
- `/api/products` - Product catalog
- `/api/inventory` - Inventory tracking
- `/api/invoices` - Invoice management
- `/api/purchase_orders` - Purchase order handling
- `/api/delivery_challans` - Delivery documentation
- `/api/loading_sheets` - Loading documentation
- `/api/rdcs` - RDC management

### Administration
- `/api/departments` - Department management
- `/api/team_members` - Team member management
- `/api/app_settings` - Application settings

### Utilities
- `/api/dashboard` - Dashboard data aggregation
- `/api/ping` - Health check endpoint

---

## Deployment Steps

### 1. Prepare Supabase
```bash
# Create Supabase project
# 1. Go to https://app.supabase.com
# 2. Create new project
# 3. Get URL and service key from Settings → API
# 4. Run schema.sql in SQL editor

# Initialize database schema:
# Copy contents of supabase/schema.sql
# Paste in Supabase SQL editor
# Execute
```

### 2. Deploy Backend
```bash
# Push to GitHub
git add .
git commit -m "Prepare for cloud deployment"
git push origin main

# Connect to Vercel
# 1. Go to https://vercel.com
# 2. Import GitHub repository
# 3. Add environment variables
# 4. Click Deploy
```

### 3. Configure Frontend
```javascript
// Update API_BASE in js/app.js (line 11)
const API_BASE = 'https://your-project.vercel.app';
```

### 4. Test Deployment
```javascript
// In browser console:
fetch('https://your-project.vercel.app/api/ping')
  .then(r => r.json())
  .then(d => console.log(d))
```

---

## Environment Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `SUPABASE_URL` | string | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | string | Yes | Database admin key |
| `SUPABASE_ANON_KEY` | string | No | Public access key |
| `VITE_API_BASE_URL` | string | No | Frontend API endpoint |
| `NODE_ENV` | string | No | Environment type (production/development) |
| `VITE_APP_NAME` | string | No | Application name |
| `VITE_APP_VERSION` | string | No | Application version |

---

## Security Best Practices

✅ **What's Implemented**
- CORS headers configured
- Security headers enabled
- Environment variables for sensitive data
- No hardcoded credentials

📋 **Additional Recommendations**
1. Enable Row-Level Security (RLS) in Supabase
2. Set up database backups
3. Use strong database passwords
4. Enable two-factor authentication on accounts
5. Monitor API usage and set rate limits
6. Implement request throttling
7. Use API keys with limited scopes

---

## Performance Optimization

### Frontend
- Static assets served from CDN
- Relative paths for cross-origin compatibility
- Configurable cache durations
- Automatic sync intervals

### Backend
- Serverless functions auto-scale
- Database connection pooling
- Query optimization potential
- Request caching options

### Database
- Indexing on frequently queried columns
- Query result caching
- Connection pooling in production

---

## Monitoring & Debugging

### View Logs
- **Vercel**: Dashboard → Function Logs
- **Supabase**: Dashboard → Database Logs
- **Browser**: DevTools → Console

### Monitor Performance
- **Vercel Analytics**: Track function execution time
- **Supabase Dashboard**: Monitor database queries
- **Browser Network Tab**: Check API response times

### Debug Issues
```javascript
// Enable debug logging (in development)
window.cloudConfig.validate();
window.cloudConfig.getEnvironmentConfig();
```

---

## Troubleshooting

### "Cannot fetch API"
- Check `API_BASE` URL is correct
- Verify Vercel deployment is active
- Check CORS headers in network tab

### "Database connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Check database is not paused
- Ensure schema is initialized

### "Application not loading"
- Check browser console for errors
- Verify static files are being served
- Check that API is responding (ping endpoint)

### "Slow performance"
- Check Vercel function duration
- Review database query performance
- Consider caching data locally

---

## Next Steps

1. ✅ Review this guide
2. ✅ Check DEPLOYMENT.md for detailed instructions
3. ✅ Set up Supabase project
4. ✅ Deploy backend to Vercel
5. ✅ Update frontend configuration
6. ✅ Test all features
7. ✅ Monitor production deployment

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **JavaScript Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

---

**Version**: 1.1.3  
**Last Updated**: April 30, 2026  
**Status**: Ready for Cloud Deployment ✅
