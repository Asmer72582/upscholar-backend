# 🔒 SSL Solution for UpScholar Mixed Content Error

## Problem Summary
The frontend at `https://upscholar.in` cannot connect to the backend at `http://13.60.254.183:3000` due to **Mixed Content** error - HTTPS pages cannot load HTTP resources.

## ✅ Immediate Solution

### 1. Quick Fix (Temporary)
For development/testing, you can:

1. **Access frontend via HTTP instead of HTTPS:**
   ```
   http://upscholar.in  (instead of https://upscholar.in)
   ```

2. **Or use browser flags** (not recommended for production):
   - Chrome: `--allow-running-insecure-content`
   - Firefox: Set `security.mixed_content.block_active_content` to false

### 2. Proper Solution (Recommended)

#### Option A: Set up SSL with Let's Encrypt (Free)

1. **Get a domain/subdomain** that points to your EC2 instance:
   ```
   api.upscholar.in → 13.60.254.183
   ```

2. **Run the SSL setup script** on your EC2 instance:
   ```bash
   # SSH into your EC2 instance
   ssh ubuntu@13.60.254.183
   
   # Run the SSL setup script
   sudo ./setup-ssl.sh api.upscholar.in
   ```

3. **Update frontend configuration** to use HTTPS:
   ```bash
   # Update .env files
   VITE_API_BASE_URL=https://api.upscholar.in
   VITE_SOCKET_URL=https://api.upscholar.in
   ```

#### Option B: Use AWS Certificate Manager + Load Balancer

1. **Create an Application Load Balancer**
2. **Add SSL certificate** from AWS Certificate Manager
3. **Point load balancer** to your EC2 instance
4. **Update DNS** to point to the load balancer

#### Option C: Use CloudFlare (Free SSL Proxy)

1. **Set up CloudFlare** for your domain
2. **Enable SSL/TLS** encryption mode
3. **Update frontend** to use the CloudFlare-proxied domain

## 🚀 Quick Start (Recommended Path)

### Step 1: Set up DNS
Update your DNS to point a subdomain to your EC2:
```
Type: A Record
Name: api.upscholar.in
Value: 13.60.254.183
TTL: 300
```

### Step 2: Set up SSL on EC2
```bash
# On your EC2 instance
cd /path/to/upscholar-backend
sudo ./setup-ssl.sh api.upscholar.in
```

### Step 3: Update Frontend
```bash
# Update environment files
sed -i 's|http://13.60.254.183:3000|https://api.upscholar.in|g' .env*
git add .env*
git commit -m "Update API URLs to HTTPS"
git push
```

### Step 4: Test
```bash
# Test the HTTPS endpoint
curl https://api.upscholar.in/health

# Test CORS
curl -H "Origin: https://upscholar.in" https://api.upscholar.in/health
```

## 📋 Current Status

✅ **Completed:**
- CORS configuration updated to include `https://upscholar.in`
- Backend nginx configuration with dynamic CORS
- SSL setup script created
- Frontend environment files updated (reverted to HTTP for now)

🔧 **Next Steps:**
1. Set up DNS for `api.upscholar.in` → `13.60.254.183`
2. Run SSL setup script on EC2
3. Update frontend to use HTTPS URLs
4. Test secure connections

## 🛠️ Files Created

1. **`/Users/asmerchougle/Documents/upwork/upscholar-backend/setup-ssl.sh`** - SSL setup script
2. **`/Users/asmerchougle/Documents/upwork/upscholar-backend/SSL_SETUP_GUIDE.md`** - Detailed setup guide
3. **Updated environment files** - Ready for HTTPS configuration

## 🔍 Troubleshooting

### SSL Certificate Issues
- Ensure domain points to correct IP
- Check firewall rules (port 80/443 open)
- Verify nginx is running: `sudo systemctl status nginx`

### Mixed Content Still Occurs
- Clear browser cache
- Check browser developer console for specific errors
- Verify all API calls use HTTPS

### DNS Propagation
- Check DNS: `nslookup api.upscholar.in`
- Wait for propagation (up to 24 hours)
- Use lower TTL for faster updates

## 📞 Support

If you encounter issues:
1. Check the SSL setup logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`
2. Test nginx configuration: `sudo nginx -t`
3. Check certificate status: `sudo certbot certificates`
4. Verify backend health: `curl https://api.upscholar.in/health`