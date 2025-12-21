#!/bin/bash
# 🚀 Complete Deployment Script for EC2

echo "🚀 Complete Backend Deployment Script"
echo "====================================="
echo ""

# Configuration
GITHUB_REPO="https://github.com/your-username/upscholar-backend.git"
APP_NAME="upscholar-backend"
DOMAIN="api.upscholar.in"

# Update system
echo "📦 Step 1: Updating system..."
sudo yum update -y

# Install Node.js via NVM
echo "📦 Step 2: Installing Node.js..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
nvm alias default 18

# Install global dependencies
echo "📦 Step 3: Installing global dependencies..."
npm install -g pm2

# Install Nginx
echo "🌐 Step 4: Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Clone repository
echo "📥 Step 5: Cloning repository..."
cd ~
if [ -d "$APP_NAME" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd $APP_NAME
    git pull origin main
else
    git clone $GITHUB_REPO $APP_NAME
    cd $APP_NAME
fi

# Install dependencies
echo "📦 Step 6: Installing dependencies..."
npm install

# Create production environment
echo "🔧 Step 7: Creating production environment..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.upscholar.in
FRONTEND_URL=https://upscholar.in
DATABASE_URL=your-production-database-url
JWT_SECRET=your-secure-jwt-secret-key
CORS_ORIGIN=https://upscholar.in
EOF

# Start application with PM2
echo "🚀 Step 8: Starting application with PM2..."
pm2 start src/server.js --name "$APP_NAME"
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

# Configure Nginx
echo "🌐 Step 9: Configuring Nginx..."
sudo tee /etc/nginx/conf.d/$APP_NAME.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name api.upscholar.in;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Test Nginx configuration
sudo nginx -t

# Install Certbot
echo "🔒 Step 10: Installing Certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Reload Nginx
sudo systemctl reload nginx

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure SSL: sudo certbot --nginx -d api.upscholar.in"
echo "2. Test the application: curl http://api.upscholar.in/health"
echo "3. Monitor logs: pm2 logs $APP_NAME"
echo ""
echo "🔧 Useful commands:"
echo "- Check status: pm2 status"
echo "- View logs: pm2 logs $APP_NAME"
echo "- Restart app: pm2 restart $APP_NAME"
echo "- Check Nginx: sudo systemctl status nginx"
echo ""
echo "🚀 Your backend is ready!"