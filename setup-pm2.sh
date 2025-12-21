#!/bin/bash
# 🚀 PM2 Process Management Script

echo "🚀 PM2 Process Management Setup"
echo "==============================="
echo ""

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Setup PM2 startup
echo "🔄 Setting up PM2 startup..."
pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Save current process list
echo "💾 Saving process list..."
pm2 save

# Display status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ PM2 setup complete!"
echo ""
echo "🔧 Useful PM2 commands:"
echo "- pm2 status              - Show all processes"
echo "- pm2 logs upscholar-backend - Show logs"
echo "- pm2 restart upscholar-backend - Restart app"
echo "- pm2 stop upscholar-backend    - Stop app"
echo "- pm2 monit              - Monitor in real-time"
echo "- pm2 info upscholar-backend    - Show app info"
echo ""
echo "📁 Log files location:"
echo "- Combined: ./logs/combined.log"
echo "- Output: ./logs/out.log"
echo "- Error: ./logs/error.log"
echo ""
echo "🔄 To enable auto-restart on server reboot:"
echo "1. Run: pm2 startup"
echo "2. Copy and run the command it shows"
echo "3. Run: pm2 save"