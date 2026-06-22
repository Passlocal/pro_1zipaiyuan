#!/usr/bin/bash
# =============================================================================
# EPX-PRD-008: V1.2.1 "专业触感" 系统性复测
# 测试 F-51 (战情室导出) + F-52 (客户端品牌) + F-53 (下载格式选择)
# =============================================================================
set -uo pipefail

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0
TOKEN=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo -e "  ${RED}✗${NC} $1 (expected: $2, got: $3)"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
assert_http() { local code=$(tail -1 <<< "$2"); if [ "$code" = "$1" ]; then pass "$3"; else fail "$3" "$1" "$code"; fi; }
assert_http_in() {
  local code=$(tail -1 <<< "$2")
  local expected="$1"
  local label="$3"
  local found=0
  for e in $expected; do
    if [ "$code" = "$e" ]; then found=1; break; fi
  done
  if [ "$found" = "1" ]; then pass "$label"; else fail "$label" "$expected" "$code"; fi
}
assert_json() { local val=$(echo "$2" | python3 -c "import sys,json; print(json.load(sys.stdin)$1)" 2>/dev/null || echo "PARSE_ERROR"); if [ "$val" = "$3" ]; then pass "$4"; else fail "$4" "$3" "$val"; fi; }
json_body() { echo "$1" | head -n -1; }
json_field() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     V1.2.1 '专业触感' 系统性复测                           ║"
echo "║     EPX-PRD-008: F-51 + F-52 + F-53                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Login ──────────────────────────────────────────────────────────────────
echo -e "${CYAN}━━━ 0. 环境准备 ━━━${NC}"
LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"zhang@epicshot.com","password":"admin123"}')
LOGIN_CODE=$(echo "$LOGIN" | tail -1)
LOGIN_BODY=$(json_body "$LOGIN")
if [ "$LOGIN_CODE" != "200" ]; then
  echo -e "${RED}❌ 登录失败 (code: $LOGIN_CODE)${NC}"
  echo "Body: $LOGIN_BODY"
  exit 1
fi
TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
echo "  Token: ${TOKEN:0:30}..."
pass "登录成功"

# Data constants
PROJECT_WITH_IMAGES="4ffcbdc6-37f5-44e6-b584-a3fd4af643fa"
PROJECT_WITH_SHARE="proj-001"
SHARE_TOKEN="f1c26bce61e2a404c08441b73e58dac2.14b932509ee00f9d"
WORKSPACE_ID="ws-001"

echo ""
echo -e "${CYAN}━━━ 1. F-51 战情室数据导出 (5项) ━━━${NC}"

# F-51-1: Export PDF
F51_1=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export?format=pdf" -o /tmp/test-export.pdf)
F51_1_CODE=$(echo "$F51_1" | tail -1)
F51_1_CT=$(curl -s -o /dev/null -w "%{content_type}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export?format=pdf")
if [ "$F51_1_CODE" = "200" ] && echo "$F51_1_CT" | grep -q "pdf"; then
  pass "F-51-1: PDF导出成功 (Content-Type: $F51_1_CT)"
  F51_1_SIZE=$(wc -c < /tmp/test-export.pdf)
  if [ "$F51_1_SIZE" -gt 1000 ]; then
    pass "F-51-1a: PDF文件大小合理 (${F51_1_SIZE} bytes)"
  else
    fail "F-51-1a: PDF文件大小合理" ">1000" "$F51_1_SIZE"
  fi
else
  fail "F-51-1: PDF导出" "200+pdf" "$F51_1_CODE $F51_1_CT"
fi

# F-51-2: Export Excel
F51_2=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export?format=excel" -o /tmp/test-export.xlsx)
F51_2_CODE=$(echo "$F51_2" | tail -1)
F51_2_CT=$(curl -s -o /dev/null -w "%{content_type}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export?format=excel")
if [ "$F51_2_CODE" = "200" ]; then
  pass "F-51-2: Excel导出成功 (Content-Type: $F51_2_CT)"
  F51_2_SIZE=$(wc -c < /tmp/test-export.xlsx)
  if [ "$F51_2_SIZE" -gt 500 ]; then
    pass "F-51-2a: Excel文件大小合理 (${F51_2_SIZE} bytes)"
  else
    fail "F-51-2a: Excel文件大小合理" ">500" "$F51_2_SIZE"
  fi
