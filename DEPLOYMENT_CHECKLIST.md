# Deployment Checklist for Render

## ✅ Code Fixes Applied (Completed)
- [x] Fixed `path-to-regexp` error in `wallet.js`
- [x] Removed Express 5 incompatible wildcard route in `server.js`
- [x] All routes properly registered and tested locally
- [x] Code pushed to GitHub

## 🚀 Render Deployment Steps

### 1. Check Deployment Status
- Go to [Render Dashboard](https://dashboard.render.com/)
- Select your `upscholar-backend` service
- Check if auto-deploy triggered from the latest GitHub push
- Wait for deployment to complete (usually 2-5 minutes)

### 2. Configure Environment Variables
Go to **Environment** tab and ensure these are set:

```
NODE_ENV=production
PORT=3000
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
FRONTEND_URL=https://upscholar-ui-kit.vercel.app
API_BASE_URL=https://upscholar-backend.onrender.com
API_URL=https://upscholar-backend.onrender.com/api
EMAIL_USER=<your_email>
EMAIL_PASS=<your_email_app_password>
RAZORPAY_KEY_ID=<your_razorpay_key>
RAZORPAY_KEY_SECRET=<your_razorpay_secret>
RAZORPAY_WEBHOOK_SECRET=<your_webhook_secret>
```

### 3. Verify Deployment

Test these endpoints after deployment:

#### Health Check
```bash
curl https://upscholar-backend.onrender.com/health
# Expected: {"status":"ok",...}
```

#### Payment Packages (Public)
```bash
curl https://upscholar-backend.onrender.com/api/payment/packages
# Expected: {"success":true,"packages":[...]}
```

#### Trainer Routes (Requires Auth)
```bash
curl https://upscholar-backend.onrender.com/api/trainer/students
# Expected: 401 or {"message":"No token, authorization denied"}
# (401 means route exists but needs authentication)

curl https://upscholar-backend.onrender.com/api/trainer/students/course-stats
# Expected: 401 or {"message":"No token, authorization denied"}
```

#### Admin Routes (Requires Auth)
```bash
curl https://upscholar-backend.onrender.com/api/admin/withdrawals?status=pending
# Expected: 401 or {"message":"No token, authorization denied"}
```

### 4. Common Issues & Solutions

#### Issue: Still getting 404 errors
**Solution:** 
- Check Render logs for startup errors
- Verify deployment completed successfully
- Check if service is running (not crashed)

#### Issue: 500 Internal Server Error
**Solution:**
- Check Render logs for error details
- Verify MongoDB connection string is correct
- Ensure all environment variables are set

#### Issue: CORS errors from frontend
**Solution:**
- Verify `FRONTEND_URL` is set correctly in Render environment
- Check that frontend is using correct backend URL

## 📝 Local Testing Commands

```bash
# Start server locally
npm start

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/payment/packages
curl http://localhost:3000/api/trainer/students
curl http://localhost:3000/api/trainer/students/course-stats
```

## 🔍 Monitoring

After deployment, monitor:
1. Render service logs for any errors
2. Response times for API endpoints
3. Database connection status
4. Frontend integration with backend

## 📞 Support

If issues persist after following this checklist:
1. Check Render service logs
2. Verify all environment variables
3. Test endpoints with curl/Postman
4. Check MongoDB Atlas network access settings
