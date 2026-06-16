#!/bin/bash
# V1.1 新功能专项测试 - 简化版
set -euo pipefail

BASE="http://localhost:3000/v1"
PASS=0; FAIL=0; TOTAL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo "  ✗ $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
check() { local code=$1 msg=$2 expected=$3; if [ "$code" = "$expected" ]; then pass "$msg"; else fail "$msg" "$expected" "$code"; fi; }

echo "╔══════════════════════════════════════════════════════╗"
echo "║     V1.1 新功能专项测试                            ║"
echo "╚══════════════════════════════════════════════════════╝"

# Login
LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"admin123"}')
LOGIN_CODE=$(echo "$LOGIN" | tail -1)
LOGIN_BODY=$(echo "$LOGIN" | head -n -1)
if [ "$LOGIN_CODE" != "200" ]; then
  echo "❌ Login failed (code: $LOGIN_CODE)"
  echo "Body: $LOGIN_BODY"
  exit 1
fi
TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ Token extraction failed"
  echo "Body: $LOGIN_BODY"
  exit 1
fi
echo "[INFO] Token acquired: ${TOKEN:0:20}..."

# ━━ F-24: 战情室 ━━
echo "━━━ F-24 战情室 ━━━"
DASH=$(curl -s -w "\n%{http_code}" "$BASE/dashboard" -H "Authorization: Bearer $TOKEN")
code=$(echo "$DASH" | tail -1)
dash_body=$(echo "$DASH" | head -n -1)
check "$code" "1.1 战情室API" "200"
echo "$dash_body" | grep -q '"stats"' && pass "1.2 stats字段" || fail "1.2 stats字段" "存在" "缺失"
echo "$dash_body" | grep -q '"projects"' && pass "1.3 projects字段" || fail "1.3 projects字段" "存在" "缺失"
echo "$dash_body" | grep -q '"memberLoads"' && pass "1.4 memberLoads字段" || fail "1.4 memberLoads字段" "存在" "缺失"
echo "$dash_body" | grep -q '"health"' && pass "1.5 health字段" || fail "1.5 health字段" "存在" "缺失"
echo "$dash_body" | grep -q '"total"' && pass "1.6 total统计" || fail "1.6 total统计" "存在" "缺失"

# ━━ F-25: 修图师待办 ━━
echo "━━━ F-25 修图师待办 ━━━"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/my-tasks" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "2.1 待办列表API" "200"
echo "$RESP" | grep -q '"data"' && pass "2.2 返回data" || fail "2.2 返回data" "存在" "缺失"

# ━━ F-17: 任务指派 ━━
echo "━━━ F-17 任务指派 ━━━"
# Use existing image to get/create cards
CARDS=$(curl -s -w "\n%{http_code}" "$BASE/images/img-001/comment-cards" -H "Authorization: Bearer $TOKEN")
code=$(echo "$CARDS" | tail -1)
check "$code" "3.1 获取图片卡片" "200"

CARD_ID=$(echo "$CARDS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$CARD_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/comment-cards/$CARD_ID/assign" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"assigneeId":"user-002"}')
  code=$(echo "$RESP" | tail -1)
  check "$code" "3.2 指派修图师" "200"

  body=$(echo "$RESP" | head -n -1)
  echo "$body" | grep -q '"assigneeId"' && pass "3.3 返回含assigneeId" || fail "3.3 返回含assigneeId" "存在" "缺失"
fi

# ━━ F-19: 通知 ━━
echo "━━━ F-19 通知系统 ━━━"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/notifications" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "4.1 通知列表API" "200"
echo "$RESP" | grep -q '"unread"' && pass "4.2 未读计数" || fail "4.2 未读计数" "存在" "缺失"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/notifications/read-all" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "4.3 全部已读" "200"

# ━━ F-19: 预警设置 ━━
echo "━━━ F-19 预警设置 ━━━"
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/projects/proj-002/warning-settings" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"warningHours":48}')
code=$(echo "$RESP" | tail -1)
check "$code" "5.1 预警设置" "200"

# ━━ F-16: AI筛选 ━━
echo "━━━ F-16 智能批量筛选 ━━━"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/proj-002/images/filter" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"query":"去雾"}')
code=$(echo "$RESP" | tail -1)
check "$code" "6.1 AI筛选API" "200"

