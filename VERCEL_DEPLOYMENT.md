# 🚀 Legal CMS Backend - Vercel Deployment Guide

## 📁 Files Created/Modified

### ✅ **Modified Files:**
- `index.js` - Converted to Vercel-compatible serverless format
- `package.json` - Added Vercel scripts and Node.js engines

### ✅ **New Files:**
- `index.js.backup` - Your original Express server (for local dev)
- `vercel.json` - Vercel deployment configuration
- `.vercelignore` - Files to exclude from deployment
- `.env.example` - Environment variables template
- `start-local.sh` - Script to run local development with original setup

## 🔧 **Key Changes Made:**

### **1. Serverless Architecture**
- Routes now prefixed with `/api` (e.g., `/api/users/login`)
- Database connections handled per request (serverless-friendly)
- Added proper error handling and CORS for production

### **2. CORS Configuration**
```javascript
// Now supports multiple origins including Vercel subdomains
origin: [
  'http://localhost:3000',
  /^https:\/\/.*\.vercel\.app$/
]
```

### **3. Database Connection**
- Switched from persistent to per-request connection
- Added connection retry logic for serverless environments

## 🚀 **Deployment Steps**

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**
```bash
vercel login
```

### **Step 3: Deploy to Vercel**
```bash
cd ~/Desktop/My\ Personal\ Projects/Legal\ Case\ Management\ System/Legal_CMS_Backend
vercel
```

### **Step 4: Configure Environment Variables**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
DB_HOST=your_database_host
DB_USER=your_database_user  
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=5432
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
```

### **Step 5: Update Frontend API Base URL**
In your frontend `lib/auth.ts`, change:
```javascript
// From:
const API_BASE_URL = 'http://localhost:3001'

// To:
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-vercel-app.vercel.app/api'
  : 'http://localhost:3001/api'
```

## 🔄 **API Route Changes**

### **Before (Local Development):**
- `http://localhost:3001/users/login`
- `http://localhost:3001/cases`
- `http://localhost:3001/lawyers`

### **After (Vercel Production):**
- `https://your-app.vercel.app/api/users/login`
- `https://your-app.vercel.app/api/cases`
- `https://your-app.vercel.app/api/lawyers`

## 🧪 **Testing Locally**

### **Test New Vercel-Compatible Version:**
```bash
npm start
# Server runs on http://localhost:3001
# Routes available at http://localhost:3001/api/*
```

### **Test Original Version:**
```bash
./start-local.sh
# OR
npm run local
# Server runs on http://localhost:3001
# Routes available at http://localhost:3001/*
```

## 🔍 **Troubleshooting**

### **Database Connection Issues:**
- Make sure your database allows connections from Vercel IPs
- Consider using connection pooling services like PlanetScale or Supabase

### **CORS Issues:**
- Add your frontend domain to the CORS origins in `index.js`
- Make sure you're calling the correct API endpoints

### **Environment Variables:**
- Double-check all environment variables are set in Vercel dashboard
- Redeploy after adding new environment variables

## 📝 **Next Steps**

1. **Deploy to Vercel** using the steps above
2. **Update your frontend** to use the new API URLs
3. **Test all endpoints** in production
4. **Set up custom domain** (optional) in Vercel dashboard

## 🆘 **Need Help?**

- Check Vercel logs: `vercel logs`
- View function logs in Vercel dashboard
- Test API endpoints with tools like Postman or curl

Your backend is now ready for Vercel deployment! 🎉