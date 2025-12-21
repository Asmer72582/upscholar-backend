#!/bin/bash
# 🧪 SSL Verification and Troubleshooting Script

echo "🧪 SSL Verification and Troubleshooting"
echo "======================================"
echo ""

DOMAIN="api.upscholar.in"

echo "1️⃣  Checking SSL Certificate Status"
echo "-----------------------------------"
sudo certbot certificates | grep -A 5 "$DOMAIN"

echo ""
echo "2️⃣  Testing SSL Connection"
echo "---------------------------"
echo "Testing HTTPS connection to $DOMAIN..."
curl -I https://$DOMAIN/health 2>/dev/null | head -3

echo ""
echo "3️⃣  Checking Certificate Expiration"
echo "------------------------------------"
echo "Certificate expiration date:"
sudo openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates | grep "notAfter"

echo ""
echo "4️⃣  Testing SSL Configuration"
echo "------------------------------"
echo "Testing SSL Labs rating (this may take a moment)..."
curl -s "https://api.ssllabs.com/api/v3/analyze?host=$DOMAIN&publish=off&startNew=on" | grep -o '"status":"[^"]*"' | head -1

echo ""
echo "5️⃣  Checking Nginx SSL Configuration"
echo "-------------------------------------"
echo "Testing Nginx configuration..."
sudo nginx -t

echo ""
echo "6️⃣  Checking Redirects"
echo "----------------------"
echo "Testing HTTP to HTTPS redirect..."
curl -I http://$DOMAIN/health 2>/dev/null | grep -E "(HTTP|Location)"

echo ""
echo "7️⃣  Checking Common Issues"
echo "---------------------------"

# Check if port 443 is open
if sudo netstat -tlnp | grep -q ":443 "; then
    echo "✅ Port 443 is open"
else
    echo "❌ Port 443 is not open"
fi

# Check if Nginx is running
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi

# Check firewall
if sudo firewall-cmd --list-ports | grep -q "443/tcp"; then
    echo "✅ Firewall allows port 443"
else
    echo "⚠️  Firewall might not allow port 443"
fi

echo ""
echo "8️⃣  Testing Renewal Process"
echo "---------------------------"
echo "Testing certificate renewal (dry run)..."
sudo certbot renew --dry-run --quiet
if [ $? -eq 0 ]; then
    echo "✅ Renewal test passed"
else
    echo "❌ Renewal test failed"
fi

echo ""
echo "9️⃣  Log Analysis"
echo "----------------"
echo "Recent SSL-related errors:"
sudo grep -i "ssl\|cert\|tls" /var/log/nginx/error.log | tail -5

echo ""
echo "🔧 Quick Fixes for Common Issues:"
echo "--------------------------------"
echo "If you see redirect loops:"
echo "1. Check Node.js app doesn't have HTTPS redirects"
echo "2. Verify X-Forwarded-Proto header is set"
echo "3. Ensure app.set('trust proxy', true) is set"
echo ""
echo "If SSL certificate fails:"
echo "1. Check domain DNS points to this server"
echo "2. Verify port 80 is accessible"
echo "3. Check Nginx is running on port 80"
echo ""
echo "If renewal fails:"
echo "1. Check cron job: sudo crontab -l"
echo "2. Manual renewal: sudo certbot renew"
echo "3. Check logs: sudo tail -f /var/log/letsencrypt/letsencrypt.log"

echo ""
echo "✅ SSL verification complete!"