#!/bin/bash
# 🔒 SSL Certificate Setup with Let's Encrypt (Certbot)

echo "🔒 SSL Certificate Setup Script"
echo "=============================="
echo ""

# Domain configuration
DOMAIN="api.upscholar.in"
EMAIL="your-email@example.com"  # Update this

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your email address:"
    echo "Usage: $0 your-email@example.com"
    exit 1
fi

EMAIL=$1

# Install Certbot
echo "📦 Installing Certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Test Nginx configuration first
echo "🧪 Testing Nginx configuration..."
sudo nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed. Please fix errors first."
    exit 1
fi

# Get SSL certificate
echo "🔐 Getting SSL certificate for $DOMAIN..."
sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

if [ $? -ne 0 ]; then
    echo "❌ SSL certificate installation failed."
    echo "Trying manual mode..."
    sudo certbot certonly --webroot -w /var/www/html -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
fi

# Test SSL configuration
echo "🧪 Testing SSL configuration..."
sudo nginx -t

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# Setup auto-renewal
echo "⏰ Setting up auto-renewal..."
echo "0 2 * * 1 /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx" | sudo tee -a /etc/crontab

# Test renewal process
echo "🧪 Testing renewal process..."
sudo certbot renew --dry-run

# Display certificate info
echo "📜 Certificate information:"
sudo certbot certificates

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "🔧 Useful commands:"
echo "- Check certificates: sudo certbot certificates"
echo "- Test renewal: sudo certbot renew --dry-run"
echo "- Manual renewal: sudo certbot renew"
echo "- View logs: sudo tail -f /var/log/letsencrypt/letsencrypt.log"
echo ""
echo "📅 Auto-renewal is scheduled for every Monday at 2 AM"
echo "🚀 Your API should now be accessible at: https://$DOMAIN"