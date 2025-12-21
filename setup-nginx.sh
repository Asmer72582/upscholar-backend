#!/bin/bash
# 🌐 Nginx Setup Script for EC2

echo "🌐 Nginx Setup Script"
echo "====================="
echo ""

# Install Nginx
echo "📦 Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y

# Create backup of default config
echo "💾 Creating backup of default config..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Create our application config
echo "📝 Creating Nginx configuration..."
sudo tee /etc/nginx/conf.d/upscholar-api.conf > /dev/null << 'EOF'
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name api.upscholar.in;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server - main configuration
server {
    listen 443 ssl http2;
    server_name api.upscholar.in;
    
    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/api.upscholar.in/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.upscholar.in/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logging
    access_log /var/log/nginx/upscholar-api-access.log;
    error_log /var/log/nginx/upscholar-api-error.log;
    
    # Main application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Headers for Node.js to trust proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable cache for API
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Start and enable Nginx
echo "🚀 Starting Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Check Nginx status
echo "📊 Nginx status:"
sudo systemctl status nginx --no-pager -l

echo ""
echo "✅ Nginx setup complete!"
echo ""
echo "🔧 Useful commands:"
echo "- Test config: sudo nginx -t"
echo "- Reload config: sudo systemctl reload nginx"
echo "- Restart Nginx: sudo systemctl restart nginx"
echo "- View logs: sudo tail -f /var/log/nginx/error.log"
echo "- Access logs: sudo tail -f /var/log/nginx/access.log"
echo ""
echo "📁 Configuration files:"
echo "- Main config: /etc/nginx/nginx.conf"
echo "- App config: /etc/nginx/conf.d/upscholar-api.conf"
echo ""
echo "🚀 Next step: Install SSL with Certbot"