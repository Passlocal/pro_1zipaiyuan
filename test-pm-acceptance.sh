#!/usr/bin/env bash
# ============================================================================
# 产品经理验收测试 — 核心业务流程
# 三个完整闭环：注册→项目→分享 | 战情室→导出 | 品牌→客户查看
# ============================================================================
set -uo pipefail
BASE="http://localhost:3000"
PWD="Accept@123"
TS=$(date +%s)
PASS=0; FAIL=0

ok() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1 → $2"; ((FAIL++)); }

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
  if [[ "$code" == "$expected" ]]; then
    ok "$desc (HTTP $code)"
  else
    local body=$(head -c 150 /tmp/pm_body.txt 2>/dev/null || true)
    fail "$desc" "期望 $expected 实际 $code → $body"
  fi
}

get_field() {
  local key="$1"
  grep -o "\"${key}\":\"[^\"]*\"" /tmp/pm_body.txt 2>/dev/null | head -1 | sed 's/.*: *"//' | tr -d '"' || echo ""
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     产品经理验收测试 — 核心业务流程                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ============================================================
# Flow 1: 完整端到端业务流程
# 注册 → 登录 → 创建项目 → 创建单元 → 分享 → 客户查看
# ============================================================
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FLOW 1: 完整端到端业务流程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1.1 注册
EMAIL="pm_flow1_${TS}@e.com"
check "1.1 注册" "POST" "/v1/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PWD\",\"name\":\"产品经理\"}" "" "201"
TOKEN=$(grep -o '"token":"[^"]*"' /tmp/pm_body.txt | head -1 | cut -d'"' -f4)

# 1.2 登录
check "1.2 登录" "POST" "/v1/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PWD\"}" "" "200"

# 1.3 获取用户信息
check "1.3 获取用户信息" "GET" "/v1/users/me" "" "$TOKEN" "200"

# 1.4 创建项目
check "1.4 创建项目" "POST" "/v1/projects" \
  "{\"name\":\"产品验收项目-${TS}\"}" "$TOKEN" "201"
PROJ_ID=$(get_field "id")
echo "     项目ID: $PROJ_ID"

# 1.5 获取项目列表
check "1.5 获取项目列表" "GET" "/v1/projects" "" "$TOKEN" "200"

# 1.6 获取项目详情
check "1.6 获取项目详情" "GET" "/v1/projects/$PROJ_ID" "" "$TOKEN" "200"

# 1.7 创建产品单元
check "1.7 创建产品单元" "POST" "/v1/projects/$PROJ_ID/units" \
  "{\"name\":\"产品A-主图\"}" "$TOKEN" "200"
UNIT_ID=$(get_field "id")
echo "     单元ID: $UNIT_ID"

# 1.8 获取单元列表
check "1.8 获取单元列表" "GET" "/v1/projects/$PROJ_ID/units" "" "$TOKEN" "200"

# 1.9 生成分享链接
check "1.9 生成分享链接" "POST" "/v1/projects/$PROJ_ID/share" \
  "{}" "$TOKEN" "200"
SHARE_TOKEN=$(get_field "token")
echo "     分享Token: ${SHARE_TOKEN:0:30}..."

# 1.10 客户通过分享链接查看项目（无需登录）
check "1.10 客户查看分享项目" "GET" "/v1/share/$SHARE_TOKEN" "" "" "200"

# 1.11 客户查看品牌信息
check "1.11 客户查看品牌" "GET" "/v1/share/$SHARE_TOKEN/brand" "" "" "200"

# 1.12 设置警告
check "1.12 设置警告" "PUT" "/v1/projects/$PROJ_ID/warning-settings" \
  "{\"enabled\":true,\"threshold\":5}" "$TOKEN" "200"

# 1.13 获取时间轴
check "1.13 获取时间轴" "GET" "/v1/projects/$PROJ_ID/timeline" "" "$TOKEN" "200"

# 1.14 获取版本历史
check "1.14 获取版本历史" "GET" "/v1/projects/$PROJ_ID/versions" "" "$TOKEN" "200"

# 1.15 完成项目
check "1.15 完成项目" "POST" "/v1/projects/$PROJ_ID/complete" \
  "{}" "$TOKEN" "200"

# ============================================================
# Flow 2: 战情室 → 数据导出
# 登录 → 战情室 → 导出PDF → 导出Excel
# ============================================================
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FLOW 2: 战情室 → 数据导出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 2.1 战情室数据
check "2.1 战情室数据" "GET" "/v1/dashboard" "" "$TOKEN" "200"

# 2.2 导出PDF
check "2.2 导出PDF" "GET" "/v1/dashboard/export?format=pdf" "" "$TOKEN" "200"

# 2.3 导出Excel
check "2.3 导出Excel" "GET" "/v1/dashboard/export?format=excel" "" "$TOKEN" "200"

# 2.4 我的待办
check "2.4 我的待办" "GET" "/v1/my-tasks" "" "$TOKEN" "200"

# 2.5 通知列表
check "2.5 通知列表" "GET" "/v1/notifications" "" "$TOKEN" "200"

# 2.6 全部已读
check "2.6 全部已读" "PUT" "/v1/notifications/read-all" "{}" "$TOKEN" "200"

# ============================================================
# Flow 3: 品牌设置 → 客户查看
# 设置品牌 → 创建分享 → 客户查看品牌 → 评论导出
# ============================================================
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FLOW 3: 品牌设置 → 客户查看 → 交付"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 3.1 设置客户端品牌
check "3.1 设置品牌" "PUT" "/v1/workspace/client-brand" \
  "{\"name\":\"某某品牌\",\"logoUrl\":\"\",\"themeColor\":\"#FF6600\"}" "$TOKEN" "200"

# 3.2 读取品牌
check "3.2 读取品牌" "GET" "/v1/workspace/client-brand" "" "$TOKEN" "200"

# 3.3 客户查看品牌
check "3.3 客户查看品牌" "GET" "/v1/share/$SHARE_TOKEN/brand" "" "" "200"

# 3.4 预设短语
check "3.4 预设短语" "GET" "/v1/workspace/preset-phrases" "" "$TOKEN" "200"

# 3.5 快捷键
check "3.5 快捷键" "GET" "/v1/workspace/shortcuts" "" "$TOKEN" "200"

# 3.6 评论导出
check "3.6 评论导出" "GET" "/v1/projects/$PROJ_ID/comments/export" "" "$TOKEN" "200"

# 3.7 交付包
check "3.7 交付包" "GET" "/v1/projects/$PROJ_ID/delivery-package?option=original" "" "$TOKEN" "200"

# 3.8 导出ZIP
check "3.8 导出ZIP" "GET" "/v1/projects/$PROJ_ID/export-zip" "" "$TOKEN" "200"

# 3.9 导出PDF
check "3.9 导出PDF" "GET" "/v1/projects/$PROJ_ID/export-pdf" "" "$TOKEN" "200"

# 3.10 回收站
check "3.10 回收站" "GET" "/v1/recycle-bin" "" "$TOKEN" "200"

# 3.11 行话模板
check "3.11 行话模板" "GET" "/v1/jargon-templates" "" "$TOKEN" "200"

# 3.12 个人行话模板
check "3.12 个人行话模板" "GET" "/v1/personal-jargon-templates" "" "$TOKEN" "200"

# 3.13 项目模板
check "3.13 项目模板" "GET" "/v1/templates" "" "$TOKEN" "200"

# ============================================================
# Flow 4: 权限校验（安全）
# ============================================================
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FLOW 4: 权限与安全校验"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 4.1 未登录访问战情室
check "4.1 未登录→战情室" "GET" "/v1/dashboard" "" "" "401"

# 4.2 未登录访问项目
check "4.2 未登录→项目" "GET" "/v1/projects" "" "" "401"

# 4.3 未登录访问用户信息
check "4.3 未登录→用户信息" "GET" "/v1/users/me" "" "" "401"

# 4.4 无效token访问
check "4.4 无效token" "GET" "/v1/dashboard" "" "invalid-token" "401"

# 4.5 公开分享端点（无需登录）
check "4.5 公开分享" "GET" "/v1/share/$SHARE_TOKEN" "" "" "200"

# ============================================================
# 汇总
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
printf "║  验收测试: 通过 %-2d / 失败 %-2d / 总计 %-2d                          ║\n" $PASS $FAIL $((PASS+FAIL))
echo "╚══════════════════════════════════════════════════════════════╝"

exit $((FAIL > 0 ? 1 : 0))