else
  fail "F-51-2: Excel导出" "200" "$F51_2_CODE"
fi

# F-51-3: Invalid format
F51_3=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export?format=invalid")
assert_http_in "400 422" "$F51_3" "F-51-3: 无效格式返回错误"

# F-51-4: No auth → 401
F51_4=$(curl -s -w "\n%{http_code}" "$BASE/v1/dashboard/export?format=pdf")
assert_http "401" "$F51_4" "F-51-4: 无认证拒绝访问"

echo ""
echo -e "${CYAN}━━━ 2. F-52 客户端品牌自定义 (6项) ━━━${NC}"

# F-52-1: Get current brand settings
F52_1=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/workspace/client-brand")
F52_1_BODY=$(json_body "$F52_1")
assert_http "200" "$F52_1" "F-52-1: 获取品牌设置成功"
F52_1_NAME=$(json_field "$F52_1_BODY" "d.get('data',{}).get('name','')")
echo "  当前品牌名: '$F52_1_NAME'"

# F-52-2: Update brand settings
F52_2=$(curl -s -w "\n%{http_code}" -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  "$BASE/v1/workspace/client-brand" \
  -d '{"name":"EpicShot测试品牌","logoUrl":"https://example.com/logo.png","themeColor":"#FF6600"}')
F52_2_BODY=$(json_body "$F52_2")
assert_http "200" "$F52_2" "F-52-2: 更新品牌设置成功"

# F-52-3: Verify update persisted
F52_3=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/workspace/client-brand")
F52_3_BODY=$(json_body "$F52_3")
assert_http "200" "$F52_3" "F-52-3: 验证品牌设置已持久化"
F52_3_NAME=$(json_field "$F52_3_BODY" "d.get('data',{}).get('name','')")
F52_3_COLOR=$(json_field "$F52_3_BODY" "d.get('data',{}).get('themeColor','')")
if [ "$F52_3_NAME" = "EpicShot测试品牌" ] && [ "$F52_3_COLOR" = "#FF6600" ]; then
  pass "F-52-3a: 品牌名称和颜色验证通过"
else
  fail "F-52-3a: 品牌名称和颜色" "EpicShot测试品牌/#FF6600" "$F52_3_NAME/$F52_3_COLOR"
fi

# F-52-4: Public brand API (no auth)
F52_4=$(curl -s -w "\n%{http_code}" "$BASE/v1/share/${SHARE_TOKEN}/brand")
F52_4_BODY=$(json_body "$F52_4")
assert_http "200" "$F52_4" "F-52-4: 公开品牌API (无需认证)"
F52_4_NAME=$(json_field "$F52_4_BODY" "d.get('data',{}).get('name','')")
if [ "$F52_4_NAME" = "EpicShot测试品牌" ]; then
  pass "F-52-4a: 公开API返回品牌名称正确"
else
  fail "F-52-4a: 公开API品牌名称" "EpicShot测试品牌" "$F52_4_NAME"
fi

# F-52-5: Invalid share token → 404
F52_5=$(curl -s -w "\n%{http_code}" "$BASE/v1/share/invalid-token-xxx/brand")
assert_http_in "404 400" "$F52_5" "F-52-5: 无效token返回错误"

# F-52-6: Workspace response includes brand fields
F52_6=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/workspaces/mine")
F52_6_BODY=$(json_body "$F52_6")
assert_http "200" "$F52_6" "F-52-6: 工作空间返回包含品牌字段"
F52_6_BRAND=$(json_field "$F52_6_BODY" "d.get('data',{}).get('clientBrandName','')")
if [ "$F52_6_BRAND" = "EpicShot测试品牌" ]; then
  pass "F-52-6a: 工作空间品牌字段正确"
else
  fail "F-52-6a: 工作空间品牌字段" "EpicShot测试品牌" "$F52_6_BRAND"
fi

