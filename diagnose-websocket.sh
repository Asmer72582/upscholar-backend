#!/bin/bash

# 🔍 WebSocket Connection Diagnostic Script
# This script helps diagnose WebSocket connection issues

echo "🔍 WebSocket Connection Diagnostic Tool"
echo "======================================"
echo

# Test basic API connectivity
echo "1️⃣ Testing basic API connectivity..."
curl -s -o /dev/null -w "%{http_code}" https://api.upscholar.in/health
echo " (HTTP Status Code)"
echo

# Test WebSocket endpoint
echo "2️⃣ Testing WebSocket upgrade..."
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://api.upscholar.in/socket.io/
echo

# Check Nginx logs
echo "3️⃣ Checking recent Nginx logs..."
echo "--- Recent Access Logs ---"
tail -10 /var/log/nginx/upscholar-api-access.log | grep -E "(socket|websocket|upgrade)" || echo "No WebSocket-related logs found"
echo

# Check PM2 logs
echo "4️⃣ Checking PM2 logs..."
echo "--- PM2 Error Logs ---"
if pm2 list | grep -q "upscholar-backend"; then
    pm2 logs upscholar-backend --lines 10 --err | grep -i "socket\|websocket\|error" || echo "No socket-related errors in PM2 logs"
else
    echo "PM2 process not found, checking Node.js logs..."
    tail -10 /tmp/node-server.log 2>/dev/null | grep -i "socket\|websocket\|error" || echo "No Node.js logs found"
fi
echo

# Test socket.io namespace
echo "5️⃣ Testing Socket.io namespace..."
curl -s "https://api.upscholar.in/socket.io/?EIO=4&transport=polling" | head -c 100
echo
echo

# Check server status
echo "6️⃣ Server Status Check..."
ps aux | grep -E "(node|pm2)" | grep -v grep || echo "No Node.js processes found"
echo

# Check ports
echo "7️⃣ Port Status..."
netstat -tlnp | grep -E ":3000|:80|:443" || ss -tlnp | grep -E ":3000|:80|:443" || echo "Could not check ports"
echo

# Check SSL certificate
echo "8️⃣ SSL Certificate Check..."
echo | openssl s_client -connect api.upscholar.in:443 -servername api.upscholar.in 2>/dev/null | openssl x509 -noout -dates
echo

echo "🔧 Common Issues & Solutions:"
echo "1. If WebSocket upgrade fails, check Nginx proxy settings"
echo "2. If socket.io polling fails, check Node.js server is running"
echo "3. If SSL issues, check certificate expiration"
echo "4. If connection refused, check firewall/security groups"
echo "5. If CORS issues, check allowed origins in socket configuration"
echo

echo "✅ Diagnostic complete! Check the output above for issues."