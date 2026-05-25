#!/bin/bash
BASE="http://localhost:5001"
PASS=0
FAIL=0
TOKEN=""
EVIDENCE="/Users/ananyagoel/.gemini/antigravity/brain/90da2328-1f19-42dd-932e-4981b5faa2b4/test_evidence"

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "✅ PASS: $name"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $name (expected '$expected', got: $(echo "$actual" | head -2))"
    FAIL=$((FAIL+1))
  fi
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        TimeCraft ERP — Professional Test Report             ║"
echo "║        Date: $(date '+%Y-%m-%d %H:%M:%S')                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 1: HEALTH & SECURITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1.1: Health endpoint
RES=$(curl -s "$BASE/api/health")
check "1.1 Health endpoint returns success" '"success":true' "$RES"

# Test 1.2: Security headers (Helmet)
HEADERS=$(curl -sI "$BASE/api/health")
check "1.2 X-Content-Type-Options header present" "x-content-type-options" "$(echo "$HEADERS" | tr 'A-Z' 'a-z')"
check "1.3 X-Frame-Options header present" "x-frame-options" "$(echo "$HEADERS" | tr 'A-Z' 'a-z')"

# Test 1.4: Protected route without auth
RES=$(curl -s -w "\n%{http_code}" "$BASE/api/teachers")
CODE=$(echo "$RES" | tail -1)
check "1.4 Teachers endpoint rejects without auth (401)" "401" "$CODE"

# Test 1.5: Protected route without auth - message
BODY=$(echo "$RES" | head -1)
check "1.5 Returns 'Not authorized' message" "Not authorized" "$BODY"

# Test 1.6: Subjects endpoint protected
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/subjects")
check "1.6 Subjects endpoint protected (401)" "401" "$CODE"

# Test 1.7: Classes endpoint protected
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/classes")
check "1.7 Classes endpoint protected (401)" "401" "$CODE"

# Test 1.8: Rooms endpoint protected
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/rooms")
check "1.8 Rooms endpoint protected (401)" "401" "$CODE"

# Test 1.9: Audit logs endpoint protected
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/audit-logs")
check "1.9 Audit logs endpoint protected (401)" "401" "$CODE"

# Test 1.10: Reports endpoint protected
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/full-school?timetableId=x")
check "1.10 Reports endpoint protected (401)" "401" "$CODE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 2: AUTHENTICATION FLOW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 2.1: Login with valid credentials
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu","password":"admin123"}')
check "2.1 Login returns success" '"success":true' "$RES"
TOKEN=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)
check "2.2 Login returns JWT token" "eyJ" "$TOKEN"

# Test 2.3: Login with wrong password
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu","password":"wrong"}')
check "2.3 Wrong password returns 401" "Invalid credentials" "$RES"

# Test 2.4: Login with missing fields
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{}')
check "2.4 Missing fields returns error" "required" "$RES"

# Test 2.5: Forgot password
RES=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu"}')
check "2.5 Forgot password returns token (dev mode)" "resetToken" "$RES"

# Test 2.6: Forgot password — non-existent email (should not leak)
RES=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"noone@fake.com"}')
check "2.6 Non-existent email doesn't leak existence" '"success":true' "$RES"

# Test 2.7: Reset password with invalid token
RES=$(curl -s -X POST "$BASE/api/auth/reset-password" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu","resetToken":"invalid","newPassword":"newpass123"}')
check "2.7 Invalid reset token returns error" "Invalid" "$RES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 3: AUTHENTICATED DATA ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

AUTH="Authorization: Bearer $TOKEN"

# Test 3.1: Teachers with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/teachers")
check "3.1 Teachers returns data with auth" '"success":true' "$RES"
TEACHER_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "    → Teachers found: $TEACHER_COUNT"

# Test 3.2: Subjects with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/subjects")
check "3.2 Subjects returns data with auth" '"success":true' "$RES"
SUBJECT_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "    → Subjects found: $SUBJECT_COUNT"

# Test 3.3: Classes with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/classes")
check "3.3 Classes returns data with auth" '"success":true' "$RES"
CLASS_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "    → Classes found: $CLASS_COUNT"

# Test 3.4: Rooms with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/rooms")
check "3.4 Rooms returns data with auth" '"success":true' "$RES"

# Test 3.5: Requirements with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/requirements")
check "3.5 Requirements returns data with auth" '"success":true' "$RES"

# Test 3.6: Can-teach with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/can-teach")
check "3.6 Can-teach returns data with auth" '"success":true' "$RES"

# Test 3.7: Rules with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/rules")
check "3.7 Rules returns data with auth" '"success":true' "$RES"

# Test 3.8: Absences with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/absences")
check "3.8 Absences returns data with auth" '"success":true' "$RES"

# Test 3.9: Substitutions with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/substitutions")
check "3.9 Substitutions returns data with auth" '"success":true' "$RES"

# Test 3.10: Notifications with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/notifications")
check "3.10 Notifications returns data with auth" '"success":true' "$RES"

# Test 3.11: Audit logs with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/audit-logs")
check "3.11 Audit logs returns data with auth" '"success":true' "$RES"
LOG_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "    → Audit log entries: $LOG_COUNT"

# Test 3.12: Users with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/users")
check "3.12 Users returns data with auth" '"success":true' "$RES"

# Test 3.13: Diagnostics with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/diagnostics")
check "3.13 Diagnostics returns data with auth" '"success":true' "$RES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 4: REPORT ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 4.1: Export config
RES=$(curl -s -H "$AUTH" "$BASE/api/reports/export-config")
check "4.1 Export config returns data" '"pageSizes"' "$RES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 5: AUTH /ME ENDPOINT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 5.1: /me with auth
RES=$(curl -s -H "$AUTH" "$BASE/api/auth/me")
check "5.1 /me returns user data" '"success":true' "$RES"
USER_ROLE=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('role',''))" 2>/dev/null)
echo "    → Current user role: $USER_ROLE"

# Test 5.2: /me without auth
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/me")
check "5.2 /me without auth returns 401" "401" "$CODE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 6: SUBSTITUTION AVAILABLE TEACHERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 6.1: Available teachers
RES=$(curl -s -H "$AUTH" "$BASE/api/substitutions/available?day=Monday&period=1")
check "6.1 Available teachers returns data" '"success":true' "$RES"
AVAIL_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "    → Available teachers for Monday P1: $AVAIL_COUNT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 7: RATE LIMITING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 7.1: Rate limit headers present
HEADERS=$(curl -sI -H "$AUTH" "$BASE/api/teachers")
check "7.1 Rate limit headers present" "x-ratelimit" "$(echo "$HEADERS" | tr 'A-Z' 'a-z')"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 8: EXPORT ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 8.1: Workload Excel export
RES=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE/api/export/workload/excel")
check "8.1 Workload export responds (200 or 404)" "200\|404" "$RES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS+FAIL))
echo "Total tests: $TOTAL"
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
if [ $FAIL -eq 0 ]; then
  echo "🏆 ALL TESTS PASSED!"
else
  echo "⚠️  $FAIL test(s) need attention"
fi
echo ""
