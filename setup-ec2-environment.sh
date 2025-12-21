#!/bin/bash
# 🚀 Node.js Environment Setup Script for Amazon Linux 2

echo "🚀 Setting up Node.js Environment on Amazon Linux 2"
echo "===================================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install essential tools
echo "🔧 Installing essential tools..."
sudo yum install -y git curl wget tar gzip

# Install NVM (Node Version Manager)
echo "📥 Installing NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load NVM into current session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js 18 LTS
echo "📦 Installing Node.js 18 LTS..."
nvm install 18
nvm use 18
nvm alias default 18

# Verify installation
echo "✅ Node.js installation verified:"
node --version
npm --version

# Install PM2 globally
echo "🚀 Installing PM2 globally..."
npm install -g pm2

# Install Nginx
echo "🌐 Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot for SSL
echo "🔒 Installing Certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Create application directory
echo "📁 Creating application directory..."
mkdir -p ~/apps/upscholar-backend
cd ~/apps/upscholar-backend

# Setup PM2 startup script
echo "🔄 Setting up PM2 startup..."
pm2 startup systemd -u ec2-user --hp /home/ec2-user

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository: git clone https://github.com/your-username/upscholar-backend.git"
echo "2. Install dependencies: npm install"
echo "3. Configure environment variables"
echo "4. Start with PM2: pm2 start src/server.js --name 'upscholar-backend'"
echo ""
echo "🔧 Useful commands:"
echo "- Check Node version: node --version"
echo "- Check PM2 status: pm2 status"
echo "- Check Nginx status: sudo systemctl status nginx"
echo "- View logs: pm2 logs"
echo ""
echo "🚀 Ready for deployment!"