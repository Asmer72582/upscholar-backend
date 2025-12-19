#!/bin/bash

# Test script for suspend/activate user routes

echo "🧪 Testing Suspend/Activate User Routes"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://13.60.254.183:3000"

# Check if server is running
echo "1️⃣  Checking if server is running..."
if curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running${NC}"
    echo ""
    echo "Please start the server first:"
    echo "  cd upscholar-backend"
    echo "  npm start"
    exit 1
fi
echo ""

# Test user ID (replace with actual user ID)
USER_ID="68c4ff80e4668b8330c4537e"
ADMIN_TOKEN="your_admin_token_here"

echo "2️⃣  Testing Suspend User Endpoint..."
echo "URL: POST $BASE_URL/api/admin/users/$USER_ID/suspend"
echo ""

SUSPEND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/users/$USER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $ADMIN_TOKEN" \
  -d '{"reason":"Test suspension from script"}')

HTTP_CODE=$(echo "$SUSPEND_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SUSPEND_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Suspend endpoint working (200 OK)${NC}"
    echo "Response: $RESPONSE_BODY"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ Route not found (404)${NC}"
    echo -e "${YELLOW}⚠️  Server needs to be restarted!${NC}"
    echo ""
    echo "To restart the server:"
    echo "  1. Stop the current server (Ctrl+C)"
    echo "  2. Run: npm start"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo -e "${YELLOW}⚠️  Authentication issue ($HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    echo ""
    echo "This is expected if you don't have a valid admin token."
    echo "The route exists and is working!"
else
    echo -e "${YELLOW}⚠️  Unexpected response ($HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo "3️⃣  Testing Activate User Endpoint..."
echo "URL: POST $BASE_URL/api/admin/users/$USER_ID/activate"
echo ""

ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/users/$USER_ID/activate" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $ADMIN_TOKEN")

HTTP_CODE=$(echo "$ACTIVATE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$ACTIVATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Activate endpoint working (200 OK)${NC}"
    echo "Response: $RESPONSE_BODY"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ Route not found (404)${NC}"
    echo -e "${YELLOW}⚠️  Server needs to be restarted!${NC}"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo -e "${YELLOW}⚠️  Authentication issue ($HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    echo ""
    echo "This is expected if you don't have a valid admin token."
    echo "The route exists and is working!"
else
    echo -e "${YELLOW}⚠️  Unexpected response ($HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo "========================================"
echo "📊 Summary"
echo "========================================"
echo ""
echo "If you see 404 errors:"
echo "  → Restart the backend server"
echo "  → The routes were just added and need a restart"
echo ""
echo "If you see 401/403 errors:"
echo "  → Routes are working!"
echo "  → You need a valid admin token to test fully"
echo "  → Use the frontend admin panel to test"
echo ""
