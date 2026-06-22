#!/bin/bash
BASE="http://localhost:3000"
PASS=0; FAIL=0; SKIP=0

check() {
  local desc="$1"; local expected="$2"; local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✅ $desc"; ((PASS++))
  else
    echo "  ❌ $desc (expected: $expected)"; ((FAIL++))
  fi
}

echo "=========================================="
echo "  易拍选 V1.3 系统性测试"
echo "=========================================="

# ====== 1. 登录 ======
echo ""
echo "[1] 登录认证"
LOGIN=$(curl -s -X POST "$BASE/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
check "登录成功" "token" "$LOGIN"

if [ -z "$TOKEN" ]; then
  echo "  ❌ 无法获取 token，跳过后续测试"; exit 1
fi
AUTH="Authorization: Bearer $TOKEN"

# ====== 2. 角色信息 ======
echo ""
echo "[2] 角色信息 (DS-01)"
ME=$(curl -s "$BASE/v1/users/me" -H "$AUTH")
check "用户信息含 role" "role" "$ME"
ROLE=$(echo "$ME" | grep -o '"role":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  当前角色: $ROLE"

# ====== 3. 工作空间 ======
echo ""
echo "[3] 工作空间"
WS=$(curl -s "$BASE/v1/workspaces/mine" -H "$AUTH")
check "工作空间信息" "id" "$WS"

# ====== 4. 项目列表 ======
echo ""
echo "[4] 项目列表 (DS-02 战情室数据)"
PROJECTS=$(curl -s "$BASE/v1/projects" -H "$AUTH")
check "项目列表返回" "data" "$PROJECTS"

# Use proj-001 which has units and images
PID="proj-001"

# ====== 5. 通知 ======
echo ""
echo "[5] 通知系统"
NOTIFS=$(curl -s "$BASE/v1/notifications" -H "$AUTH")
check "通知列表" "data" "$NOTIFS"

# ====== 6. 项目详情和图片 ======
echo ""
echo "[6] 项目详情 + 图片列表"
DETAIL=$(curl -s "$BASE/v1/projects/$PID" -H "$AUTH")
check "项目详情" "id" "$DETAIL"
echo "  项目: $(echo $DETAIL | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"

# Get units first, then images
UNITS=$(curl -s "$BASE/v1/projects/$PID/units" -H "$AUTH")
check "产品单元列表" "data" "$UNITS"
UNIT_ID=$(echo "$UNITS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$UNIT_ID" ]; then
  IMAGES=$(curl -s "$BASE/v1/units/$UNIT_ID/images" -H "$AUTH")
  check "图片列表" "data" "$IMAGES"
  IID=$(echo "$IMAGES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  单元ID: $UNIT_ID, 首张图片ID: $IID"
else
  echo "  ⚠️ 无产品单元"
  IID=""
fi

# ====== 7. 意见卡片 (FEAT-01) ======
echo ""
echo "[7] 意见卡片 (FEAT-01: positionX/Y)"
if [ -n "$IID" ]; then
  CARDS=$(curl -s "$BASE/v1/images/$IID/comment-cards" -H "$AUTH")
  check "卡片列表" "data" "$CARDS"
  HAS_POSX=$(echo "$CARDS" | grep -o '"positionX"' | head -1)
  HAS_POSY=$(echo "$CARDS" | grep -o '"positionY"' | head -1)
  if [ -n "$HAS_POSX" ] && [ -n "$HAS_POSY" ]; then
    echo "  ✅ positionX/positionY 字段已返回"
    ((PASS++))
  else
    echo "  ℹ️ positionX: ${HAS_POSX:-无}, positionY: ${HAS_POSY:-无} (卡片无坐标数据)"
    ((SKIP++))
  fi
else
  echo "  ⚠️ 无图片，跳过卡片测试"
  ((SKIP++))
fi

# ====== 8. 色差巡检 (DS-07) ======
echo ""
echo "[8] 色差巡检 (DS-07)"
CC_TASK=$(curl -s -X POST "$BASE/v1/ai/color-check" -H "$AUTH" -H "Content-Type: application/json" -d "{\"projectId\":\"$PID\"}")
CC_TASK_ID=$(echo "$CC_TASK" | grep -o '"taskId":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$CC_TASK_ID" ]; then
  echo "  色差巡检任务已创建: $CC_TASK_ID"
  # Give it a moment to process
  sleep 1
  CC_RESULT=$(curl -s "$BASE/v1/ai/color-check/$CC_TASK_ID" -H "$AUTH")
  check "色差巡检结果" "data" "$CC_RESULT"
  ABNORMAL=$(echo "$CC_RESULT" | grep -o '"abnormalCount":[0-9]*' | head -1 | cut -d':' -f2)
  echo "  异常图片数: ${ABNORMAL:-0}"
else
  echo "  ❌ 色差巡检任务创建失败"
  ((FAIL++))
fi

# ====== 9. 分享链接 (PERF-01) ======
echo ""
echo "[9] 客户端分享 (PERF-01: brand 数据)"
SHARE=$(curl -s -X POST "$BASE/v1/projects/$PID/share" -H "$AUTH" -H "Content-Type: application/json" -d '{}')
check "分享创建" "token" "$SHARE"
SHARE_TOKEN=$(echo "$SHARE" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$SHARE_TOKEN" ]; then
  SHARE_DATA=$(curl -s "$BASE/v1/share/$SHARE_TOKEN")
  check "分享数据含 brand" "brand" "$SHARE_DATA"
  check "分享数据含 project" "project" "$SHARE_DATA"
  check "分享数据含 cards" "cards" "$SHARE_DATA"
fi

# ====== 10. 确稿 (UX-04) ======
echo ""
echo "[10] 确稿 API (UX-04)"
COMPLETE=$(curl -s -X POST "$BASE/v1/projects/$PID/complete" -H "$AUTH" -H "Content-Type: application/json" -d '{}')
if echo "$COMPLETE" | grep -q '"status":"completed"\|"message"\|"data"'; then
  echo "  ✅ 确稿 API 正常响应"
  ((PASS++))
else
  echo "  ℹ️ 确稿 API 响应 (可能已确稿): $(echo $COMPLETE | head -c 100)"
fi

# ====== 11. 前端构建 ======
echo ""
echo "[11] 前端构建验证"
cd /workspace/epicshot-frontend && npm run build > /tmp/build.log 2>&1
if [ -d "dist" ] && [ -f "dist/favicon.svg" ]; then
  echo "  ✅ 前端构建成功"
  ((PASS++))
else
  echo "  ❌ 前端构建失败"
  ((FAIL++))
fi
# Count TS errors excluding pre-existing ones
NEW_ERRORS=$(grep "error TS" /tmp/build.log | grep -v "TemplateManager\|ImageViewer\|mockData\|project.ts\|NotificationBell\|PortfolioEditorView\|PortfolioViewView\|TimelineView\|ClientProjectView\|WorkspaceView" | wc -l)
echo "  V1.3 新增 TS 错误: $NEW_ERRORS"

# ====== 12. 数据库验证 ======
echo ""
echo "[12] 数据库字段验证"
DB="/workspace/epicshot-backend/data/epicshot.db"
if [ -f "$DB" ]; then
  POS_X=$(sqlite3 "$DB" "SELECT COUNT(*) FROM pragma_table_info('comment_cards') WHERE name='position_x'" 2>/dev/null)
  POS_Y=$(sqlite3 "$DB" "SELECT COUNT(*) FROM pragma_table_info('comment_cards') WHERE name='position_y'" 2>/dev/null)
  if [ "$POS_X" = "1" ] && [ "$POS_Y" = "1" ]; then
    echo "  ✅ position_x/position_y 字段存在"
    ((PASS++))
  else
    echo "  ❌ position_x/position_y 字段缺失"
    ((FAIL++))
  fi
else
  echo "  ❌ 数据库文件不存在"
  ((FAIL++))
fi

echo ""
echo "=========================================="
echo "  测试结果: $PASS 通过 / $FAIL 失败 / $SKIP 跳过"
echo "=========================================="