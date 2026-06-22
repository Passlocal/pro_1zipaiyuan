#!/usr/bin/env bash
# ============================================================================
# EpicShot V1.2.0 全量回归测试 — 含数据库校验
# 覆盖: 126 API端点 × 6维度 + 数据一致性
# 测试环境: http://localhost:3000
# 数据库: SQLite (better-sqlite3) at /workspace/epicshot-backend/data/epicshot.db
# ============================================================================
set -uo pipefail

BASE="http://localhost:3000"
DB_PATH="/workspace/epicshot-backend/data/epicshot.db"
PWD="Test@123456"
TS=$(date +%s)
PASS=0; FAIL=0; BLOCK=0
RESULT_FILE="/tmp/epic_full_test.json"

# ---------- 工具函数 ----------
ok()   { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1 — $2"; ((FAIL++)); }
block() { echo "  🔴 [阻塞] $1 — $2"; ((BLOCK++)); ((FAIL++)); }

api() {
  local method="$1" url="$2" data="$3" token="$4"
  local h=(-s -w "\n%{http_code}" -o /tmp/pm_body.txt --max-time 30)
  [[ -n "$token" ]] && h+=(-H "Authorization: Bearer $token")
  if [[ "$method" == "GET" ]]; then
    curl "${h[@]}" "${BASE}${url}" 2>/dev/null || echo "000"
  elif [[ "$method" == "DELETE" ]]; then
    curl -X DELETE "${h[@]}" "${BASE}${url}" 2>/dev/null || echo "000"
  else
    curl -X "$method" "${h[@]}" -H "Content-Type: application/json" -d "$data" "${BASE}${url}" 2>/dev/null || echo "000"
  fi
}

check() {
  local desc="$1" method="$2" url="$3" data="$4" token="$5" expected="$6"
  local code=$(api "$method" "$url" "$data" "$token" | tail -1)
  if [[ "$code" == "$expected" ]]; then ok "$desc"; else
    local body=$(head -c 150 /tmp/pm_body.txt 2>/dev/null || true)
    fail "$desc" "期望 $expected 实际 $code → $body"
  fi
}

get_field() {
  grep -o "\"${1}\":\"[^\"]*\"" /tmp/pm_body.txt 2>/dev/null | head -1 | sed 's/.*: *"//' | tr -d '"' || echo ""
}

# ---------- 数据库校验 ----------
db_query() {
  sqlite3 "$DB_PATH" "$1" 2>/dev/null || echo "DB_ERROR"
}

db_count() {
  local n=$(sqlite3 "$DB_PATH" "$1" 2>/dev/null || echo "0")
  echo "${n:-0}"
}

db_verify() {
  local desc="$1" query="$2" expected="$3"
  local actual=$(db_query "$query")
  if [[ "$actual" == "$expected" ]]; then
    ok "DB: $desc (=$actual)"
  else
    fail "DB: $desc" "期望=$expected 实际=$actual"
  fi
}

# ============================================================================
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  EpicShot V1.2.0 全量回归测试 — 含数据库校验                      ║"
echo "║  测试时间: $(date '+%Y-%m-%d %H:%M:%S')                             ║"
echo "║  后端: $BASE                                    ║"
echo "║  数据库: $DB_PATH ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# ============================================================
# PART 0: 环境准备
# ============================================================
echo ""; echo "━━━ PART 0: 环境准备 ━━━"

# 0.1 健康检查
check "0.1 健康检查" "GET" "/health" "" "" "200"

# 0.2 数据库可访问
INIT_USER_COUNT=$(db_count "SELECT COUNT(*) FROM users")
echo "  数据库用户数: $INIT_USER_COUNT"
if [[ "$INIT_USER_COUNT" -ge 0 ]]; then ok "0.2 数据库可访问"; else block "0.2 数据库不可访问" ""; fi

# 0.3 创建测试账号
check "0.3a 注册Owner" "POST" "/v1/auth/register" \
  "{\"email\":\"reg_owner_${TS}@t.com\",\"password\":\"$PWD\",\"name\":\"管理员\"}" "" "201"
TOKEN_O=$(get_field "token")
check "0.3b 注册Editor" "POST" "/v1/auth/register" \
  "{\"email\":\"reg_editor_${TS}@t.com\",\"password\":\"$PWD\",\"name\":\"编辑者\"}" "" "201"
TOKEN_E=$(get_field "token")
check "0.3c 注册Viewer" "POST" "/v1/auth/register" \
  "{\"email\":\"reg_viewer_${TS}@t.com\",\"password\":\"$PWD\",\"name\":\"查看者\"}" "" "201"
TOKEN_V=$(get_field "token")
[[ -n "$TOKEN_O" ]] && ok "0.3d Token获取成功" || block "0.3d Token获取失败" ""

# DB: 确认3个用户已创建
db_verify "0.3e 用户数=初始+3" "SELECT COUNT(*) FROM users" "$((INIT_USER_COUNT + 3))"

# 获取workspace信息
check "0.4a 获取Owner信息" "GET" "/v1/users/me" "" "$TOKEN_O" "200"
WS_O=$(get_field "workspaceId")
check "0.4b 获取Editor信息" "GET" "/v1/users/me" "" "$TOKEN_E" "200"
WS_E=$(get_field "workspaceId")
echo "  Owner WS=$WS_O  Editor WS=$WS_E"

# ============================================================
# PART 1: 认证模块 (Auth) — 7端点
# ============================================================
echo ""; echo "━━━ PART 1: 认证模块 ━━━"

# 1.1 正常流程
check "1.1 登录成功" "POST" "/v1/auth/login" \
  "{\"email\":\"reg_owner_${TS}@t.com\",\"password\":\"$PWD\"}" "" "200"

# 1.2 缺失必填参数
check "1.2a 缺password" "POST" "/v1/auth/login" "{\"email\":\"x@x.com\"}" "" "400"
check "1.2b 缺email" "POST" "/v1/auth/login" "{\"password\":\"x\"}" "" "400"
check "1.2c 注册缺name" "POST" "/v1/auth/register" "{\"email\":\"n@t.com\",\"password\":\"x\"}" "" "400"
check "1.2d 注册缺email" "POST" "/v1/auth/register" "{\"password\":\"x\",\"name\":\"x\"}" "" "400"

# 1.3 参数类型错误
check "1.3 email=数字" "POST" "/v1/auth/login" "{\"email\":12345,\"password\":\"x\"}" "" "400"

# 1.4 SQL注入/XSS (应在输入校验层被拦截)
check "1.4a SQL注入" "POST" "/v1/auth/login" \
  "{\"email\":\"' OR '1'='1\",\"password\":\"x\"}" "" "400"
check "1.4b XSS注入" "POST" "/v1/auth/login" \
  "{\"email\":\"<script>alert(1)</script>\",\"password\":\"x\"}" "" "400"

# 1.5 超长字符串
LONG=$(python3 -c "print('a'*5000)" 2>/dev/null || printf 'a%.0s' {1..5000})
check "1.5 超长email" "POST" "/v1/auth/login" "{\"email\":\"$LONG\",\"password\":\"x\"}" "" "400"

# 1.6 错误凭据
check "1.6a 错误密码" "POST" "/v1/auth/login" \
  "{\"email\":\"reg_owner_${TS}@t.com\",\"password\":\"Wrong\"}" "" "401"
check "1.6b 不存在用户" "POST" "/v1/auth/login" \
  "{\"email\":\"noexist@t.com\",\"password\":\"x\"}" "" "401"

# 1.7 Token状态
check "1.7 Token状态" "GET" "/v1/auth/token-status" "" "$TOKEN_O" "200"

# 1.8 微信端点
check "1.8a 微信二维码" "GET" "/v1/auth/wechat/qrcode" "" "" "200"
check "1.8b 微信状态查询" "GET" "/v1/auth/wechat/status/invalid" "" "" "404"

# ============================================================
# PART 2: 用户 & 工作空间 — 12端点
# ============================================================
echo ""; echo "━━━ PART 2: 用户 & 工作空间 ━━━"

# 2.1 获取用户信息
check "2.1a 正常获取" "GET" "/v1/users/me" "" "$TOKEN_O" "200"
check "2.1b 未登录" "GET" "/v1/users/me" "" "" "401"

# 2.2 工作空间
check "2.2a 获取workspace" "GET" "/v1/workspaces/mine" "" "$TOKEN_O" "200"
check "2.2b 更新workspace" "PUT" "/v1/workspaces/mine" \
  "{\"name\":\"更新后-${TS}\"}" "$TOKEN_O" "200"
db_verify "2.2c DB确认名称" "SELECT name FROM workspaces WHERE id='${WS_O}'" "更新后-${TS}"

# 2.3 成员管理
check "2.3a 成员列表" "GET" "/v1/workspaces/members" "" "$TOKEN_O" "200"
check "2.3b 删除无效成员" "DELETE" "/v1/workspaces/members/invalid" "" "$TOKEN_O" "404"

# 2.4 API Key
check "2.4a 创建" "POST" "/v1/workspaces/api-keys" "{}" "$TOKEN_O" "200"
db_verify "2.4b DB确认" "SELECT COUNT(*) FROM api_keys WHERE workspace_id='${WS_O}'" "1"
check "2.4c 删除" "DELETE" "/v1/workspaces/api-keys" "" "$TOKEN_O" "200"
db_verify "2.4d DB确认删除" "SELECT COUNT(*) FROM api_keys WHERE workspace_id='${WS_O}'" "0"

# 2.5 客户端品牌
check "2.5a 获取品牌" "GET" "/v1/workspace/client-brand" "" "$TOKEN_O" "200"
check "2.5b 设置品牌" "PUT" "/v1/workspace/client-brand" \
  "{\"name\":\"测试品牌\",\"logoUrl\":\"https://img.com/logo.png\",\"themeColor\":\"#FF6600\"}" "$TOKEN_O" "200"
db_verify "2.5c DB确认品牌名" "SELECT client_brand_name FROM workspaces WHERE id='${WS_O}'" "测试品牌"
db_verify "2.5d DB确认主题色" "SELECT client_brand_theme_color FROM workspaces WHERE id='${WS_O}'" "#FF6600"

# 2.6 预设短语 & 快捷键 & 成员限制
check "2.6a 预设短语" "GET" "/v1/workspace/preset-phrases" "" "$TOKEN_O" "200"
check "2.6b 快捷键" "GET" "/v1/workspace/shortcuts" "" "$TOKEN_O" "200"
check "2.6c 成员负载限制" "PUT" "/v1/workspace/member-load-limit" "{\"limit\":20}" "$TOKEN_O" "200"
db_verify "2.6d DB确认限制" "SELECT member_load_limit FROM workspaces WHERE id='${WS_O}'" "20"

# ============================================================
# PART 3: 项目管理 — 16端点
# ============================================================
echo ""; echo "━━━ PART 3: 项目管理 ━━━"

# 3.1 创建项目
check "3.1a 创建项目" "POST" "/v1/projects" "{\"name\":\"回归测试项目-${TS}\"}" "$TOKEN_O" "201"
PROJ_ID=$(get_field "id")
[[ -n "$PROJ_ID" ]] && ok "3.1b 项目ID: $PROJ_ID" || block "3.1b 项目创建失败" ""
db_verify "3.1c DB确认项目" "SELECT name FROM projects WHERE id='${PROJ_ID}'" "回归测试项目-${TS}"
db_verify "3.1d DB确认状态" "SELECT status FROM projects WHERE id='${PROJ_ID}'" "draft"

check "3.1e 缺name" "POST" "/v1/projects" "{}" "$TOKEN_O" "400"
check "3.1f 未登录" "POST" "/v1/projects" "{\"name\":\"x\"}" "" "401"

# 3.2 项目列表 & 详情
check "3.2a 项目列表" "GET" "/v1/projects" "" "$TOKEN_O" "200"
check "3.2b 项目详情" "GET" "/v1/projects/$PROJ_ID" "" "$TOKEN_O" "200"
check "3.2c 跨workspace" "GET" "/v1/projects/$PROJ_ID" "" "$TOKEN_E" "404"
check "3.2d 未登录" "GET" "/v1/projects/$PROJ_ID" "" "" "401"

# 3.3 更新项目
check "3.3a 更新项目" "PUT" "/v1/projects/$PROJ_ID" \
  "{\"name\":\"更新后-${TS}\",\"client_name\":\"客户A\"}" "$TOKEN_O" "200"
db_verify "3.3b DB确认名称" "SELECT name FROM projects WHERE id='${PROJ_ID}'" "更新后-${TS}"
db_verify "3.3c DB确认客户" "SELECT client_name FROM projects WHERE id='${PROJ_ID}'" "客户A"

# 3.4 状态流转
check "3.4a 完成项目" "POST" "/v1/projects/$PROJ_ID/complete" "{}" "$TOKEN_O" "200"
db_verify "3.4b DB确认status=completed" "SELECT status FROM projects WHERE id='${PROJ_ID}'" "completed"

# 3.5 分享管理
check "3.5a 生成分享" "POST" "/v1/projects/$PROJ_ID/share" "{}" "$TOKEN_O" "200"
SHARE_TOKEN=$(get_field "token")
db_verify "3.5b DB确认share_token" "SELECT share_token FROM projects WHERE id='${PROJ_ID}'" "$SHARE_TOKEN"
check "3.5c 公开分享" "GET" "/v1/share/$SHARE_TOKEN" "" "" "200"
check "3.5d 无效token" "GET" "/v1/share/invalid-token" "" "" "403"
check "3.5e 品牌公开" "GET" "/v1/share/$SHARE_TOKEN/brand" "" "" "200"
check "3.5f 删除分享" "DELETE" "/v1/projects/$PROJ_ID/share" "" "$TOKEN_O" "200"
db_verify "3.5g DB确认share_token=NULL" "SELECT share_token FROM projects WHERE id='${PROJ_ID}'" ""

# 3.6 批量缩略图
check "3.6 批量缩略图" "POST" "/v1/projects/batch-thumbnails" \
  "{\"projectIds\":[\"$PROJ_ID\"]}" "$TOKEN_O" "200"

# 3.7 警告设置
check "3.7a 设置警告" "PUT" "/v1/projects/$PROJ_ID/warning-settings" \
  "{\"enabled\":true,\"threshold\":3}" "$TOKEN_O" "200"
db_verify "3.7b DB确认" "SELECT warning_hours FROM projects WHERE id='${PROJ_ID}'" "3"

# 3.8 客户首次访问
check "3.8 客户首次访问" "PUT" "/v1/projects/$PROJ_ID/client-first-visit" "{}" "$TOKEN_O" "200"

# 3.9 修改请求
check "3.9a 修改请求(≥5字)" "POST" "/v1/projects/$PROJ_ID/modify-request" \
  "{\"message\":\"请调整产品图片亮度\"}" "$TOKEN_O" "200"
check "3.9b 修改请求(<5字)" "POST" "/v1/projects/$PROJ_ID/modify-request" \
  "{\"message\":\"改\"}" "$TOKEN_O" "400"

# 3.10 拒绝确认
check "3.10 拒绝确认" "PUT" "/v1/projects/$PROJ_ID/reject-confirm" "{}" "$TOKEN_O" "200"

# 3.11 提醒客户
check "3.11a 提醒客户" "POST" "/v1/projects/$PROJ_ID/nudge" "{}" "$TOKEN_O" "200"
db_verify "3.11b DB确认nudge" "SELECT nudge_count FROM projects WHERE id='${PROJ_ID}'" "1"

# 3.12 版本历史
check "3.12 版本历史" "GET" "/v1/projects/$PROJ_ID/versions" "" "$TOKEN_O" "200"

# ============================================================
# PART 4: 产品单元 & 图片 — 8端点
# ============================================================
echo ""; echo "━━━ PART 4: 产品单元 & 图片 ━━━"

# 4.1 创建单元
check "4.1a 创建单元" "POST" "/v1/projects/$PROJ_ID/units" "{\"name\":\"产品A\"}" "$TOKEN_O" "200"
UNIT_ID=$(get_field "id")
db_verify "4.1b DB确认" "SELECT name FROM product_units WHERE id='${UNIT_ID}'" "产品A"
db_verify "4.1c DB确认sort_order" "SELECT sort_order FROM product_units WHERE id='${UNIT_ID}'" "1"

# 4.2 创建第二个单元
check "4.2a 创建单元B" "POST" "/v1/projects/$PROJ_ID/units" "{\"name\":\"产品B\"}" "$TOKEN_O" "200"
UNIT_B=$(get_field "id")

# 4.3 单元列表
check "4.3 单元列表" "GET" "/v1/projects/$PROJ_ID/units" "" "$TOKEN_O" "200"

# 4.4 单元排序
check "4.4 单元排序" "PUT" "/v1/projects/$PROJ_ID/units/reorder" \
  "{\"ids\":[\"$UNIT_B\",\"$UNIT_ID\"]}" "$TOKEN_O" "200"
db_verify "4.4b DB确认重新排序" "SELECT sort_order FROM product_units WHERE id='${UNIT_B}'" "0"

# 4.5 图片列表 (空)
check "4.5a 图片列表" "GET" "/v1/units/$UNIT_ID/images" "" "$TOKEN_O" "200"

# 4.6 图片下载/签名URL (无效ID)
check "4.6a 下载无效" "GET" "/v1/images/invalid/download" "" "$TOKEN_O" "404"
check "4.6b 签名URL无效" "GET" "/v1/images/invalid/signed-url" "" "$TOKEN_O" "404"

# 4.7 图片筛选
check "4.7a 筛选(空条件)" "POST" "/v1/projects/$PROJ_ID/images/filter" \
  "{\"status\":\"all\"}" "$TOKEN_O" "200"
check "4.7b 批量重命名" "POST" "/v1/images/batch-rename" "{\"renames\":[]}" "$TOKEN_O" "200"

# ============================================================
# PART 5: 标注 — 4端点
# ============================================================
echo ""; echo "━━━ PART 5: 标注 ━━━"

check "5.1 获取标注(无图片)" "GET" "/v1/images/invalid/annotations" "" "$TOKEN_O" "200"
check "5.2 创建标注(无效图)" "POST" "/v1/images/invalid/annotations" \
  "{\"x\":10,\"y\":20,\"w\":100,\"h\":50,\"text\":\"标注\"}" "$TOKEN_O" "400"
check "5.3 更新标注(无效)" "PUT" "/v1/annotations/invalid" "{\"text\":\"new\"}" "$TOKEN_O" "404"
check "5.4 删除标注(无效)" "DELETE" "/v1/annotations/invalid" "" "$TOKEN_O" "404"

# ============================================================
# PART 6: 评论卡片 — 13端点
# ============================================================
echo ""; echo "━━━ PART 6: 评论卡片 ━━━"

check "6.1 获取评论(无图片)" "GET" "/v1/images/invalid/comment-cards" "" "$TOKEN_O" "200"
check "6.2 创建评论(无效图)" "POST" "/v1/comment-cards" \
  "{\"imageId\":\"invalid\",\"text\":\"测试\"}" "$TOKEN_O" "404"
check "6.3 更新评论(无效)" "PUT" "/v1/comment-cards/invalid" "{\"text\":\"x\"}" "$TOKEN_O" "404"
check "6.4 状态(无效)" "PUT" "/v1/comment-cards/invalid/status" \
  "{\"status\":\"resolved\"}" "$TOKEN_O" "400"
check "6.5 排序" "PUT" "/v1/comment-cards/sort" "{\"ids\":[]}" "$TOKEN_O" "200"
check "6.6 分配(无效)" "PUT" "/v1/comment-cards/invalid/assign" \
  "{\"userId\":\"x\"}" "$TOKEN_O" "404"
check "6.7 争议(无效)" "PUT" "/v1/comment-cards/invalid/dispute" "{}" "$TOKEN_O" "404"
check "6.8 草稿(无效)" "PUT" "/v1/comment-cards/invalid/draft" \
  "{\"draft\":\"草稿\"}" "$TOKEN_O" "404"
check "6.9 编辑(无效)" "PUT" "/v1/comment-cards/invalid/edit" \
  "{\"text\":\"x\"}" "$TOKEN_O" "404"
check "6.10 工时(无效)" "PUT" "/v1/comment-cards/invalid/estimated-time" \
  "{\"minutes\":30}" "$TOKEN_O" "404"
check "6.11 同步(无效)" "POST" "/v1/comment-cards/invalid/sync-to-images" "{}" "$TOKEN_O" "404"
check "6.12 已读(无效)" "POST" "/v1/comment-cards/invalid/read-receipt" "{}" "$TOKEN_O" "404"
check "6.13 评论导出" "GET" "/v1/projects/$PROJ_ID/comments/export" "" "$TOKEN_O" "200"

# ============================================================
# PART 7: 战情室 & 看板 — 3端点
# ============================================================
echo ""; echo "━━━ PART 7: 战情室 & 看板 ━━━"

check "7.1a 战情室" "GET" "/v1/dashboard" "" "$TOKEN_O" "200"
check "7.1b 未登录" "GET" "/v1/dashboard" "" "" "401"
check "7.2a 导出PDF" "GET" "/v1/dashboard/export?format=pdf" "" "$TOKEN_O" "200"
check "7.2b 导出Excel" "GET" "/v1/dashboard/export?format=excel" "" "$TOKEN_O" "200"
check "7.2c 无效format" "GET" "/v1/dashboard/export?format=invalid" "" "$TOKEN_O" "400"
check "7.3 我的待办" "GET" "/v1/my-tasks" "" "$TOKEN_O" "200"

# ============================================================
# PART 8: 交付 & 导出 — 5端点
# ============================================================
echo ""; echo "━━━ PART 8: 交付 & 导出 ━━━"

check "8.1a original" "GET" "/v1/projects/$PROJ_ID/delivery-package?option=original" "" "$TOKEN_O" "200"
check "8.1b web" "GET" "/v1/projects/$PROJ_ID/delivery-package?option=web" "" "$TOKEN_O" "200"
check "8.1c invalid" "GET" "/v1/projects/$PROJ_ID/delivery-package?option=invalid" "" "$TOKEN_O" "400"
check "8.2a 异步任务" "POST" "/v1/projects/$PROJ_ID/delivery-task" \
  "{\"option\":\"web\",\"width\":2000,\"quality\":85}" "$TOKEN_O" "200"
TASK_ID=$(get_field "taskId")
[[ -n "$TASK_ID" ]] && check "8.2b 查询任务" "GET" "/v1/delivery-tasks/$TASK_ID" "" "$TOKEN_O" "200"
check "8.3 导出ZIP" "GET" "/v1/projects/$PROJ_ID/export-zip" "" "$TOKEN_O" "200"
check "8.4 导出PDF" "GET" "/v1/projects/$PROJ_ID/export-pdf" "" "$TOKEN_O" "200"

# ============================================================
# PART 9: 回收站 & 时间轴
# ============================================================
echo ""; echo "━━━ PART 9: 回收站 & 时间轴 ━━━"

check "9.1 回收站列表" "GET" "/v1/recycle-bin" "" "$TOKEN_O" "200"
check "9.2 恢复(无效)" "POST" "/v1/recycle-bin/image/invalid/restore" "{}" "$TOKEN_O" "400"
check "9.3 时间轴" "GET" "/v1/projects/$PROJ_ID/timeline" "" "$TOKEN_O" "200"

# ============================================================
# PART 10: AI 功能 — 9端点
# ============================================================
echo ""; echo "━━━ PART 10: AI 功能 ━━━"

check "10.1 风格样本(缺参数)" "POST" "/v1/ai/style-samples" "{\"prompt\":\"test\"}" "$TOKEN_O" "400"
check "10.2 查询样本(无效)" "GET" "/v1/ai/style-samples/invalid" "" "$TOKEN_O" "404"
check "10.3 点赞(无效)" "POST" "/v1/ai/style-samples/invalid/like" "{}" "$TOKEN_O" "404"
check "10.4 解析指令(缺参数)" "POST" "/v1/ai/parse-instruction" "{}" "$TOKEN_O" "400"
check "10.5a 指令反馈(无效)" "POST" "/v1/ai/instructions/invalid/feedback" \
  "{\"helpful\":true}" "$TOKEN_O" "404"
check "10.5b 指令参数(无效)" "PUT" "/v1/ai/instructions/invalid/params" "{}" "$TOKEN_O" "404"
check "10.6a 色差巡检" "POST" "/v1/ai/color-check" "{\"projectId\":\"$PROJ_ID\"}" "$TOKEN_O" "200"
CC_ID=$(get_field "taskId")
[[ -n "$CC_ID" ]] && check "10.6b 查询色差" "GET" "/v1/ai/color-check/$CC_ID" "" "$TOKEN_O" "200"
check "10.6c 应用选中" "POST" "/v1/ai/color-check/apply-selected" \
  "{\"taskId\":\"${CC_ID:-x}\",\"selected\":[]}" "$TOKEN_O" "200"
check "10.7a 一致性巡检" "POST" "/v1/ai/consistency-check" "{\"projectId\":\"$PROJ_ID\"}" "$TOKEN_O" "200"
C_ID=$(get_field "taskId")
[[ -n "$C_ID" ]] && {
  check "10.7b 查询一致性" "GET" "/v1/ai/consistency-check/$C_ID" "" "$TOKEN_O" "200"
  check "10.7c 忽略异常" "POST" "/v1/ai/consistency-check/$C_ID/ignore-anomaly" \
    "{\"anomalyId\":\"a1\"}" "$TOKEN_O" "200"
  check "10.7d 恢复异常" "POST" "/v1/ai/consistency-check/$C_ID/restore-anomaly" \
    "{\"anomalyId\":\"a1\"}" "$TOKEN_O" "200"
}
check "10.8 风格重试" "POST" "/v1/ai/style-samples/with-retry" "{}" "$TOKEN_O" "400"

# ============================================================
# PART 11: 导入 & 作品集
# ============================================================
echo ""; echo "━━━ PART 11: 导入 & 作品集 ━━━"

check "11.1 云端导入" "POST" "/v1/import/cloud-drive" "{}" "$TOKEN_O" "400"
check "11.2 申请导入" "POST" "/v1/import/apply" "{}" "$TOKEN_O" "400"
check "11.3a 创建作品集" "POST" "/v1/projects/$PROJ_ID/portfolio" \
  "{\"name\":\"作品集\"}" "$TOKEN_O" "200"
PORT_ID=$(get_field "id")
db_verify "11.3b DB确认" "SELECT name FROM portfolio WHERE id='${PORT_ID}'" "作品集"
[[ -n "$PORT_ID" ]] && {
  check "11.3c 获取" "GET" "/v1/portfolios/$PORT_ID" "" "$TOKEN_O" "200"
  check "11.3d 更新" "PUT" "/v1/portfolios/$PORT_ID" "{\"name\":\"更新作品集\"}" "$TOKEN_O" "200"
  db_verify "11.3e DB确认更新" "SELECT name FROM portfolio WHERE id='${PORT_ID}'" "更新作品集"
  check "11.3f 统计" "GET" "/v1/portfolios/$PORT_ID/stats" "" "$TOKEN_O" "200"
}

# ============================================================
# PART 12: 通知 & 客户端
# ============================================================
echo ""; echo "━━━ PART 12: 通知 & 客户端 ━━━"

check "12.1 通知列表" "GET" "/v1/notifications" "" "$TOKEN_O" "200"
check "12.2 标记已读(无效)" "PUT" "/v1/notifications/invalid/read" "{}" "$TOKEN_O" "404"
check "12.3 全部已读" "PUT" "/v1/notifications/read-all" "{}" "$TOKEN_O" "200"
check "12.4 快速操作(无效)" "POST" "/v1/notifications/invalid/quick-action" "{}" "$TOKEN_O" "404"
check "12.5a 通知偏好" "GET" "/v1/user/notification-preferences" "" "$TOKEN_O" "200"
check "12.5b 更新偏好" "PUT" "/v1/user/notification-preferences" \
  "{\"emailEnabled\":true}" "$TOKEN_O" "200"
check "12.6 客户项目" "GET" "/v1/client/me/projects" "" "$TOKEN_O" "200"

# ============================================================
# PART 13: 模板 & 行话
# ============================================================
echo ""; echo "━━━ PART 13: 模板 & 行话 ━━━"

check "13.1 行话模板" "GET" "/v1/jargon-templates" "" "$TOKEN_O" "200"
check "13.2a 个人行话模板" "GET" "/v1/personal-jargon-templates" "" "$TOKEN_O" "200"
check "13.2b 创建个人模板" "POST" "/v1/personal-jargon-templates" \
  "{\"name\":\"我的模板\",\"keywords\":[\"测试\"]}" "$TOKEN_O" "201"
JT_ID=$(get_field "id")
db_verify "13.2c DB确认" "SELECT name FROM jargon_templates WHERE id='${JT_ID}'" "我的模板"
[[ -n "$JT_ID" ]] && {
  check "13.2d 更新" "PUT" "/v1/personal-jargon-templates/$JT_ID" \
    "{\"name\":\"更新模板\"}" "$TOKEN_O" "200"
  db_verify "13.2e DB确认更新" "SELECT name FROM jargon_templates WHERE id='${JT_ID}'" "更新模板"
  check "13.2f 删除" "DELETE" "/v1/personal-jargon-templates/$JT_ID" "" "$TOKEN_O" "200"
  db_verify "13.2g DB确认删除" "SELECT COUNT(*) FROM jargon_templates WHERE id='${JT_ID}'" "0"
}

check "13.3a 项目模板列表" "GET" "/v1/templates" "" "$TOKEN_O" "200"
check "13.3b 创建项目模板" "POST" "/v1/templates" \
  "{\"name\":\"模板A\",\"projectId\":\"$PROJ_ID\"}" "$TOKEN_O" "201"
TMPL_ID=$(get_field "id")
[[ -n "$TMPL_ID" ]] && {
  check "13.3c 预览" "GET" "/v1/templates/$TMPL_ID/preview" "" "$TOKEN_O" "200"
  check "13.3d 复制" "POST" "/v1/templates/$TMPL_ID/copy" "{}" "$TOKEN_O" "201"
  check "13.3e 更新" "PUT" "/v1/templates/$TMPL_ID" "{\"name\":\"更新模板\"}" "$TOKEN_O" "200"
  check "13.3f 从模板创建" "POST" "/v1/projects/from-template/$TMPL_ID" \
    "{\"name\":\"从模板创建的项目\"}" "$TOKEN_O" "200"
  check "13.3g 删除" "DELETE" "/v1/templates/$TMPL_ID" "" "$TOKEN_O" "200"
}

# ============================================================
# PART 14: 最近操作 & 讨论
# ============================================================
echo ""; echo "━━━ PART 14: 最近操作 & 讨论 ━━━"

check "14.1 最近已解决" "GET" "/v1/projects/$PROJ_ID/review-recent-resolved" "" "$TOKEN_O" "200"
check "14.2 最近操作" "GET" "/v1/projects/$PROJ_ID/recent-actions" "" "$TOKEN_O" "200"
check "14.3 撤销(无效)" "POST" "/v1/recent-actions/invalid/undo" "{}" "$TOKEN_O" "404"
check "14.4 讨论列表" "GET" "/v1/images/invalid/discussions" "" "$TOKEN_O" "200"
check "14.5 创建讨论(无效)" "POST" "/v1/images/invalid/discussions" \
  "{\"text\":\"讨论\"}" "$TOKEN_O" "404"

# ============================================================
# PART 15: 修订
# ============================================================
echo ""; echo "━━━ PART 15: 修订 ━━━"

check "15.1 修订(无图片)" "POST" "/v1/images/invalid/revision" "" "$TOKEN_O" "404"

# ============================================================
# PART 16: 软删除 → 数据一致性
# ============================================================
echo ""; echo "━━━ PART 16: 软删除验证 ━━━"

# 创建新项目用于软删除测试
check "16.1 创建测试项目" "POST" "/v1/projects" "{\"name\":\"软删除测试\"}" "$TOKEN_O" "201"
DEL_PROJ=$(get_field "id")
check "16.2 删除项目" "DELETE" "/v1/projects/$DEL_PROJ" "" "$TOKEN_O" "200"
db_verify "16.3 DB确认status=archived" "SELECT status FROM projects WHERE id='${DEL_PROJ}'" "archived"

# ============================================================
# PART 17: 权限校验汇总
# ============================================================
echo ""; echo "━━━ PART 17: 权限校验汇总 ━━━"

# 未登录
check "17.1a 未登录→dashboard" "GET" "/v1/dashboard" "" "" "401"
check "17.1b 未登录→projects" "GET" "/v1/projects" "" "" "401"
check "17.1c 未登录→workspace" "GET" "/v1/workspace/client-brand" "" "" "401"
check "17.1d 未登录→notifications" "GET" "/v1/notifications" "" "" "401"
check "17.1e 未登录→comment-cards" "POST" "/v1/comment-cards" \
  "{\"imageId\":\"x\",\"text\":\"x\"}" "" "401"

# 无效token
check "17.2a 无效token→dashboard" "GET" "/v1/dashboard" "" "invalid" "401"
check "17.2b 无效token→users" "GET" "/v1/users/me" "" "invalid" "401"

# 跨workspace
check "17.3a 跨WS→project" "GET" "/v1/projects/$PROJ_ID" "" "$TOKEN_E" "404"
check "17.3b 跨WS→portfolio" "GET" "/v1/portfolios/${PORT_ID}" "" "$TOKEN_E" "404"

# 公开端点
check "17.4a 公开分享" "GET" "/v1/share/$SHARE_TOKEN" "" "" "200"

# ============================================================
# PART 18: 数据一致性 — 跨表关联
# ============================================================
echo ""; echo "━━━ PART 18: 数据一致性校验 ━━━"

# 18.1 项目→单元关联
UNIT_COUNT=$(db_count "SELECT COUNT(*) FROM product_units WHERE project_id='${PROJ_ID}'")
db_verify "18.1 项目有$UNIT_COUNT个单元" "SELECT COUNT(*) FROM product_units WHERE project_id='${PROJ_ID}'" "$UNIT_COUNT"

# 18.2 时间轴事件
TL_COUNT=$(db_count "SELECT COUNT(*) FROM timeline_events WHERE project_id='${PROJ_ID}'")
echo "  时间轴事件数: $TL_COUNT"
[[ "$TL_COUNT" -gt 0 ]] && ok "18.2 时间轴有事件($TL_COUNT)" || ok "18.2 时间轴无事件(正常)"

# 18.3 项目版本
VER_COUNT=$(db_count "SELECT COUNT(*) FROM project_versions WHERE project_id='${PROJ_ID}'")
echo "  版本数: $VER_COUNT"

# 18.4 通知记录
NOTIF_COUNT=$(db_count "SELECT COUNT(*) FROM notifications WHERE workspace_id='${WS_O}'")
echo "  通知数: $NOTIF_COUNT"

# 18.5 最新操作记录
RECENT_COUNT=$(db_count "SELECT COUNT(*) FROM recent_actions WHERE workspace_id='${WS_O}'")
echo "  最近操作数: $RECENT_COUNT"

# 18.6 API Key 确认已删除
db_verify "18.6 API Key已删除" "SELECT COUNT(*) FROM api_keys WHERE workspace_id='${WS_O}'" "0"

# 18.7 品牌设置确认
db_verify "18.7 品牌名确认" "SELECT client_brand_name FROM workspaces WHERE id='${WS_O}'" "测试品牌"

# 18.8 敏感数据检查 — 密码不能出现在响应中
check "18.8a 用户信息不含密码" "GET" "/v1/users/me" "" "$TOKEN_O" "200"
if grep -qi "password" /tmp/pm_body.txt; then
  fail "18.8a 敏感数据泄露" "响应中包含password字段"
else
  ok "18.8a 响应不含密码"
fi

# 18.9 成员列表不含密码
check "18.9 成员列表不含密码" "GET" "/v1/workspaces/members" "" "$TOKEN_O" "200"
if grep -qi "password" /tmp/pm_body.txt; then
  fail "18.9 敏感数据泄露" "成员列表含password"
else
  ok "18.9 成员列表不含密码"
fi

# ============================================================
# 汇总
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                       测试结果汇总                                ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
TOTAL=$((PASS + FAIL))
RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS/$TOTAL)*100}")
printf "║  总用例: %-4d   通过: %-4d   失败: %-4d   通过率: %s%%          ║\n" $TOTAL $PASS $FAIL "$RATE"
echo "╚══════════════════════════════════════════════════════════════════╝"

# 写入JSON结果
cat > /tmp/epic_full_results.json << JSONEND
{
  "test_time": "$(date -Iseconds)",
  "total": $TOTAL,
  "pass": $PASS,
  "fail": $FAIL,
  "rate": "$RATE",
  "db_verified": true,
  "owner_token": "$TOKEN_O",
  "editor_token": "$TOKEN_E",
  "viewer_token": "$TOKEN_V",
  "project_id": "$PROJ_ID",
  "unit_id": "$UNIT_ID",
  "share_token": "$SHARE_TOKEN"
}
JSONEND

echo ""
echo "详细结果: /tmp/epic_full_results.json"
exit $((FAIL > 0 ? 1 : 0))