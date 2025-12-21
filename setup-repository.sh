#!/bin/bash
# 🔄 Repository Setup and Clone Script for EC2

echo "🔄 Repository Setup and Clone Script"
echo "===================================="
echo ""

# Configuration - UPDATE THESE VALUES
GITHUB_REPO="https://github.com/your-username/upscholar-backend.git"
GITHUB_USERNAME="your-username"
GITHUB_TOKEN="your-personal-access-token"  # Optional: for private repos
APP_NAME="upscholar-backend"

# Create application directory
echo "📁 Creating application directory..."
mkdir -p ~/apps
cd ~/apps

# Clone repository
echo "📥 Cloning repository..."
if [ -d "$APP_NAME" ]; then
    echo "Directory exists, updating repository..."
    cd $APP_NAME
    git pull origin main
else
    echo "Cloning new repository..."
    git clone $GITHUB_REPO $APP_NAME
    cd $APP_NAME
fi

# Verify repository
echo "🔍 Verifying repository..."
git status
echo "Current branch: $(git branch --show-current)"
echo "Latest commit: $(git log --oneline -1)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create production environment file
echo "🔧 Creating production environment file..."
cat > .env.production << 'EOF'
# Production Environment Variables
NODE_ENV=production
PORT=3000

# API Configuration
API_BASE_URL=https://api.upscholar.in
FRONTEND_URL=https://upscholar.in

# Database (update with your production database)
DATABASE_URL=mongodb://localhost:27017/upscholar

# JWT Configuration (generate strong secret)
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=https://upscholar.in

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=12

# Email Configuration (if needed)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads/
EOF

# Create deployment script
echo "🚀 Creating deployment script..."
cat > deploy.sh << 'EOF'
#!/bin/bash
# Quick deployment script

echo "🚀 Deploying application..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart PM2
pm2 restart upscholar-backend

# Check status
pm2 status

echo "✅ Deployment complete!"
EOF

chmod +x deploy.sh

# Create environment setup check
echo "🔍 Creating environment check script..."
cat > check-env.sh << 'EOF'
#!/bin/bash
# Environment verification script

echo "🔍 Checking environment..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
echo "Git version: $(git --version)"
echo ""
echo "📁 Directory structure:"
ls -la
echo ""
echo "📦 Dependencies:"
npm list --depth=0
echo ""
echo "🔧 Environment variables:"
if [ -f .env.production ]; then
    echo ".env.production exists ✓"
    echo "Variables: $(grep -c '^[A-Z]' .env.production)"
else
    echo ".env.production missing ✗"
fi
EOF

chmod +x check-env.sh

echo ""
echo "✅ Repository setup complete!"
echo ""
echo "📋 Available commands:"
echo "- ./check-env.sh    - Check environment"
echo "- ./deploy.sh       - Deploy latest changes"
echo "- pm2 start src/server.js --name 'upscholar-backend' - Start app"
echo ""
echo "🔧 Next steps:"
echo "1. Update .env.production with your production values"
echo "2. Start the application with PM2"
echo "3. Configure Nginx reverse proxy"
echo "4. Set up SSL with Certbot"