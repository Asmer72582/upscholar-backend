#!/bin/bash

# Quick endpoint test script for localhost
# Run this to verify all endpoints are working

echo "🧪 Testing Backend Endpoints on Localhost"
echo "=========================================="
echo ""

BASE_URL="http://13.60.254.183:3000"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "1️⃣  Testing Health Endpoint..."
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo -e "${RED}❌ Health check failed${NC}"
fi
echo ""

# Test 2: Payment Packages (Public)
echo "2️⃣  Testing Payment Packages..."
PACKAGES=$(curl -s "$BASE_URL/api/payment/packages")
if echo "$PACKAGES" | grep -q "success"; then
    echo -e "${GREEN}✅ Payment packages working${NC}"
    echo "$PACKAGES" | jq '.packages | length' 2>/dev/null | xargs echo "Found packages:"
else
    echo -e "${RED}❌ Payment packages failed${NC}"
fi
echo ""

# Test 3: Trainer Students (Protected - should return 401)
echo "3️⃣  Testing Trainer Students Endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/trainer/students")
if [ "$STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Trainer students endpoint exists (401 - needs auth)${NC}"
elif [ "$STATUS" = "404" ]; then
    echo -e "${RED}❌ Trainer students NOT FOUND (404)${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Test 4: Course Stats (Protected - should return 401)
echo "4️⃣  Testing Course Stats Endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/trainer/students/course-stats")
if [ "$STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Course stats endpoint exists (401 - needs auth)${NC}"
elif [ "$STATUS" = "404" ]; then
    echo -e "${RED}❌ Course stats NOT FOUND (404)${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Test 5: Admin Withdrawals (Protected - should return 401)
echo "5️⃣  Testing Admin Withdrawals Endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/withdrawals?status=pending")
if [ "$STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Admin withdrawals endpoint exists (401 - needs auth)${NC}"
elif [ "$STATUS" = "404" ]; then
    echo -e "${RED}❌ Admin withdrawals NOT FOUND (404)${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo ""
echo "Backend is running on: $BASE_URL"
echo ""
echo "To use this backend with your frontend:"
echo "1. Update frontend .env file:"
echo "   VITE_API_URL=http://13.60.254.183:3000/api"
echo ""
echo "2. Or update trainerService.ts:"
echo "   const API_BASE_URL = 'http://13.60.254.183:3000/api';'"
echo ""
echo "3. Restart your frontend"
echo ""
echo "All endpoints returning 401 is GOOD - it means they exist!"
echo "404 would be BAD - it means the route doesn't exist"
echo ""
