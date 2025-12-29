#!/bin/bash
# 🚀 UpScholar Backend Deployment Script for EC2
# Domain: api.upscholar.in

set -e  # Exit on error

echo "🚀 UpScholar Backend Deployment Script"
echo "====================================="
echo "Domain: api.upscholar.in"
echo ""

# Configuration
APP_NAME="upscholar-backend"
DOMAIN="api.upscholar.in"
PORT=3000

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on EC2
if [ ! -f /sys/hypervisor/uuid ] && [ ! -d /sys/firmware/efi ]; then
    echo -e "${YELLOW}⚠️  Warning: This script is designed for EC2. Continuing anyway...${NC}"
fi

# Step 1: Update system
echo -e "${GREEN}📦 Step 1: Updating system packages...${NC}"
sudo yum update -y

# Step 2: Check Node.js
echo -e "${GREEN}📦 Step 2: Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo "Installing Node.js via NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
    nvm alias default 18
else
    echo "Node.js is already installed: $(node --version)"
fi

# Step 3: Install PM2 if not installed
echo -e "${GREEN}📦 Step 3: Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
else
    echo "PM2 is already installed: $(pm2 --version)"
fi

# Step 4: Navigate to project directory
echo -e "${GREEN}📁 Step 4: Navigating to project directory...${NC}"
if [ -d "$HOME/upwork/server" ]; then
    cd "$HOME/upwork/server"
    echo "Found project at: $(pwd)"
elif [ -d "$HOME/server" ]; then
    cd "$HOME/server"
    echo "Found project at: $(pwd)"
else
    echo -e "${RED}❌ Error: Project directory not found!${NC}"
    echo "Please ensure the server code is in ~/upwork/server or ~/server"
    exit 1
fi

# Step 5: Install dependencies
echo -e "${GREEN}📦 Step 5: Installing dependencies...${NC}"
npm install --production

# Step 6: Check .env file
echo -e "${GREEN}🔧 Step 6: Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating template...${NC}"
    cat > .env << EOF
NODE_ENV=production
PORT=${PORT}

# URLs
FRONTEND_URL=https://upscholar.in
API_BASE_URL=https://api.upscholar.in

# Database
MONGODB_URI=your-mongodb-connection-string

# JWT
JWT_SECRET=your-secure-jwt-secret-key-change-this

# CORS
CORS_ORIGIN=https://upscholar.in

# Razorpay
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret

# GetStream.io
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your actual values!${NC}"
    echo "Press Enter to continue after updating .env..."
    read
else
    echo "✅ .env file exists"
fi

# Step 7: Stop existing PM2 process
echo -e "${GREEN}🛑 Step 7: Stopping existing application...${NC}"
pm2 stop ${APP_NAME} 2>/dev/null || true
pm2 delete ${APP_NAME} 2>/dev/null || true

# Step 8: Start application with PM2
echo -e "${GREEN}🚀 Step 8: Starting application with PM2...${NC}"
pm2 start src/server.js --name ${APP_NAME} --update-env

# Step 9: Setup PM2 startup script
echo -e "${GREEN}⚙️  Step 9: Configuring PM2 startup...${NC}"
pm2 startup systemd -u $(whoami) --hp $HOME | grep -v "PM2" | sudo bash || true
pm2 save

# Step 10: Check Nginx
echo -e "${GREEN}🌐 Step 10: Checking Nginx configuration...${NC}"
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo amazon-linux-extras install nginx1 -y
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# Step 11: Configure Nginx
echo -e "${GREEN}🌐 Step 11: Configuring Nginx for ${DOMAIN}...${NC}"
sudo tee /etc/nginx/conf.d/${APP_NAME}.conf > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Step 12: Test and reload Nginx
echo -e "${GREEN}🌐 Step 12: Testing Nginx configuration...${NC}"
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ Nginx configuration is valid and reloaded"
else
    echo -e "${RED}❌ Nginx configuration test failed!${NC}"
    exit 1
fi

# Step 13: SSL Certificate (if not already configured)
echo -e "${GREEN}🔒 Step 13: Checking SSL certificate...${NC}"
if [ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    echo -e "${YELLOW}⚠️  SSL certificate not found.${NC}"
    echo "To install SSL certificate, run:"
    echo "  sudo certbot --nginx -d ${DOMAIN}"
    echo ""
    read -p "Do you want to install SSL certificate now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! command -v certbot &> /dev/null; then
            echo "Installing Certbot..."
            sudo yum install -y certbot python3-certbot-nginx
        fi
        sudo certbot --nginx -d ${DOMAIN}
    fi
else
    echo "✅ SSL certificate found"
fi

# Step 14: Verify deployment
echo -e "${GREEN}✅ Step 14: Verifying deployment...${NC}"
sleep 3

# Check PM2 status
echo ""
echo "📊 PM2 Status:"
pm2 status

# Check if app is running
if pm2 list | grep -q "${APP_NAME}.*online"; then
    echo -e "${GREEN}✅ Application is running!${NC}"
else
    echo -e "${RED}❌ Application failed to start. Check logs:${NC}"
    pm2 logs ${APP_NAME} --lines 20
    exit 1
fi

# Test API endpoint
echo ""
echo "🧪 Testing API endpoint..."
if curl -f -s http://localhost:${PORT}/api/health > /dev/null; then
    echo -e "${GREEN}✅ API is responding on port ${PORT}${NC}"
else
    echo -e "${YELLOW}⚠️  API health check failed (might be normal if /api/health doesn't exist)${NC}"
fi

# Final summary
echo ""
echo "====================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "====================================="
echo ""
echo "📋 Summary:"
echo "  - Application: ${APP_NAME}"
echo "  - Domain: ${DOMAIN}"
echo "  - Port: ${PORT}"
echo "  - PM2: $(pm2 list | grep ${APP_NAME} | awk '{print $10}')"
echo ""
echo "🔧 Useful Commands:"
echo "  - View logs: pm2 logs ${APP_NAME}"
echo "  - Restart: pm2 restart ${APP_NAME}"
echo "  - Status: pm2 status"
echo "  - Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo "🌐 Next Steps:"
echo "  1. Ensure DNS A record points ${DOMAIN} to this server's IP"
echo "  2. If SSL not installed, run: sudo certbot --nginx -d ${DOMAIN}"
echo "  3. Test API: curl https://${DOMAIN}/api/health"
echo "  4. Monitor logs: pm2 logs ${APP_NAME}"
echo ""
echo "🚀 Your backend is ready at https://${DOMAIN}"
