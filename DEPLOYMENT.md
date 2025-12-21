# 🚀 Production Deployment Guide

## 📋 Prerequisites
- AWS Account with EC2 access
- Domain name (api.upscholar.in)
- GitHub account
- Basic knowledge of Linux commands

## 🏗️ Architecture Overview
```
Internet → Nginx (Port 80/443) → Node.js (Port 3000)
                    ↓
              Let's Encrypt SSL
```

## 🔧 Server Configuration
- **OS**: Amazon Linux 2
- **Web Server**: Nginx
- **Process Manager**: PM2
- **SSL**: Let's Encrypt (Certbot)
- **Node Version**: 18.x LTS

## 🚀 Deployment Steps

### 1. Initial Setup
```bash
# Connect to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Update system
sudo yum update -y
```

### 2. Install Node.js (using NVM)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18
```

### 3. Install Dependencies
```bash
# Install git
sudo yum install git -y

# Install PM2 globally
npm install -g pm2

# Install nginx
sudo amazon-linux-extras install nginx1 -y
```

### 4. Clone Repository
```bash
cd /home/ec2-user
git clone https://github.com/your-username/upscholar-backend.git
cd upscholar-backend
npm install
```

### 5. Configure Environment
```bash
# Create production environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.upscholar.in
FRONTEND_URL=https://upscholar.in
DATABASE_URL=your-production-db-url
JWT_SECRET=your-strong-jwt-secret
EOF
```

### 6. Start Application with PM2
```bash
# Start with PM2
pm2 start src/server.js --name "upscholar-backend"
pm2 startup
pm2 save
```

### 7. Configure Nginx
```bash
sudo nano /etc/nginx/conf.d/upscholar-api.conf
```

Add configuration (see nginx-config.conf)

### 8. Install SSL Certificate
```bash
# Install certbot
sudo yum install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.upscholar.in

# Test auto-renewal
sudo certbot renew --dry-run
```

### 9. Restart Services
```bash
sudo systemctl restart nginx
pm2 restart upscholar-backend
```

## 🔍 Verification
- **Health Check**: https://api.upscholar.in/health
- **SSL Test**: https://www.ssllabs.com/ssltest/
- **Redirect Test**: http://api.upscholar.in (should redirect to HTTPS)

## 🚨 Troubleshooting

### Redirect Loops
- Check Nginx configuration for duplicate redirects
- Ensure Node.js app doesn't have HTTPS redirects
- Verify X-Forwarded-Proto header is set

### SSL Issues
- Check certificate expiration: `sudo certbot certificates`
- Verify Nginx SSL configuration
- Ensure firewall allows port 443

### PM2 Issues
- Check logs: `pm2 logs upscholar-backend`
- Monitor status: `pm2 status`
- Restart if needed: `pm2 restart upscholar-backend`

## 📊 Monitoring
```bash
# PM2 monitoring
pm2 monit

# Nginx status
sudo systemctl status nginx

# System logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 🔄 Auto-renewal Setup
```bash
# Add to crontab
crontab -e

# Add this line for weekly renewal check
0 2 * * 1 /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx
```

## 📞 Support
For issues:
1. Check logs first
2. Verify configuration files
3. Test each component separately
4. Contact AWS support for EC2 issues
5. Use Let's Encrypt community for SSL issues