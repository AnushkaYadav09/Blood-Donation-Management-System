# 🚨 QUICK FIX - Do This NOW

## ✅ Code Changes (Already Done)
1. ✅ Added your Vercel URL to CORS whitelist
2. ✅ Added `VITE_API_URL` to frontend `.env`

## 🎯 YOU NEED TO DO (5 Minutes)

### Step 1: Vercel Environment Variables
1. Go to: https://vercel.com/dashboard
2. Select your project: `blood-donation-management-system`
3. Click **Settings** → **Environment Variables**
4. Add these TWO variables:

```
Name: VITE_API_URL
Value: https://blood-donation-management-system-52s3.onrender.com

Name: VITE_GOOGLE_CLIENT_ID  
Value: <your-google-client-id>.apps.googleusercontent.com
```

**Note**: Use your actual Google Client ID from Google Cloud Console.

5. Click **Save**
6. Go to **Deployments** tab
7. Click **⋯** (three dots) on latest deployment → **Redeploy**

---

### Step 2: Render Environment Variables
1. Go to: https://dashboard.render.com
2. Select: `blood-donation-management-system-52s3`
3. Click **Environment** tab
4. Find `FRONTEND_URL` and change to:
```
https://blood-donation-management-system.vercel.app
```
5. Click **Save Changes**
6. Render will auto-redeploy

---

### Step 3: MongoDB Atlas (If using)
1. Go to: https://cloud.mongodb.com
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Select **Allow Access from Anywhere** (`0.0.0.0/0`)
5. Click **Confirm**

---

### Step 4: Push Code Changes
```bash
git add .
git commit -m "fix: add Vercel URL to CORS and configure production API"
git push origin main
```

Both Render and Vercel will auto-deploy.

---

## 🧪 Test (2 Minutes)

### Test 1: Backend Health
Open in browser:
```
https://blood-donation-management-system-52s3.onrender.com/api/health
```

Should see: `{"status":"ok","timestamp":"..."}`

### Test 2: Frontend
1. Open: https://blood-donation-management-system.vercel.app
2. Press **F12** (open console)
3. Look for errors:
   - ❌ Should NOT see: "CORS error"
   - ❌ Should NOT see: "Failed to fetch"
   - ✅ Should see: API calls to Render URL

### Test 3: Try Login/Register
If you can register/login → **IT WORKS!** 🎉

---

## 🐛 Still Not Working?

### Check Render Logs
1. Render Dashboard → Your Service → **Logs** tab
2. Look for:
   - ✅ "Server running on port XXXX"
   - ✅ "Database connected successfully"
   - ❌ Any error messages

### Check Vercel Logs  
1. Vercel Dashboard → **Deployments**
2. Click latest deployment → **Logs** tab
3. Look for build errors

### Check Browser Console
1. Open your Vercel site
2. Press **F12**
3. Go to **Console** tab
4. Look for red error messages

---

## 📊 What We Fixed

| Issue | Before | After |
|-------|--------|-------|
| **CORS** | Only old Vercel URL | ✅ Added new Vercel URL |
| **Frontend API** | Missing env var | ✅ Added `VITE_API_URL` |
| **Backend Port** | ✅ Already correct | ✅ Uses `process.env.PORT` |
| **Database** | May timeout | ✅ Check MongoDB whitelist |

---

## 💡 Why It Was Failing

1. **CORS Block**: Backend didn't recognize your new Vercel URL
2. **Missing Env Var**: Frontend didn't know where backend is deployed
3. **Database**: MongoDB might be blocking Render's IP

All fixed now! Just need to update Vercel/Render dashboards.