body=$(echo "$RESP" | head -n -1)
echo "$body" | grep -q '"matched"' && pass "6.2 matched字段" || fail "6.2 matched字段" "存在" "缺失"
echo "$body" | grep -q '"suggestion"' && pass "6.3 suggestion字段" || fail "6.3 suggestion字段" "存在" "缺失"
echo "$body" | grep -q '"total"' && pass "6.4 total统计" || fail "6.4 total统计" "存在" "缺失"

# ━━ F-16: 行话模板库 ━━
echo "━━━ F-16 行话模板库 ━━━"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/jargon-templates" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "7.1 模板库API" "200"
echo "$RESP" | grep -q '"去雾"' && pass "7.2 包含去雾模板" || fail "7.2 包含去雾模板" "存在" "缺失"

# ━━ F-23: 项目模板 ━━
echo "━━━ F-23 项目流程模板 ━━━"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/templates" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "8.1 模板列表API" "200"
echo "$RESP" | grep -q '"电商白底图标准流程"' && pass "8.2 预置模板" || fail "8.2 预置模板" "存在" "缺失"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/templates" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"测试模板","description":"测试","assigneeMap":{"retouch":"user-002"},"deliveryRules":{"format":"jpg"}}')
code=$(echo "$RESP" | tail -1)
check "$code" "8.3 创建模板" "201"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/from-template/tpl-001" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"模板创建项目"}')
code=$(echo "$RESP" | tail -1)
check "$code" "8.4 基于模板创建" "201"

# ━━ F-18: 保护确稿 ━━
echo "━━━ F-18 保护型确稿 ━━━"
# Ensure project is completed before test
curl -s -X PUT "$BASE/projects/proj-002" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"completed"}' > /dev/null
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/proj-002/modify-request" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"reason":"需要调整"}')
code=$(echo "$RESP" | tail -1)
check "$code" "9.1 客户申请修改" "200"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/projects/proj-002/reject-confirm" -H "Authorization: Bearer $TOKEN")
code=$(echo "$RESP" | tail -1)
check "$code" "9.2 老板驳回确稿" "200"

# ━━ F-17: 争议处理 ━━
echo "━━━ F-17 争议预警 ━━━"
if [ -n "${CARD_ID:-}" ]; then
  curl -s -X PUT "$BASE/comment-cards/$CARD_ID/status" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"resolve"}' > /dev/null
  curl -s -X PUT "$BASE/comment-cards/$CARD_ID/status" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"unresolve"}' > /dev/null
  curl -s -X PUT "$BASE/comment-cards/$CARD_ID/status" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"resolve"}' > /dev/null
  RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/comment-cards/$CARD_ID/status" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"unresolve"}')
  code=$(echo "$RESP" | tail -1)
  check "$code" "10.1 反复重开" "200"

  body=$(echo "$RESP" | head -n -1)
  echo "$body" | grep -q '"disputed"' && pass "10.2 disputed字段" || fail "10.2 disputed字段" "存在" "缺失"
  echo "$body" | grep -q '"disputeCount"' && pass "10.3 disputeCount字段" || fail "10.3 disputeCount字段" "存在" "缺失"
fi

# ━━ F-26: AI全图一致性巡检 ━━
echo "━━━ F-26 光影一致性巡检 ━━━"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/ai/consistency-check" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"proj-001"}')
code=$(echo "$RESP" | tail -1)
check "$code" "11.1 启动一致性巡检" "200"
TID=$(echo "$RESP" | head -n -1 | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" "$BASE/ai/consistency-check/$TID" -H "Authorization: Bearer $TOKEN")
  code=$(echo "$RESP" | tail -1)
  check "$code" "11.2 获取巡检结果" "200"
  body=$(echo "$RESP" | head -n -1)
  echo "$body" | grep -q '"overallScore"' && pass "11.3 overallScore字段" || fail "11.3 overallScore字段" "存在" "缺失"
  echo "$body" | grep -q '"sceneGroups"' && pass "11.4 sceneGroups字段" || fail "11.4 sceneGroups字段" "存在" "缺失"
  echo "$body" | grep -q '"anomalies"' && pass "11.5 anomalies字段" || fail "11.5 anomalies字段" "存在" "缺失"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     V1.1 FEATURE TEST SUMMARY                      ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Passed:  %-43s║\n" "$PASS"
printf "║  Failed:  %-43s║\n" "$FAIL"
printf "║  Total:   %-43s║\n" "$TOTAL"
echo "╚══════════════════════════════════════════════════════╝"
if [ "$FAIL" -eq 0 ]; then echo "✅ ALL V1.1 TESTS PASSED"; else echo "❌ SOME TESTS FAILED"; fi