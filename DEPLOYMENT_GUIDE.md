# 🚀 Deployment Configuration Guide

## ✅ Current Status
- **Backend**: Running on Render at `https://blood-donation-management-system-52s3.onrender.com`
- **Frontend**: Deployed on Vercel at `https://blood-donation-management-system.vercel.app`

## 🔧 FIXES APPLIED

### 1. ✅ Backend Port Configuration
**File**: `backend/src/server.ts`
- Already correctly using: `const PORT = process.env.PORT || 3001;`
- ✅ This allows Render to assign its own port

### 2. ✅ CORS Configuration
**File**: `backend/src/app.ts`
- Added your Vercel URL to allowed origins
- Now accepts requests from:
  - `http://localhost:3000` (development)
  - `https://blood-donation-ecru-chi.vercel.app` (old deployment)
  - `https://blood-donation-management-system.vercel.app` (current deployment)

### 3. ✅ Frontend API Configuration
**File**: `frontend/src/api.ts`
- Already correctly configured to use `VITE_API_URL` environment variable
- Falls back to Render URL in production

### 4. ✅ Frontend Environment Variables
**File**: `frontend/.env`
- Added: `VITE_API_URL=https://blood-donation-management-system-52s3.onrender.com`

---

## 🎯 REQUIRED ACTIONS

### A. Vercel Environment Variables
Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:

```
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
VITE_API_URL=https://blood-donation-management-system-52s3.onrender.com
```

**Note**: Use your actual Google Client ID from the Google Cloud Console.

**Important**: After adding, click **"Redeploy"** to apply changes.

---

### B. Render Environment Variables
Go to: **Render Dashboard → blood-donation-management-system-52s3 → Environment**

Verify/Update these variables:

```bash
# Database (should be auto-configured by Render)
DATABASE_URL=<your-render-postgres-url>
MONGODB_URL=<your-mongodb-atlas-url>

# JWT Configuration
JWT_SECRET=<generate-secure-random-string>
JWT_EXPIRES_IN=30m

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your-email@gmail.com>
EMAIL_PASS=<your-gmail-app-password>

# Twilio (Optional - for SMS)
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
TWILIO_PHONE_NUMBER=<your-twilio-number>

# Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Frontend URL (for CORS)
FRONTEND_URL=https://blood-donation-management-system.vercel.app

# Port (Render will override this)
PORT=3001
```

---

### C. MongoDB Atlas Configuration
If using MongoDB Atlas:

1. Go to: **MongoDB Atlas → Network Access**
2. Click **"Add IP Address"**
3. Add: `0.0.0.0/0` (Allow from anywhere)
   - Or add Render's specific IPs for better security

4. Get your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/bloodconnect
   ```

5. Add to Render as `MONGODB_URL`

---

### D. PostgreSQL Database
Your Render logs showed database connection issues. Verify:

1. **Render Dashboard → Databases → blood-donation-db**
2. Copy the **Internal Database URL**
3. Paste it as `DATABASE_URL` in your backend environment variables

---

## 🔄 Deployment Steps

### Step 1: Deploy Backend (Render)
```bash
# Push changes to GitHub
git add .
git commit -m "fix: update CORS and deployment config"
git push origin main
```

Render will auto-deploy. Monitor at:
- **Render Dashboard → Logs**

### Step 2: Deploy Frontend (Vercel)
1. Add environment variables (see section A above)
2. Go to: **Vercel Dashboard → Deployments**
3. Click **"Redeploy"** on the latest deployment

Or push to trigger auto-deploy:
```bash
git push origin main
```

---

## 🧪 Testing After Deployment

### 1. Test Backend Health
```bash
curl https://blood-donation-management-system-52s3.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-05-01T..."}
```

### 2. Test Frontend
Visit: `https://blood-donation-management-system.vercel.app`

Open browser console (F12) and check for:
- ❌ No CORS errors
- ❌ No "Failed to fetch" errors
- ✅ API calls going to Render URL

### 3. Test API Connection
In browser console on your Vercel site:
```javascript
fetch('https://blood-donation-management-system-52s3.onrender.com/api/stats')
  .then(r => r.json())
  .then(console.log)
```

Should return stats without CORS errors.

---

## 🐛 Common Issues & Solutions

### Issue 1: "CORS Error"
**Cause**: Frontend URL not in backend's allowed origins
**Fix**: 
- Verify `FRONTEND_URL` in Render matches your Vercel URL
- Redeploy backend after changing

### Issue 2: "Failed to fetch" / Network Error
**Cause**: Wrong API URL in frontend
**Fix**:
- Verify `VITE_API_URL` in Vercel environment variables
- Must match your Render backend URL exactly
- Redeploy frontend after changing

### Issue 3: "Database connection failed"
**Cause**: MongoDB Atlas IP whitelist or wrong connection string
**Fix**:
- Add `0.0.0.0/0` to MongoDB Atlas Network Access
- Verify `MONGODB_URL` format in Render
- Check PostgreSQL `DATABASE_URL` is the Internal URL from Render

### Issue 4: "Waiting for database... (14 retries left)"
**Cause**: Database not ready or connection string wrong
**Fix**:
- For Render PostgreSQL: Use the **Internal Database URL**
- For MongoDB Atlas: Ensure network access is configured
- Check credentials in connection strings

---

## 📋 Checklist

Before marking as complete:

- [ ] Added `VITE_API_URL` to Vercel environment variables
- [ ] Added `VITE_GOOGLE_CLIENT_ID` to Vercel environment variables
- [ ] Verified `FRONTEND_URL` in Render matches Vercel URL
- [ ] Verified `DATABASE_URL` in Render (PostgreSQL)
- [ ] Verified `MONGODB_URL` in Render (MongoDB Atlas)
- [ ] Added `0.0.0.0/0` to MongoDB Atlas Network Access
- [ ] Redeployed backend on Render
- [ ] Redeployed frontend on Vercel
- [ ] Tested `/api/health` endpoint
- [ ] Tested frontend loads without CORS errors
- [ ] Tested login/registration flow

---

## 🎉 Expected Result

After completing all steps:
1. Frontend loads at: `https://blood-donation-management-system.vercel.app`
2. Backend responds at: `https://blood-donation-management-system-52s3.onrender.com/api/health`
3. No CORS errors in browser console
4. Login, registration, and all features work correctly
5. Database connections are stable

---

## 📞 Need Help?

If issues persist after following this guide:
1. Check Render logs: **Dashboard → Logs**
2. Check Vercel logs: **Dashboard → Deployments → [Latest] → Logs**
3. Check browser console (F12) for specific error messages
