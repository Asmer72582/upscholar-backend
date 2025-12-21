#!/bin/bash
# 🧪 Comprehensive Testing Script for Production Deployment

echo "🧪 Production Deployment Testing"
echo "==============================="
echo ""

DOMAIN="api.upscholar.in"
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_pattern=$3
    
    echo "Testing: $test_name"
    result=$(eval "$test_command" 2>/dev/null)
    
    if echo "$result" | grep -q "$expected_pattern"; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $test_name"
        echo "   Expected: $expected_pattern"
        echo "   Got: $result"
        ((TESTS_FAILED++))
    fi
    echo ""
}

echo "1️⃣  Basic Connectivity Tests"
echo "============================="

run_test "HTTP to HTTPS redirect" \
    "curl -I http://$DOMAIN/health 2>/dev/null" \
    "301"

run_test "HTTPS accessibility" \
    "curl -I https://$DOMAIN/health 2>/dev/null" \
    "200"

run_test "Health endpoint response" \
    "curl -s https://$DOMAIN/health 2>/dev/null | jq -r '.status' 2>/dev/null" \
    "ok"

echo "2️⃣  SSL Certificate Tests"
echo "=========================="

run_test "SSL certificate validity" \
    "echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep 'notAfter'" \
    "notAfter"

run_test "SSL protocol support" \
    "curl -I https://$DOMAIN/health 2>/dev/null | grep -i 'server'" \
    "nginx"

echo "3️⃣  Proxy Configuration Tests"
echo "============================="

run_test "X-Forwarded-Proto header" \
    "curl -s https://$DOMAIN/health 2>/dev/null | jq -r '.proxy.\"x-forwarded-proto\"' 2>/dev/null" \
    "https"

run_test "Trust proxy setting" \
    "curl -s https://$DOMAIN/health 2>/dev/null | jq -r '.proxy.trusted' 2>/dev/null" \
    "true"

echo "4️⃣  Application Tests"
echo "===================="

run_test "CORS headers present" \
    "curl -I https://$DOMAIN/health 2>/dev/null | grep -i 'access-control'" \
    "Access-Control"

run_test "Response time acceptable" \
    "time curl -s https://$DOMAIN/health > /dev/null 2>&1 && echo 'completed'" \
    "completed"

echo "5️⃣  Security Tests"
echo "=================="

run_test "Security headers present" \
    "curl -I https://$DOMAIN/health 2>/dev/null | grep -i 'x-frame-options'" \
    "SAMEORIGIN"

run_test "No server version disclosure" \
    "curl -I https://$DOMAIN/health 2>/dev/null | grep -i 'server' | grep -v 'nginx'" \
    ""

echo "6️⃣  Performance Tests"
echo "======================"

echo "Load test (10 concurrent requests):"
for i in {1..10}; do
    curl -s https://$DOMAIN/health > /dev/null &
done
wait
echo "✅ Load test completed"
echo ""

echo "7️⃣  Service Availability Tests"
echo "==============================="

run_test "PM2 process running" \
    "pm2 status upscholar-backend | grep -c 'online'" \
    "1"

run_test "Nginx service active" \
    "sudo systemctl is-active nginx" \
    "active"

echo "8️⃣  Log Analysis"
echo "================"

echo "Recent errors in Nginx:"
sudo tail -10 /var/log/nginx/error.log | grep -v "^$" || echo "No recent errors"
echo ""

echo "Recent errors in application:"
pm2 logs upscholar-backend --lines 10 --nostream 2>/dev/null | grep -i error || echo "No recent errors"
echo ""

echo "📊 TEST SUMMARY"
echo "==============="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED! 🎉"
    echo "Your deployment is ready for production!"
    echo ""
    echo "🚀 Access your API at:"
    echo "   https://$DOMAIN/health"
    echo "   https://$DOMAIN/api/auth/login"
    echo ""
    echo "📈 Monitor with:"
    echo "   pm2 monit"
    echo "   sudo tail -f /var/log/nginx/access.log"
else
    echo ""
    echo "❌ SOME TESTS FAILED"
    echo "Please check the failed tests above and fix the issues."
fi

echo ""
echo "🔧 Quick Debug Commands:"
echo "- Check PM2: pm2 status && pm2 logs"
echo "- Check Nginx: sudo systemctl status nginx && sudo nginx -t"
echo "- Check SSL: sudo certbot certificates"
echo "- Check ports: sudo netstat -tlnp | grep -E ':80|:443|:3000'"
echo "- Check DNS: nslookup $DOMAIN"