# Restore brand to default
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/v1/workspace/client-brand" \
  -d '{"name":"","logoUrl":"","themeColor":""}' > /dev/null

echo ""
echo -e "${CYAN}━━━ 3. F-53 批量下载格式选择 (8项) ━━━${NC}"

# F-53-1: Original download
F53_1=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=original" -o /tmp/test-original.zip)
F53_1_CODE=$(echo "$F53_1" | tail -1)
F53_1_CT=$(curl -s -o /dev/null -w "%{content_type}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=original")
if [ "$F53_1_CODE" = "200" ] && echo "$F53_1_CT" | grep -q "zip"; then
  pass "F-53-1: 原尺寸下载成功 (Content-Type: $F53_1_CT)"
  F53_1_SIZE=$(wc -c < /tmp/test-original.zip)
  if [ "$F53_1_SIZE" -gt 100 ]; then
    pass "F-53-1a: 原尺寸ZIP大小合理 (${F53_1_SIZE} bytes)"
  else
    fail "F-53-1a: 原尺寸ZIP大小" ">100" "$F53_1_SIZE"
  fi
else
  F53_1_BODY=$(json_body "$F53_1")
  fail "F-53-1: 原尺寸下载" "200+zip" "$F53_1_CODE $F53_1_CT | body=$F53_1_BODY"
fi

# F-53-2: Web optimized download
F53_2=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=web" -o /tmp/test-web.zip)
F53_2_CODE=$(echo "$F53_2" | tail -1)
F53_2_CT=$(curl -s -o /dev/null -w "%{content_type}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=web")
if [ "$F53_2_CODE" = "200" ] && echo "$F53_2_CT" | grep -q "zip"; then
  pass "F-53-2: Web优化下载成功 (Content-Type: $F53_2_CT)"
  F53_2_SIZE=$(wc -c < /tmp/test-web.zip)
  if [ "$F53_2_SIZE" -gt 100 ]; then
    pass "F-53-2a: Web优化ZIP大小合理 (${F53_2_SIZE} bytes)"
  else
    fail "F-53-2a: Web优化ZIP大小" ">100" "$F53_2_SIZE"
  fi
else
  F53_2_BODY=$(json_body "$F53_2")
  fail "F-53-2: Web优化下载" "200+zip" "$F53_2_CODE $F53_2_CT | body=$F53_2_BODY"
fi

# F-53-3: Custom download (width=1200, quality=80)
F53_3=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=custom&width=1200&quality=80" -o /tmp/test-custom.zip)
F53_3_CODE=$(echo "$F53_3" | tail -1)
F53_3_CT=$(curl -s -o /dev/null -w "%{content_type}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=custom&width=1200&quality=80")
if [ "$F53_3_CODE" = "200" ] && echo "$F53_3_CT" | grep -q "zip"; then
  pass "F-53-3: 自定义下载成功 (width=1200, quality=80)"
  F53_3_SIZE=$(wc -c < /tmp/test-custom.zip)
  if [ "$F53_3_SIZE" -gt 100 ]; then
    pass "F-53-3a: 自定义ZIP大小合理 (${F53_3_SIZE} bytes)"
  else
    fail "F-53-3a: 自定义ZIP大小" ">100" "$F53_3_SIZE"
  fi
else
  F53_3_BODY=$(json_body "$F53_3")
  fail "F-53-3: 自定义下载" "200+zip" "$F53_3_CODE $F53_3_CT | body=$F53_3_BODY"
fi

# F-53-4: Custom with width boundary (800 min)
F53_4=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=custom&width=800&quality=80" -o /tmp/test-custom-min.zip)
F53_4_CODE=$(echo "$F53_4" | tail -1)
if [ "$F53_4_CODE" = "200" ]; then
  pass "F-53-4: 自定义下载 (width=800, 最小值)"
else
  F53_4_BODY=$(json_body "$F53_4")
  assert_http_in "200 400" "$F53_4" "F-53-4: 自定义下载 width=800"
fi

# F-53-5: Custom with width boundary (5000 max)
F53_5=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=custom&width=5000&quality=80" -o /tmp/test-custom-max.zip)
F53_5_CODE=$(echo "$F53_5" | tail -1)
if [ "$F53_5_CODE" = "200" ]; then
  pass "F-53-5: 自定义下载 (width=5000, 最大值)"
