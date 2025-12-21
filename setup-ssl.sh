#!/bin/bash
# SSL Certificate Setup Script for EC2 Backend
# This script sets up SSL certificates using Let's Encrypt for the EC2 instance

echo "🔧 SSL Certificate Setup for UpScholar Backend"
echo "=============================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y certbot python3-certbot-nginx nginx

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Please provide a domain name as argument"
    echo "Usage: sudo ./setup-ssl.sh your-domain.com"
    exit 1
fi

DOMAIN=$1
echo "🌐 Setting up SSL for domain: $DOMAIN"

# Check if domain resolves to this server
echo "🔍 Checking domain resolution..."
SERVER_IP=$(curl -s http://checkip.amazonaws.com)
DOMAIN_IP=$(dig +short $DOMAIN)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "⚠️  Warning: Domain $DOMAIN does not resolve to this server's IP ($SERVER_IP)"
    echo "   Domain resolves to: $DOMAIN_IP"
    echo "   Please update your DNS records first."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Stop nginx if running
echo "🛑 Stopping nginx..."
systemctl stop nginx

# Generate SSL certificate
echo "🔐 Generating SSL certificate with Let's Encrypt..."
certbot certonly --standalone --preferred-challenges http -d $DOMAIN --agree-tos --non-interactive --email admin@upscholar.in

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate generated successfully!"
    
    # Update nginx configuration
    echo "⚙️  Updating nginx configuration..."
    
    # Create nginx config with SSL
    cat > /etc/nginx/sites-available/upscholar-api << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers for WebRTC
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # WebRTC Security Headers
    add_header Permissions-Policy "camera=(), microphone=(), display-capture=()" always;
    
    # Dynamic CORS Headers for WebRTC
    map \$http_origin \$cors_origin {
        ~^https://upscholar-ui-kit\.vercel\.app\$ \$http_origin;
        ~^https://upscholar\.in\$ \$http_origin;
        ~^http://localhost:(8080|5173)\$ \$http_origin;
        ~^http://127\.0\.0\.1:8080\$ \$http_origin;
        default "";
    }
    
    add_header Access-Control-Allow-Origin \$cors_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Socket.IO WebSocket Configuration
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        proxy_request_buffering off;
        
        # CORS preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin \$cors_origin;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Access-Control-Allow-Credentials "true";
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    # API Routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin \$cors_origin;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Access-Control-Allow-Credentials "true";
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/upscholar-api /etc/nginx/sites-enabled/
    
    # Test nginx configuration
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx configuration updated successfully!"
        
        # Start nginx
        echo "▶️ Starting nginx..."
        systemctl start nginx
        systemctl enable nginx
        
        echo "🎉 SSL setup completed successfully!"
        echo "📋 Summary:"
        echo "   - Domain: $DOMAIN"
        echo "   - SSL Certificate: /etc/letsencrypt/live/$DOMAIN/"
        echo "   - Nginx Config: /etc/nginx/sites-available/upscholar-api"
        echo "   - HTTPS URL: https://$DOMAIN"
        echo ""
        echo "🔄 Next steps:"
        echo "   1. Update frontend .env files to use: https://$DOMAIN"
        echo "   2. Test the HTTPS endpoint: https://$DOMAIN/health"
        echo "   3. Set up auto-renewal for SSL certificates"
        
        # Set up auto-renewal
        echo "🔧 Setting up auto-renewal..."
        (crontab -l 2>/dev/null; echo "0 2 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
        echo "✅ Auto-renewal configured!"
        
    else
        echo "❌ Nginx configuration test failed!"
        exit 1
    fi
    
else
    echo "❌ SSL certificate generation failed!"
    echo "   Please check:"
    echo "   - Domain DNS records"
    echo "   - Domain ownership"
    echo "   - Firewall settings (port 80)"
    exit 1
fi

echo "✅ Setup complete!"