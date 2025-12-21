#!/bin/bash
# EMERGENCY SSL & DNS Fix for GoDaddy Production
# This script provides immediate solutions for the mixed content error

echo "🚨 EMERGENCY SSL & DNS FIX FOR GODADDY PRODUCTION"
echo "================================================="
echo ""

# Check current DNS status
echo "📡 Checking DNS resolution for api.upscholar.in..."
nslookup api.upscholar.in

echo ""
echo "🔍 Testing backend connectivity..."
curl -s -o /dev/null -w "%{http_code}" http://13.60.254.183:3000/health

echo ""
echo "❌ ISSUES DETECTED:"
echo "1. DNS api.upscholar.in is not pointing to your EC2"
echo "2. No SSL certificate on EC2 instance"
echo "3. Frontend configured for HTTPS but backend only supports HTTP"
echo ""

echo "🚀 IMMEDIATE SOLUTION OPTIONS:"
echo ""

# Option 1: Quick DNS Fix
echo "OPTION 1: Fix DNS (Recommended - 5 minutes)"
echo "----------------------------------------------"
echo "1. Log into GoDaddy DNS Management"
echo "2. Find A record for 'api.upscholar.in'"
echo "3. Change it to point ONLY to: 13.60.254.183"
echo "4. Remove any other A records for 'api'"
echo "5. Set TTL to 600 (10 minutes)"
echo ""

# Option 2: Alternative Domain
echo "OPTION 2: Use Alternative Domain (If DNS takes too long)"
echo "---------------------------------------------------------"
echo "1. Use your main domain with a different approach:"
echo "   - Set up nginx reverse proxy on same server"
echo "   - Use path-based routing: upscholar.in/api/*"
echo ""

# Option 3: CloudFlare Proxy
echo "OPTION 3: CloudFlare SSL Proxy (Free - 15 minutes)"
echo "--------------------------------------------------"
echo "1. Sign up for CloudFlare (free)"
echo "2. Add your domain: upscholar.in"
echo "3. Change nameservers to CloudFlare"
echo "4. Enable SSL/TLS encryption"
echo "5. Create A record: api → 13.60.254.183"
echo ""

# Option 4: Temporary Workaround
echo "OPTION 4: Temporary Workaround (Immediate - 2 minutes)"
echo "--------------------------------------------------------"
echo "1. Update frontend to use HTTP temporarily:"
echo "   - Change back to: http://13.60.254.183:3000"
echo "   - This will show 'Not Secure' but will work"
echo ""

echo "📋 STEP-BY-STEP DNS FIX (RECOMMENDED):"
echo "======================================="
echo ""
echo "Step 1: Go to GoDaddy DNS Management"
echo "Step 2: Look for A records with 'api' name"
echo "Step 3: Delete any A records pointing to:"
echo "   - 15.197.225.128"
echo "   - 3.33.251.168"
echo "Step 4: Create/Update A record:"
echo "   - Name: api"
echo "   - Value: 13.60.254.183"
echo "   - TTL: 600"
echo "Step 5: Save and wait 10 minutes"
echo ""

echo "🔧 AFTER DNS FIX - SSL Setup:"
echo "=============================="
echo "Step 1: SSH to your server:"
echo "   ssh ubuntu@13.60.254.183"
echo ""
echo "Step 2: Run SSL setup:"
echo "   sudo ./setup-godaddy-ssl.sh api.upscholar.in"
echo ""
echo "Step 3: Test HTTPS:"
echo "   curl https://api.upscholar.in/health"
echo ""

echo "⚡ EMERGENCY WORKAROUND (If you need it NOW):"
echo "============================================="
echo "1. Update frontend config to use HTTP temporarily"
echo "2. Deploy with HTTP URLs"
echo "3. Fix SSL later when you have time"
echo ""
echo "Would you like me to create the temporary workaround?"