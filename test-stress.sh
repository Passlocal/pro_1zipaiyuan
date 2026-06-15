#!/usr/bin/env bash
# =============================================================================
# EpicShot Stress Test — Production Load Testing
# 使用 curl 进行逐步递增的并发压力测试
# =============================================================================
set -uo pipefail
trap 'kill $(jobs -p) 2>/dev/null' EXIT

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1 ${RED}(expected: $2, got: $3)${NC}"; FAIL=$((FAIL+1)); }
info() { echo -e "  ${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

echo "╔══════════════════════════════════════════════════════╗"
echo "║     EpicShot 压力测试 — Production Load Test       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Target: $BASE"
echo "Started: $TIMESTAMP"
echo ""

# ── Step 1: Health Check + Login ──
echo "━━━ 1. 前置准备 ━━━"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health" --connect-timeout 5)
if [ "$CODE" != "200" ]; then
  warn "Server not reachable (HTTP $CODE). Make sure the backend is running."
  echo "SKIP=true"
  exit 0
fi
pass "1.1 Health check → 200"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"zhang@epicshot.com","password":"admin123"}' --connect-timeout 5)
TOKEN=$(echo "$RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
  warn "Login failed. Make sure the backend is properly seeded."
  echo "SKIP=true"
  exit 0
fi
pass "1.2 Login → acquired token"

# Create test project
CRESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/v1/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"压力测试项目","description":"stress-test"}' --connect-timeout 5)
PROJECT_ID=$(echo "$CRESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
CRESP_CODE=$(echo "$CRESP" | tail -1)
if [ -n "$PROJECT_ID" ]; then
  pass "1.3 Test project created → $PROJECT_ID"
else
  warn "Project creation failed (HTTP $CRESP_CODE). Continuing without test project."
fi

# ── Step 2: Ramp-Up Load Test ──
echo ""
echo "━━━ 2. 递增加载 — Ramp-Up Load Test ━━━"

for CONCURRENCY in 10 25 50 100; do
  echo -n "  [INFO] $CONCURRENCY 并发请求... "
  START_TS=$(date +%s%3N)
  
  # Run concurrent requests, collect status codes
  TMPDIR=$(mktemp -d)
  for i in $(seq 1 $CONCURRENCY); do
    (curl -s -o /dev/null -w "%{http_code}" -X GET \
      -H "Authorization: Bearer $TOKEN" \
      "$BASE/v1/projects" \
      --connect-timeout 5 --max-time 10 > "$TMPDIR/out_$i" 2>/dev/null) &
  done
  wait
  
  END_TS=$(date +%s%3N)
  DURATION=$((END_TS - START_TS))
  
  # Count results
  OK=0
  ERR=0
  for i in $(seq 1 $CONCURRENCY); do
    C=$(cat "$TMPDIR/out_$i" 2>/dev/null)
    if [ "$C" = "200" ]; then
      OK=$((OK+1))
    else
      ERR=$((ERR+1))
    fi
  done
  rm -rf "$TMPDIR"
  
  RPS=$(awk "BEGIN { printf \"%.1f\", $CONCURRENCY / ($DURATION / 1000) }")
  
  if [ $ERR -eq 0 ]; then
    echo -e "${GREEN}全部 200${NC} | ${DURATION}ms | ${RPS} req/s"
    pass "2.$CONCURRENCY ${CONCURRENCY}并发 → 0 错误"
  else
    echo -e "${RED}$OK 成功 / $ERR 失败${NC} | ${DURATION}ms | ${RPS} req/s"
    ERR_PCT=$(awk "BEGIN { printf \"%.1f\", ($ERR / $CONCURRENCY) * 100 }")
    fail "2.$CONCURRENCY ${CONCURRENCY}并发" "0 错误" "$ERR 错误 (${ERR_PCT}%)"
  fi
done

# ── Step 3: Steady-State Load (Sustained) ──
echo ""
echo "━━━ 3. 持续负载 — Sustained Load Test ━━━"
echo -n "  [INFO] 持续 10 秒 @ 20 req/s ... "

START_TS=$(date +%s%3N)
TMPDIR_SUS=$(mktemp -d)
TOTAL_SUS=0
OK_SUS=0

ENDTIME=$(( $(date +%s) + 10 ))
while [ $(date +%s) -lt $ENDTIME ]; do
  (curl -s -o /dev/null -w "%{http_code}" -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE/v1/projects" \
    --connect-timeout 5 --max-time 10 > "$TMPDIR_SUS/sus_$TOTAL_SUS" 2>/dev/null) &
  TOTAL_SUS=$((TOTAL_SUS+1))
  sleep 0.05
done
wait

END_TS=$(date +%s%3N)
DURATION=$((END_TS - START_TS))

for i in $(seq 0 $((TOTAL_SUS-1))); do
  C=$(cat "$TMPDIR_SUS/sus_$i" 2>/dev/null)
  [ "$C" = "200" ] && OK_SUS=$((OK_SUS+1))
done
rm -rf "$TMPDIR_SUS"

AVG_RPS=$(awk "BEGIN { printf \"%.1f\", $TOTAL_SUS / ($DURATION / 1000) }")
ERR_SUS=$((TOTAL_SUS - OK_SUS))

if [ $ERR_SUS -eq 0 ]; then
  echo -e "${GREEN}全部通过${NC} | ${DURATION}ms | ${AVG_RPS} req/s"
  pass "3.1 持续负载 ${TOTAL_SUS} 请求 → 0 错误"
else
  echo -e "${RED}$OK_SUS 成功 / $ERR_SUS 失败${NC} | ${DURATION}ms | ${AVG_RPS} req/s"
  ERR_PCT=$(awk "BEGIN { printf \"%.1f\", ($ERR_SUS / $TOTAL_SUS) * 100 }")
  fail "3.1 持续负载 ${TOTAL_SUS} 请求" "0 错误" "$ERR_SUS 错误 (${ERR_PCT}%)"
fi

# ── Step 4: Write Contention ──
echo ""
echo "━━━ 4. 写操作竞态 — Write Contention Test ━━━"
echo -n "  [INFO] 10 次并发创建项目 ... "

TMPDIR_WR=$(mktemp -d)
for i in $(seq 1 10); do
  (curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"竞态测试-$i\",\"description\":\"race-$i\"}" \
    "$BASE/v1/projects" \
    --connect-timeout 5 --max-time 10 > "$TMPDIR_WR/wr_$i" 2>/dev/null) &
done
wait

OK_WR=0
ERR_WR=0
for i in $(seq 1 10); do
  C=$(cat "$TMPDIR_WR/wr_$i" 2>/dev/null)
  if [ "$C" = "201" ]; then
    OK_WR=$((OK_WR+1))
  else
    ERR_WR=$((ERR_WR+1))
  fi
done
rm -rf "$TMPDIR_WR"

if [ $ERR_WR -eq 0 ]; then
  echo -e "${GREEN}全部 201${NC}"
  pass "4.1 10 并发创建项目 → 全部 201"
else
  echo -e "${RED}$OK_WR 成功 / $ERR_WR 失败${NC}"
  fail "4.1 10 并发创建项目" "10 成功" "$OK_WR 成功"
fi

# Cleanup test project
if [ -n "$PROJECT_ID" ]; then
  curl -s -o /dev/null -X DELETE "$BASE/v1/projects/$PROJECT_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d '{}' --connect-timeout 5
fi

# Debug: show a sample of structured log output
echo ""
echo "━━━ Log Sample (last 5 structured entries) ━━━"
cat /tmp/be.log 2>/dev/null | grep '"level":"INFO"' | tail -3

# ── Summary ──
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     压力测试结果                                    ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  %-50s ║\n" "Passed: $PASS"
printf "║  %-50s ║\n" "Failed: $FAIL"
TOTAL=$((PASS+FAIL))
printf "║  %-50s ║\n" "Total:  $TOTAL"
echo "╚══════════════════════════════════════════════════════╝"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Some tests failed. Check the logs above for details."
  exit 1
else
  echo ""
  echo "All stress tests passed."
  exit 0
fi