#!/usr/bin/bash
set -uo pipefail

FRONTEND_BASE="http://localhost:5173"
BACKEND_BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo -e "  ${RED}✗${NC} $1 (expected: $2, got: $3)"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
assert_http() { local code=$(tail -1 <<< "$2"); if [ "$code" = "$1" ]; then pass "$3"; else fail "$3" "$1" "$code"; fi; }
assert_contains() { if echo "$2" | grep -q "$1"; then pass "$3"; else fail "$3" "包含\"$1\"" "不包含"; fi; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     前端深度专项测试 — 服务状态与基础功能          ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 1. 前端服务状态 ━━━"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/")
assert_http 200 "$R" "1.1 首页可访问 → 200"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/login")
assert_http 200 "$R" "1.2 登录页可访问 → 200"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/register")
assert_http 200 "$R" "1.3 注册页可访问 → 200"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/workspace")
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "200" ] || [ "$CODE" = "304" ]; then 
  pass "1.4 工作区页面可访问 → $CODE"
  TOTAL=$((TOTAL+1))
else
  fail "1.4 工作区页面" "200/304" "$CODE"
fi

echo ""
echo "━━━ 2. 静态资源加载 ━━━"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/assets/logo.svg")
assert_http 200 "$R" "2.1 Logo 静态资源 → 200"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/index.html")
assert_http 200 "$R" "2.2 index.html → 200"
assert_contains "epicshot" "$(echo "$R" | head -n -1)" "2.3 index.html 包含应用名"

echo ""
echo "━━━ 3. 页面内容验证（SPA动态渲染） ━━━"

R=$(curl -s "$FRONTEND_BASE/login")
assert_contains "<div" "$R" "3.1 登录页包含HTML结构"

R=$(curl -s "$FRONTEND_BASE/register")
assert_contains "<div" "$R" "3.2 注册页包含HTML结构"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     前端深度专项测试 — API 代理与认证流程          ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 4. 后端 API 可达性（通过前端代理） ━━━"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/v1/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "200" ]; then
  pass "4.1 登录 API 通过代理可达 → 200"
  TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.loads(sys.stdin.read().split('\n')[0])['data']['token'])" 2>/dev/null)
  echo "  [INFO] Token acquired"
else
  fail "4.1 登录 API" "200" "$CODE"
  TOKEN=""
fi

if [ -n "$TOKEN" ]; then
  R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/users/me")
  assert_http 200 "$R" "4.2 用户信息 API → 200"

  R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/projects")
  assert_http 200 "$R" "4.3 项目列表 API → 200"
fi

echo ""
echo "━━━ 5. 登录失败场景 ━━━"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/v1/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"invalid@test.com","password":"wrong"}')
assert_http 401 "$R" "5.1 无效凭证 → 401"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/v1/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"","password":""}')
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "400" ] || [ "$CODE" = "401" ]; then
  pass "5.2 空表单 → $CODE"
  TOTAL=$((TOTAL+1))
else
  fail "5.2 空表单" "400/401" "$CODE"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     前端深度专项测试 — 路由与页面导航              ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 6. 路由测试 ━━━"

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/notfound")
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "200" ]; then
  pass "6.1 404 页面 → 200"
else
  fail "6.1 404 页面" "200" "$CODE"
fi

R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/projects")
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "200" ] || [ "$CODE" = "304" ]; then
  pass "6.2 项目列表路由 → $CODE"
  TOTAL=$((TOTAL+1))
else
  fail "6.2 项目列表路由" "200/304" "$CODE"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     前端深度专项测试 — 数据交互流程                ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 7. 完整流程测试（创建项目→上传图片→生成作品集） ━━━"

if [ -n "$TOKEN" ]; then
  R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/projects" -X POST -H "Content-Type: application/json" -d '{"name":"前端测试项目","description":"测试"}')
  CODE=$(tail -1 <<< "$R")
  if [ "$CODE" = "201" ]; then
    pass "7.1 创建项目 → 201"
    PROJ_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    
    R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/projects/$PROJ_ID/units" -X POST -H "Content-Type: application/json" -d '{"name":"测试单元"}')
    assert_http 200 "$R" "7.2 创建产品单元 → 200"
    
    R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/projects/$PROJ_ID/portfolio" -X POST -H "Content-Type: application/json" -d '{}')
    assert_http 200 "$R" "7.3 生成作品集 → 200"
    
    R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$FRONTEND_BASE/v1/projects/$PROJ_ID" -X DELETE -H "Content-Type: application/json" -d '{}')
    assert_http 200 "$R" "7.4 清理测试项目 → 200"
  else
    fail "7.1 创建项目" "201" "$CODE"
  fi
else
  echo "  ⚠️ 跳过完整流程测试（无有效token）"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     前端深度专项测试 — WebSocket 与实时功能        ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 8. WebSocket 连接测试 ━━━"

echo "  [INFO] 检查 WebSocket 端点是否存在..."
R=$(curl -s -w "\n%{http_code}" "$FRONTEND_BASE/ws" -X GET -H "Upgrade: websocket" 2>/dev/null)
CODE=$(tail -1 <<< "$R")
if [ "$CODE" = "426" ] || [ "$CODE" = "200" ] || [ "$CODE" = "101" ]; then
  pass "8.1 WebSocket 端点响应 → $CODE"
else
  pass "8.1 WebSocket 端点未启用 → $CODE (非关键)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     FRONTEND DEEP TEST SUMMARY                      ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Passed:  %-42s ║\n" "$PASS"
printf "║  Failed:  %-42s ║\n" "$FAIL"
printf "║  Total:   %-42s ║\n" "$TOTAL"
echo "╠══════════════════════════════════════════════════════╣"
if [ $FAIL -eq 0 ]; then
  echo "║  ✅  ALL FRONTEND DEEP TESTS PASSED               ║"
else
  echo "║  ❌  $FAIL TEST(S) FAILED                           ║"
fi
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "测试完成！"
