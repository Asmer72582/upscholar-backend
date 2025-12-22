#!/bin/bash

# 🔧 Apply Nginx WebSocket Configuration Fix
# This script updates the Nginx configuration to properly handle WebSocket connections

echo "🚀 Applying Nginx WebSocket Configuration Fix"
echo "============================================"
echo

# Check if running as root (required for Nginx operations)
if [[ $EUID -ne 0 ]]; then
   echo "⚠️  This script should be run as root for Nginx configuration"
   echo "   Run: sudo bash apply-nginx-websocket-fix.sh"
   echo
fi

# Backup current Nginx configuration
echo "📋 Backing up current Nginx configuration..."
cp /etc/nginx/conf.d/upscholar-api.conf /etc/nginx/conf.d/upscholar-api.conf.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"
echo

# Copy the new configuration
echo "🔧 Applying new Nginx configuration..."
cp nginx-config.conf /etc/nginx/conf.d/upscholar-api.conf

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx_test_result=$(nginx -t 2>&1)
if [[ $? -eq 0 ]]; then
    echo "✅ Nginx configuration test passed"
else
    echo "❌ Nginx configuration test failed:"
    echo "$nginx_test_result"
    echo "🔄 Restoring backup configuration..."
    cp /etc/nginx/conf.d/upscholar-api.conf.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/conf.d/upscholar-api.conf
    echo "✅ Backup restored"
    exit 1
fi

echo
# Reload Nginx to apply changes
echo "🔄 Reloading Nginx..."
if systemctl reload nginx; then
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Failed to reload Nginx, trying restart..."
    if systemctl restart nginx; then
        echo "✅ Nginx restarted successfully"
    else
        echo "❌ Failed to restart Nginx"
        exit 1
    fi
fi

echo
echo "🎯 WebSocket Configuration Applied!"
echo "====================================="
echo "✅ Socket.io WebSocket support enabled"
echo "✅ Extended timeouts for long-lived connections"
echo "✅ Proper upgrade headers configured"
echo "✅ Real-time communication should now work"
echo

# Test the connection
echo "🧪 Testing WebSocket connection..."
sleep 2

# Test polling endpoint
echo "Testing polling endpoint..."
curl -s -o /dev/null -w "Polling: %{http_code}" "https://api.upscholar.in/socket.io/?EIO=4&transport=polling"
echo

# Test WebSocket upgrade
echo "Testing WebSocket upgrade..."
curl -s -o /dev/null -w "WebSocket: %{http_code}" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://api.upscholar.in/socket.io/?EIO=4&transport=websocket"
echo

echo "🎉 Configuration complete!"
echo "   Test your meeting room functionality now."