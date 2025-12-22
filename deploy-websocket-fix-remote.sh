#!/bin/bash

# Remote WebSocket Fix Deployment Script
# This script should be run on the production server (api.upscholar.in)

set -e

echo "🚀 WebSocket Connection Fix Deployment Script"
echo "============================================="
echo ""
echo "⚠️  IMPORTANT: This script should be run on the production server"
echo "   Current target: api.upscholar.in"
echo ""

# Configuration
NGINX_CONF_PATH="/etc/nginx/sites-available/upscholar-api"
NGINX_ENABLED_PATH="/etc/nginx/sites-enabled/upscholar-api"
BACKUP_SUFFIX=".backup.$(date +%Y%m%d_%H%M%S)"

echo "📋 Checking current configuration..."

# Check if Nginx is installed and running
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed on this server"
    echo "   Please install Nginx first: sudo apt install nginx"
    exit 1
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx is not running"
    echo "   Please start Nginx: sudo systemctl start nginx"
    exit 1
fi

echo "✅ Nginx is installed and running"

# Find the actual configuration file
if [ -f "$NGINX_CONF_PATH" ]; then
    CONF_FILE="$NGINX_CONF_PATH"
elif [ -f "$NGINX_ENABLED_PATH" ]; then
    CONF_FILE="$NGINX_ENABLED_PATH"
else
    # Try to find any nginx config with upscholar
    CONF_FILE=$(find /etc/nginx -name "*.conf" -exec grep -l "upscholar\|api.upscholar.in" {} \; 2>/dev/null | head -1)
    if [ -z "$CONF_FILE" ]; then
        echo "❌ Could not find Nginx configuration for upscholar"
        echo "   Please check your Nginx setup"
        exit 1
    fi
fi

echo "📁 Found configuration file: $CONF_FILE"

# Backup current configuration
echo "💾 Creating backup of current configuration..."
sudo cp "$CONF_FILE" "${CONF_FILE}${BACKUP_SUFFIX}"
echo "✅ Backup created: ${CONF_FILE}${BACKUP_SUFFIX}"

# Read current configuration
echo "📖 Reading current configuration..."
current_conf=$(sudo cat "$CONF_FILE")

# Check if WebSocket configuration already exists
if echo "$current_conf" | grep -q "socket.io"; then
    echo "⚠️  WebSocket configuration may already exist"
    echo "   Current configuration contains socket.io references"
    read -p "   Do you want to proceed anyway? (y/N): " proceed
    if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Create the WebSocket configuration section
websocket_conf="
    # WebSocket configuration for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket specific timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # Disable buffering for real-time communication
        proxy_buffering off;
    }"

# Find the location block and insert WebSocket configuration before it
# Look for existing location blocks
echo "🔍 Analyzing configuration structure..."

# Check if there's already a location block for socket.io
if echo "$current_conf" | grep -A 10 -B 2 "location.*socket.io" | grep -q "proxy_pass"; then
    echo "⚠️  Socket.IO location block already exists"
    echo "   Current configuration:"
    echo "$current_conf" | grep -A 10 -B 2 "location.*socket.io"
    read -p "   Replace existing configuration? (y/N): " replace
    if [[ "$replace" =~ ^[Yy]$ ]]; then
        # Remove existing socket.io configuration
        echo "🗑️  Removing existing socket.io configuration..."
        # This is a complex operation - we'll create a new config
        new_conf=$(echo "$current_conf" | sed '/location.*socket.io/,/}/d')
        current_conf="$new_conf"
    else
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Insert WebSocket configuration before the first location block or server closing brace
echo "🔧 Creating new configuration with WebSocket support..."

# Find a good place to insert the WebSocket configuration
# Try to insert before existing location blocks or before the closing brace of server block
if echo "$current_conf" | grep -q "location / {"; then
    # Insert before the main location block
    new_conf=$(echo "$current_conf" | sed '/location / {/i\
    # WebSocket configuration for Socket.IO\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        \
        # WebSocket specific timeouts\
        proxy_connect_timeout 7d;\
        proxy_send_timeout 7d;\
        proxy_read_timeout 7d;\
        \
        # Disable buffering for real-time communication\
        proxy_buffering off;\
    }\
')
elif echo "$current_conf" | grep -q "server {"; then
    # Insert before the closing brace of server block
    new_conf=$(echo "$current_conf" | sed '/^}$/i\
    # WebSocket configuration for Socket.IO\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        \
        # WebSocket specific timeouts\
        proxy_connect_timeout 7d;\
        proxy_send_timeout 7d;\
        proxy_read_timeout 7d;\
        \
        # Disable buffering for real-time communication\
        proxy_buffering off;\
    }\
')
else
    echo "❌ Could not determine where to insert WebSocket configuration"
    echo "   Please manually add the WebSocket configuration to your Nginx config"
    echo ""
    echo "   Add this location block to your server configuration:"
    echo "$websocket_conf"
    exit 1
fi

# Write the new configuration
echo "📝 Writing new configuration..."
echo "$new_conf" | sudo tee "$CONF_FILE" > /dev/null

# Test the configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Configuration test passed!"
else
    echo "❌ Configuration test failed!"
    echo "🔄 Restoring backup..."
    sudo cp "${CONF_FILE}${BACKUP_SUFFIX}" "$CONF_FILE"
    echo "✅ Backup restored"
    exit 1
fi

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx reloaded successfully!"
else
    echo "❌ Nginx failed to reload"
    echo "🔄 Restoring backup..."
    sudo cp "${CONF_FILE}${BACKUP_SUFFIX}" "$CONF_FILE"
    sudo systemctl reload nginx
    echo "✅ Backup restored"
    exit 1
fi

echo ""
echo "🎉 WebSocket configuration deployed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Backup created: ${CONF_FILE}${BACKUP_SUFFIX}"
echo "   ✅ WebSocket configuration added to: $CONF_FILE"
echo "   ✅ Nginx configuration tested and reloaded"
echo ""
echo "🔍 Next steps:"
echo "   1. Test WebSocket connection using the test page"
echo "   2. Verify meeting room functionality"
echo "   3. Monitor server logs for any issues"
echo ""
echo "📊 To monitor logs:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo "   sudo tail -f /var/log/nginx/access.log"
echo ""
echo "🧪 To test the connection:"
echo "   Open websocket-test.html in your browser"
echo "   Or run: curl -I https://api.upscholar.in/socket.io/"