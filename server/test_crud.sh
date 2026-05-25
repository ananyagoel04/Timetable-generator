#!/bin/bash
BASE="http://localhost:5001"
PASS=0; FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✅ $name"; PASS=$((PASS+1))
  else
    echo "  ❌ $name → $(echo "$actual" | head -1 | cut -c1-100)"; FAIL=$((FAIL+1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    CRUD + Data Flow Test Suite                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Login
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
AUTH="Authorization: Bearer $TOKEN"

echo "━━━ SECTION A: TEACHER CRUD ━━━"
# Create teacher
RES=$(curl -s -X POST "$BASE/api/teachers" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Test Teacher QA","email":"test.qa@school.edu","maxPeriodsPerDay":6,"maxPeriodsPerWeek":30,"department":"Math"}')
check "A1. Create teacher" '"success":true' "$RES"
TEACHER_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('_id',''))" 2>/dev/null)
echo "     Created teacher ID: $TEACHER_ID"

# Read teacher
RES=$(curl -s -H "$AUTH" "$BASE/api/teachers")
check "A2. List teachers returns data" '"success":true' "$RES"

# Update teacher
if [ -n "$TEACHER_ID" ]; then
  RES=$(curl -s -X PUT "$BASE/api/teachers/$TEACHER_ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Test Teacher QA Updated","maxPeriodsPerDay":7}')
  check "A3. Update teacher" '"success":true' "$RES"
  
  # Verify update
  UPDATED_NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('name',''))" 2>/dev/null)
  check "A4. Updated name is correct" "QA Updated" "$UPDATED_NAME"
  
  # Delete teacher
  RES=$(curl -s -X DELETE "$BASE/api/teachers/$TEACHER_ID" -H "$AUTH")
  check "A5. Delete teacher" '"success":true' "$RES"
fi

echo ""
echo "━━━ SECTION B: CLASS CRUD ━━━"
# Create class
RES=$(curl -s -X POST "$BASE/api/classes" -H "$AUTH" -H "Content-Type: application/json" -d '{"grade":11,"section":"QA","studentCount":30,"stream":"Science"}')
check "B1. Create class" '"success":true' "$RES"
CLASS_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('_id',''))" 2>/dev/null)

if [ -n "$CLASS_ID" ]; then
  RES=$(curl -s -X DELETE "$BASE/api/classes/$CLASS_ID" -H "$AUTH")
  check "B2. Delete class" '"success":true' "$RES"
fi

echo ""
echo "━━━ SECTION C: SUBJECT CRUD ━━━"
RES=$(curl -s -X POST "$BASE/api/subjects" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"QA Test Subject","code":"QA001","category":"academic","maxPerDay":2}')
check "C1. Create subject" '"success":true' "$RES"
SUBJECT_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('_id',''))" 2>/dev/null)

if [ -n "$SUBJECT_ID" ]; then
  RES=$(curl -s -X DELETE "$BASE/api/subjects/$SUBJECT_ID" -H "$AUTH")
  check "C2. Delete subject" '"success":true' "$RES"
fi

echo ""
echo "━━━ SECTION D: ROOM CRUD ━━━"
RES=$(curl -s -X POST "$BASE/api/rooms" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"QA Test Room","type":"classroom","capacity":40}')
check "D1. Create room" '"success":true' "$RES"
ROOM_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('_id',''))" 2>/dev/null)

if [ -n "$ROOM_ID" ]; then
  RES=$(curl -s -X DELETE "$BASE/api/rooms/$ROOM_ID" -H "$AUTH")
  check "D2. Delete room" '"success":true' "$RES"
fi

echo ""
echo "━━━ SECTION E: AUDIT LOG VERIFICATION ━━━"
RES=$(curl -s -H "$AUTH" "$BASE/api/audit-logs?limit=5")
check "E1. Audit logs captured" '"success":true' "$RES"
LOG_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
echo "     Total audit entries: $LOG_COUNT"

echo ""
echo "━━━ SECTION F: DIAGNOSTICS ━━━"
RES=$(curl -s -H "$AUTH" "$BASE/api/diagnostics/health")
check "F1. System health" '"success":true' "$RES"
STATUS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
DB=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['dbStatus'])" 2>/dev/null)
MEM=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['memoryUsageMb']; print(f'RSS={d[\"rss\"]}MB, Heap={d[\"heapUsed\"]}MB')" 2>/dev/null)
echo "     Status: $STATUS, DB: $DB, Memory: $MEM"

echo ""
echo "━━━ SECTION G: EXPORT ━━━"
RES=$(curl -s -o /dev/null -w "%{http_code}|%{size_download}" -H "$AUTH" "$BASE/api/export/workload/excel")
CODE=$(echo "$RES" | cut -d'|' -f1)
SIZE=$(echo "$RES" | cut -d'|' -f2)
check "G1. Workload Excel export" "200" "$CODE"
echo "     Export file size: $SIZE bytes"

echo ""
echo "━━━ SECTION H: FORGOT PASSWORD FLOW ━━━"
RES=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu"}')
check "H1. Forgot password returns token" "resetToken" "$RES"
RESET_TOKEN=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('resetToken',''))" 2>/dev/null)
echo "     Token: ${RESET_TOKEN:0:16}..."

# Test reset password with valid token (reset to same password)
RES=$(curl -s -X POST "$BASE/api/auth/reset-password" -H "Content-Type: application/json" -d "{\"email\":\"admin@dps.edu\",\"resetToken\":\"$RESET_TOKEN\",\"newPassword\":\"admin123\"}")
check "H2. Reset password succeeds" '"success":true' "$RES"

# Verify can login with new password
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dps.edu","password":"admin123"}')
check "H3. Login works after reset" '"success":true' "$RES"

echo ""
echo "━━━ SECTION I: SUBSTITUTION SUGGESTIONS ━━━"
RES=$(curl -s -H "$AUTH" "$BASE/api/substitutions/available?day=Monday&period=1")
check "I1. Available substitutes" '"success":true' "$RES"
AVAIL=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"count\"]} available')" 2>/dev/null)
echo "     $AVAIL"

# Check scoring
HAS_SCORE=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d['data'][0] if d['data'] else {}; print('yes' if 'suitabilityScore' in t else 'no')" 2>/dev/null)
check "I2. Suitability scores present" "yes" "$HAS_SCORE"

echo ""
echo "━━━ SECTION J: PERIOD STRUCTURE ━━━"
RES=$(curl -s -H "$AUTH" "$BASE/api/periods")
check "J1. Period structure returns data" '"success":true' "$RES"

echo ""
echo "━━━ SECTION K: CAN-TEACH ━━━"
RES=$(curl -s -H "$AUTH" "$BASE/api/can-teach")
check "K1. Can-teach returns data" '"success":true' "$RES"
CT_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "     Can-teach mappings: $CT_COUNT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS+FAIL))
echo "Total: $TOTAL | ✅ Passed: $PASS | ❌ Failed: $FAIL"
echo ""
