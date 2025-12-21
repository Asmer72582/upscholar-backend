#!/bin/bash
# 🎯 Final Deployment Verification Script

echo "🎯 Final Deployment Verification"
echo "==============================="
echo ""

DOMAIN="api.upscholar.in"

echo "1️⃣  Checking Node.js Application"
echo "--------------------------------"
echo "PM2 Status:"
pm2 status

echo ""
echo "Application logs (last 10 lines):"
pm2 logs upscholar-backend --lines 10 --nostream

echo ""
echo "2️⃣  Testing Local Application"
echo "------------------------------"
echo "Testing local health endpoint..."
curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo "3️⃣  Checking Nginx Configuration"
echo "---------------------------------"
echo "Testing Nginx config..."
sudo nginx -t

echo ""
echo "Nginx status:"
sudo systemctl status nginx --no-pager -l | head -10

echo ""
echo "4️⃣  Testing External Access"
echo "----------------------------"
echo "Testing HTTP to HTTPS redirect..."
curl -I http://$DOMAIN/health 2>/dev/null | grep -E "(HTTP|Location)"

echo ""
echo "Testing HTTPS access..."
curl -I https://$DOMAIN/health 2>/dev/null | head -3

echo ""
echo "5️⃣  Checking SSL Certificate"
echo "-----------------------------"
echo "Certificate info:"
sudo certbot certificates | grep -A 3 "$DOMAIN"

echo ""
echo "6️⃣  Testing Proxy Headers"
echo "-------------------------"
echo "Testing if Node.js receives correct proxy headers..."
curl -s https://$DOMAIN/health | jq '.proxy' 2>/dev/null || echo "Manual check: Visit https://$DOMAIN/health"

echo ""
echo "7️⃣  Checking for Redirect Loops"
echo "--------------------------------"
echo "Testing multiple redirects..."
curl -L --max-redirs 5 -I https://$DOMAIN/health 2>/dev/null | grep -E "(HTTP|Location)"

echo ""
echo "8️⃣  Performance Test"
echo "-------------------"
echo "Response time test:"
time curl -s https://$DOMAIN/health > /dev/null

echo ""
echo "9️⃣  Log Analysis"
echo "---------------"
echo "Recent Nginx errors:"
sudo tail -5 /var/log/nginx/error.log

echo ""
echo "Recent application errors:"
pm2 logs upscholar-backend --lines 5 --nostream | grep -i error || echo "No recent errors"

echo ""
echo "🔧 Quick Fixes if Issues Found:"
echo "-------------------------------"
echo "If redirect loops:"
echo "  1. Check Node.js app for HTTPS redirects (should be removed)"
echo "  2. Verify Nginx has proper proxy headers"
echo "  3. Ensure app.set('trust proxy', true) is set"
echo ""
echo "If SSL fails:"
echo "  1. Check certificate expiration: sudo certbot certificates"
echo "  2. Verify domain DNS points to server"
echo "  3. Check port 443 is open in security groups"
echo ""
echo "If app doesn't start:"
echo "  1. Check logs: pm2 logs upscholar-backend"
echo "  2. Verify .env.production file exists"
echo "  3. Check database connection"
echo ""
echo "✅ Verification complete!"
echo ""
echo "🚀 Your API should be accessible at:"
echo "   HTTP:  http://$DOMAIN (redirects to HTTPS)"
echo "   HTTPS: https://$DOMAIN (main endpoint)"
echo "   Health: https://$DOMAIN/health"
echo ""
echo "📊 Monitor with:"
echo "   pm2 monit"
echo "   sudo tail -f /var/log/nginx/access.log"