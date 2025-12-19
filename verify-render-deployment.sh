#!/bin/bash

# Render Deployment Verification Script
# Run this after Render deployment completes

echo "🔍 Verifying Render Deployment..."
echo "=================================="
echo ""

BASE_URL="http://13.60.254.183:3000"

# Test 1: Health Check
echo "1️⃣  Testing Health Endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check passed (200 OK)"
    curl -s "$BASE_URL/health" | jq '.' 2>/dev/null || curl -s "$BASE_URL/health"
else
    echo "❌ Health check failed (Status: $HEALTH_STATUS)"
fi
echo ""

# Test 2: Payment Packages (Public route)
echo "2️⃣  Testing Payment Packages Endpoint..."
PACKAGES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/payment/packages")
if [ "$PACKAGES_STATUS" = "200" ]; then
    echo "✅ Payment packages endpoint working (200 OK)"
else
    echo "❌ Payment packages failed (Status: $PACKAGES_STATUS)"
fi
echo ""

# Test 3: Trainer Students (Protected route - should return 401)
echo "3️⃣  Testing Trainer Students Endpoint..."
STUDENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/trainer/students")
if [ "$STUDENTS_STATUS" = "401" ]; then
    echo "✅ Trainer students endpoint exists (401 - Auth required)"
elif [ "$STUDENTS_STATUS" = "404" ]; then
    echo "❌ Trainer students endpoint NOT FOUND (404)"
    echo "   → Deployment may not have completed yet"
else
    echo "⚠️  Unexpected status: $STUDENTS_STATUS"
fi
echo ""

# Test 4: Trainer Course Stats (Protected route - should return 401)
echo "4️⃣  Testing Trainer Course Stats Endpoint..."
STATS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/trainer/students/course-stats")
if [ "$STATS_STATUS" = "401" ]; then
    echo "✅ Trainer course stats endpoint exists (401 - Auth required)"
elif [ "$STATS_STATUS" = "404" ]; then
    echo "❌ Trainer course stats endpoint NOT FOUND (404)"
    echo "   → Deployment may not have completed yet"
else
    echo "⚠️  Unexpected status: $STATS_STATUS"
fi
echo ""

# Test 5: Admin Withdrawals (Protected route - should return 401)
echo "5️⃣  Testing Admin Withdrawals Endpoint..."
WITHDRAWALS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/withdrawals?status=pending")
if [ "$WITHDRAWALS_STATUS" = "401" ]; then
    echo "✅ Admin withdrawals endpoint exists (401 - Auth required)"
elif [ "$WITHDRAWALS_STATUS" = "404" ]; then
    echo "❌ Admin withdrawals endpoint NOT FOUND (404)"
    echo "   → Deployment may not have completed yet"
else
    echo "⚠️  Unexpected status: $WITHDRAWALS_STATUS"
fi
echo ""

# Summary
echo "=================================="
echo "📊 Summary"
echo "=================================="
if [ "$HEALTH_STATUS" = "200" ] && [ "$PACKAGES_STATUS" = "200" ] && [ "$STUDENTS_STATUS" = "401" ] && [ "$STATS_STATUS" = "401" ] && [ "$WITHDRAWALS_STATUS" = "401" ]; then
    echo "✅ All endpoints working correctly!"
    echo ""
    echo "Next steps:"
    echo "1. Test with actual authentication token from frontend"
    echo "2. Verify CORS is working from frontend"
    echo "3. Monitor Render logs for any errors"
elif [ "$STUDENTS_STATUS" = "404" ] || [ "$STATS_STATUS" = "404" ] || [ "$WITHDRAWALS_STATUS" = "404" ]; then
    echo "❌ Some endpoints returning 404"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check Render dashboard - is deployment complete?"
    echo "2. Check Render logs for startup errors"
    echo "3. Verify environment variables are set in Render"
    echo "4. Try manual redeploy from Render dashboard"
else
    echo "⚠️  Mixed results - check individual tests above"
fi
echo ""
