#!/bin/bash
# 🚀 Master Deployment Script - Complete Setup

echo "🚀 Master Deployment Script"
echo "==========================="
echo ""

# Configuration
GITHUB_REPO="https://github.com/your-username/upscholar-backend.git"
DOMAIN="api.upscholar.in"
EMAIL="your-email@example.com"  # Update this
APP_NAME="upscholar-backend"

echo "⚠️  IMPORTANT: Update the configuration variables above!"
echo "Press Enter to continue or Ctrl+C to exit..."
read

echo ""
echo "1️⃣  System Update"
echo "-----------------"
sudo yum update -y

echo ""
echo "2️⃣  Installing Node.js with NVM"
echo "-------------------------------"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
nvm alias default 18

echo ""
echo "3️⃣  Installing Global Dependencies"
echo "----------------------------------"
npm install -g pm2

echo ""
echo "4️⃣  Installing Nginx"
echo "--------------------"
sudo amazon-linux-extras install nginx1 -y
sudo systemctl start nginx
sudo systemctl enable nginx

echo ""
echo "5️⃣  Setting up Application"
echo "--------------------------"
cd ~
if [ -d "$APP_NAME" ]; then
    cd $APP_NAME
    git pull origin main
else
    git clone $GITHUB_REPO $APP_NAME
    cd $APP_NAME
fi

npm install

echo ""
echo "6️⃣  Creating Production Environment"
echo "-----------------------------------"
cat > .env.production << EOF
NODE_ENV=production
PORT=3000
API_BASE_URL=https://$DOMAIN
FRONTEND_URL=https://upscholar.in
DATABASE_URL=your-production-database-url
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://upscholar.in
EOF

echo ""
echo "7️⃣  Starting Application with PM2"
echo "---------------------------------"
pm2 start ecosystem.config.js --env production
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

echo ""
echo "8️⃣  Configuring Nginx"
echo "---------------------"
sudo tee /etc/nginx/conf.d/$APP_NAME.conf > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

echo ""
echo "9️⃣  Installing SSL Certificate"
echo "----------------------------"
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Setup auto-renewal
echo "0 2 * * 1 /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx" | sudo tee -a /etc/crontab

echo ""
echo "🔟 Finalizing Setup"
echo "------------------"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "✅ Deployment Complete!"
echo "========================"
echo ""
echo "🚀 Your API is ready at:"
echo "   HTTP:  http://$DOMAIN (redirects to HTTPS)"
echo "   HTTPS: https://$DOMAIN"
echo "   Health: https://$DOMAIN/health"
echo ""
echo "🔧 Management Commands:"
echo "- Check status: pm2 status"
echo "- View logs: pm2 logs"
echo "- Restart app: pm2 restart $APP_NAME"
echo "- Check SSL: sudo certbot certificates"
echo "- Test renewal: sudo certbot renew --dry-run"
echo ""
echo "📊 Verification:"
curl -s https://$DOMAIN/health | jq . 2>/dev/null || echo "Manual verification needed"
echo ""
echo "🎉 Happy coding!"