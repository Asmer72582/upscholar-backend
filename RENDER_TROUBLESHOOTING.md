# Render Deployment Troubleshooting Guide

## Current Issue: 404 Errors on Trainer Routes

### ✅ Verified Working Locally
- ✅ `/api/trainer/students` → Returns 401 (auth required) ✓
- ✅ `/api/trainer/students/course-stats` → Returns 401 (auth required) ✓
- ✅ All routes properly registered in code
- ✅ Server starts without errors locally

### ❌ Issue on Render
- ❌ Same routes returning 404 on production
- This indicates the deployment hasn't picked up the latest code

---

## Immediate Actions Required

### 1. Check Render Deployment Status

Go to: https://dashboard.render.com/

1. **Select your `upscholar-backend` service**
2. **Check the "Events" tab** - Look for:
   - ✅ "Deploy succeeded" (green)
   - ❌ "Deploy failed" (red)
   - ⏳ "Deploy in progress" (yellow)

3. **Check the "Logs" tab** - Look for:
   - Server startup messages
   - Any error messages
   - Port binding confirmation

### 2. Manual Deployment Trigger

If auto-deploy didn't work:

1. Go to your service in Render dashboard
2. Click **"Manual Deploy"** button (top right)
3. Select **"Deploy latest commit"**
4. Wait 2-5 minutes for deployment to complete

### 3. Verify Environment Variables

Go to **Environment** tab and ensure these are set:

```
NODE_ENV=production
PORT=3000
MONGO_URI=<your_mongodb_uri>
JWT_SECRET=<your_jwt_secret>
FRONTEND_URL=https://upscholar-ui-kit.vercel.app
EMAIL_USER=<your_email>
EMAIL_PASS=<your_email_password>
RAZORPAY_KEY_ID=<your_key>
RAZORPAY_KEY_SECRET=<your_secret>
```

**After changing environment variables, you MUST redeploy!**

---

## Verification Steps

### Option 1: Use the Verification Script

```bash
cd /Users/asmerchougle/Documents/upwork/upscholar-backend
./verify-render-deployment.sh
```

### Option 2: Manual Testing

```bash
# Test health endpoint (should return 200)
curl -I https://upscholar-backend.onrender.com/health

# Test trainer students (should return 401, NOT 404)
curl -I https://upscholar-backend.onrender.com/api/trainer/students

# Test course stats (should return 401, NOT 404)
curl -I https://upscholar-backend.onrender.com/api/trainer/students/course-stats
```

**Expected Results:**
- ✅ 200 = Public endpoint working
- ✅ 401 = Protected endpoint exists (needs auth)
- ❌ 404 = Endpoint not found (deployment issue)
- ❌ 500 = Server error (check logs)

---

## Common Issues & Solutions

### Issue 1: Deployment Stuck or Failed

**Symptoms:** Render shows "Deploy in progress" for >10 minutes

**Solutions:**
1. Cancel the deployment
2. Check build logs for errors
3. Verify `package.json` has correct start script: `"start": "node src/server.js"`
4. Try manual deploy again

### Issue 2: Server Crashes on Startup

**Symptoms:** Logs show server starting then immediately stopping

**Solutions:**
1. Check Render logs for error messages
2. Common causes:
   - Missing environment variables
   - MongoDB connection failure
   - Port binding issues
3. Verify MongoDB Atlas allows Render's IP (0.0.0.0/0 for testing)

### Issue 3: Routes Return 404 After Successful Deploy

**Symptoms:** Health check works, but API routes return 404

**Solutions:**
1. Check if Express is properly loading routes
2. Look for this in logs: `Server running on port 3000`
3. Verify `src/routes/index.js` exports router correctly
4. Check for path-to-regexp errors in logs

### Issue 4: Auto-Deploy Not Triggering

**Symptoms:** Pushed to GitHub but Render doesn't deploy

**Solutions:**
1. Check Render dashboard → Settings → Build & Deploy
2. Verify "Auto-Deploy" is enabled
3. Check branch name matches (should be `main`)
4. Verify GitHub connection is active
5. Use manual deploy as workaround

---

## Debugging Checklist

- [ ] Render deployment shows "Deploy succeeded"
- [ ] Render logs show "Server running on port 3000"
- [ ] Render logs show "MongoDB connected successfully"
- [ ] No error messages in Render logs
- [ ] Health endpoint returns 200
- [ ] Environment variables are set correctly
- [ ] MongoDB Atlas allows Render's IP address
- [ ] Latest commit is deployed (check commit hash in Render)

---

## Latest Code Changes (Deployed)

**Commit:** `e95ba48` - "Trigger Render deployment - Routes verified working locally"

**Changes:**
1. Fixed path-to-regexp errors in `wallet.js`
2. Removed Express 5 incompatible wildcard route in `server.js`
3. All routes verified working locally
4. Trainer routes confirmed present in code:
   - `/api/trainer/students`
   - `/api/trainer/students/course-stats`

---

## If Nothing Works

### Nuclear Option: Fresh Deployment

1. **In Render Dashboard:**
   - Go to Settings → Danger Zone
   - Click "Suspend Service"
   - Wait 30 seconds
   - Click "Resume Service"

2. **Or create new service:**
   - Create new Web Service
   - Connect same GitHub repo
   - Set all environment variables
   - Deploy

### Contact Support

If issue persists after trying all above:

1. **Render Support:** https://render.com/docs/support
2. **Check Render Status:** https://status.render.com/
3. **Provide:**
   - Service name
   - Deployment logs
   - Error messages
   - Steps already tried

---

## Success Indicators

You'll know it's working when:

✅ Verification script shows all green checkmarks
✅ Frontend can make authenticated requests successfully
✅ Render logs show no errors
✅ All API endpoints return expected status codes (200/401, not 404)

---

## Quick Reference Commands

```bash
# Run verification script
./verify-render-deployment.sh

# Check specific endpoint
curl -I https://upscholar-backend.onrender.com/api/trainer/students

# View full response
curl https://upscholar-backend.onrender.com/health

# Test with auth (replace TOKEN)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://upscholar-backend.onrender.com/api/trainer/students
```