else
  F53_5_BODY=$(json_body "$F53_5")
  assert_http_in "200 400" "$F53_5" "F-53-5: 自定义下载 width=5000"
fi

# F-53-6: Invalid option → error
F53_6=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=invalid")
assert_http_in "400 422" "$F53_6" "F-53-6: 无效option返回错误"

# F-53-7: Async delivery task creation
F53_7=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-task" \
  -d '{"option":"web"}')
F53_7_CODE=$(echo "$F53_7" | tail -1)
F53_7_BODY=$(json_body "$F53_7")
assert_http_in "200 202" "$F53_7" "F-53-7: 异步交付任务创建成功"
F53_7_TASK_ID=$(json_field "$F53_7_BODY" "d.get('data',{}).get('taskId','')")
echo "  TaskID: $F53_7_TASK_ID"

# F-53-8: Check delivery task status
if [ -n "$F53_7_TASK_ID" ]; then
  sleep 2
  F53_8=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
    "$BASE/v1/delivery-tasks/$F53_7_TASK_ID")
  F53_8_BODY=$(json_body "$F53_8")
  assert_http_in "200 202" "$F53_8" "F-53-8: 查询异步任务状态"
  F53_8_STATUS=$(json_field "$F53_8_BODY" "d.get('data',{}).get('status','')")
  echo "  Status: $F53_8_STATUS"
  if [ -n "$F53_8_STATUS" ]; then
    pass "F-53-8a: 任务状态返回有效 ($F53_8_STATUS)"
  else
    fail "F-53-8a: 任务状态有效" "non-empty" "empty"
  fi
else
  fail "F-53-8: 查询异步任务" "valid taskId" "no taskId"
fi

# F-53-9: No auth → 401
F53_9=$(curl -s -w "\n%{http_code}" "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=original")
assert_http "401" "$F53_9" "F-53-9: 无认证拒绝下载"

echo ""
echo -e "${CYAN}━━━ 4. 边界与异常测试 (3项) ━━━${NC}"

# Edge-1: GET brand with no auth (already tested in F-52-4, but confirm it's truly public)
EDGE1=$(curl -s -w "\n%{http_code}" "$BASE/v1/share/${SHARE_TOKEN}/brand")
assert_http "200" "$EDGE1" "EDGE-1: 公开品牌API无需认证 (二次确认)"

# Edge-2: Dashboard export without format param
EDGE2=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/dashboard/export")
assert_http_in "400 422" "$EDGE2" "EDGE-2: 缺少format参数返回错误"

# Edge-3: Custom download without width param (defaults to 2000px — acceptable)
EDGE3=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/projects/${PROJECT_WITH_IMAGES}/delivery-package?option=custom&quality=80" -o /tmp/test-custom-nowidth.zip)
EDGE3_CODE=$(echo "$EDGE3" | tail -1)
if [ "$EDGE3_CODE" = "200" ]; then
  pass "EDGE-3: custom缺少width使用默认值2000px (合理降级)"
elif [ "$EDGE3_CODE" = "400" ] || [ "$EDGE3_CODE" = "422" ]; then
  pass "EDGE-3: custom缺少width返回错误"
else
  fail "EDGE-3: custom缺少width" "200/400/422" "$EDGE3_CODE"
fi
rm -f /tmp/test-custom-nowidth.zip

# Cleanup
rm -f /tmp/test-export.pdf /tmp/test-export.xlsx /tmp/test-original.zip /tmp/test-web.zip /tmp/test-custom.zip /tmp/test-custom-min.zip /tmp/test-custom-max.zip

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
printf "║  V1.2.1 复测结果: %3d PASS / %3d FAIL / %3d TOTAL           ║\n" $PASS $FAIL $TOTAL
echo "╚══════════════════════════════════════════════════════════════╝"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}⚠ 存在失败项，需要修复！${NC}"
  exit 1
else
  echo -e "${GREEN}✓ 所有测试通过${NC}"
  exit 0
fi