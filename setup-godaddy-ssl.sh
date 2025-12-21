#!/bin/bash
# Quick SSL Setup for GoDaddy Production
# Run this on your EC2 instance

echo "🚀 Setting up SSL for GoDaddy Production..."

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your domain: ./setup-godaddy-ssl.sh api.upscholar.in"
    exit 1
fi

DOMAIN=$1
echo "📡 Setting up SSL for domain: $DOMAIN"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "🔧 Installing Certbot..."
    sudo apt install certbot python3-certbot-nginx -y
fi

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed. Please fix nginx config first."
    exit 1
fi

# Get SSL certificate
echo "🔒 Getting SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@upscholar.in --redirect

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate successfully installed!"
    
    # Test HTTPS endpoint
    echo "🧪 Testing HTTPS endpoint..."
    sleep 5
    curl -f https://$DOMAIN/health
    
    if [ $? -eq 0 ]; then
        echo "✅ HTTPS endpoint is working!"
        echo "🎉 SSL setup complete! Your backend is now accessible via HTTPS"
        echo ""
        echo "📋 Next steps:"
        echo "1. Update your frontend to use: https://$DOMAIN"
        echo "2. Test the auth endpoint: https://$DOMAIN/api/auth/login"
        echo "3. Verify mixed content error is resolved"
    else
        echo "⚠️  HTTPS endpoint test failed. Check nginx logs:"
        echo "sudo tail -f /var/log/nginx/error.log"
    fi
else
    echo "❌ SSL certificate installation failed. Common issues:"
    echo "- Domain DNS not pointing to this server"
    echo "- Port 80 not open in security groups"
    echo "- Nginx not running"
    echo ""
    echo "🔧 Fix the issue and run this script again."
fi

# Set up auto-renewal
echo "⏰ Setting up auto-renewal..."
echo "0 0,12 * * * root certbot renew --quiet" | sudo tee -a /etc/crontab

echo "✅ Auto-renewal configured for SSL certificates"