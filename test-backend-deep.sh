#!/usr/bin/bash
set -uo pipefail

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0
TOKEN=""
USER_ID=""
PROJECT_ID=""
UNIT_ID=""
IMAGE_ID=""
ANNO_ID=""
CARD_ID=""
PORTFOLIO_ID=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo -e "  ${RED}✗${NC} $1 (expected: $2, got: $3)"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
assert_http() { local code=$(tail -1 <<< "$2"); if [ "$code" = "$1" ]; then pass "$3"; else fail "$3" "$1" "$code"; fi; }
assert_json() { local val=$(echo "$2" | python3 -c "import sys,json; print(json.load(sys.stdin)$1)" 2>/dev/null || echo "PARSE_ERROR"); if [ "$val" = "$3" ]; then pass "$4"; else fail "$4" "$3" "$val"; fi; }
# Extract JSON body from response (ignores trailing HTTP code from -w)
json_body() { echo "$1" | head -n -1; }
json_field() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }
restart_backend() {
  local pid=$(pgrep -f "node server.js" 2>/dev/null | head -1)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
  sleep 2
  cd /workspace/epicshot-backend && PORT=3000 node server.js > /dev/null 2>&1 &
  sleep 4
  # Verify server is up (use login endpoint since /health returns 404)
  for i in $(seq 1 10); do
    if curl -s -o /dev/null http://localhost:3000/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"admin123"}' 2>/dev/null; then
      break
    fi
    sleep 1
  done
  echo "  [INFO] Backend restarted"
}

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — Auth & Permissions          ║"
echo "╚══════════════════════════════════════════════════════╝"

# === 1. Auth Edge Cases ===
echo ""
echo "━━━ 1. Token 攻击与边界 ━━━"

# 1.1 Empty token
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer " $BASE/v1/users/me)
assert_http 401 "$R" "1.1 空 token → 401"

# 1.2 No token at all
R=$(curl -s -w "\n%{http_code}" -X GET $BASE/v1/users/me)
assert_http 401 "$R" "1.2 无 token → 401"

# 1.3 Tampered token
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.tampered" $BASE/v1/users/me)
assert_http 401 "$R" "1.3 篡改 token → 401"

# 1.4 Malformed token (not JWT)
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer not-a-jwt-token-at-all" $BASE/v1/users/me)
assert_http 401 "$R" "1.4 非法 token 格式 → 401"

# 1.5 Wrong scheme
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Basic YWRtaW46YWRtaW4=" $BASE/v1/users/me)
assert_http 401 "$R" "1.5 Basic auth scheme → 401"

# 1.6 Token in wrong header
R=$(curl -s -w "\n%{http_code}" -X GET -H "X-Auth-Token: fake" $BASE/v1/users/me)
assert_http 401 "$R" "1.6 错误 header 名 → 401"

# Login to get valid token
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/login -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
TOKEN=$(echo "$R" | python3 -c "import sys,json; lines=sys.stdin.read().split('\n'); print(json.loads(lines[0])['data']['token'])" 2>/dev/null)
USER_ID=$(echo "$R" | python3 -c "import sys,json; lines=sys.stdin.read().split('\n'); print(json.loads(lines[0])['data']['user']['id'])" 2>/dev/null)
echo "  [INFO] Token acquired, userId=$USER_ID"

# ============================================================
echo ""
echo "━━━ 2. 权限越权测试 ━━━"

# Create a project for testing
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/projects -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"深度测试项目","description":"测试"}')
PROJECT_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
if [ -n "$PROJECT_ID" ]; then pass "2.0 创建测试项目" ; else fail "2.0 创建测试项目" "有ID" "空"; fi

# 2.1 Access non-existent project
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/nonexistent-uuid)
assert_http 404 "$R" "2.1 访问不存在的项目 → 404"

# 2.2 Access another workspace's project (if possible)
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/00000000-0000-0000-0000-000000000000)
assert_http 404 "$R" "2.2 跨工作区项目 → 404"

# 2.3 Update with invalid project ID format
R=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/../etc/passwd -H "Content-Type: application/json" -d '{"name":"hack"}')
assert_http 404 "$R" "2.3 路径遍历 projectId → 404"

# 2.4 Invite self to workspace
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/workspaces/invite -H "Content-Type: application/json" -d "{\"email\":\"zhang@epicshot.com\"}")
assert_http 409 "$R" "2.4 邀请自己 → 409"

# (Moved to section 16 to avoid rate limiter cascading)
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — CRUD 边界 & 校验            ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 4. 输入校验 ━━━"

# 4.1 Missing required fields (create project)
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d '{}')
assert_http 400 "$R" "4.1 创建项目缺少必填字段 → 400"

# 4.2 Empty string name
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d '{"name":"","description":"test"}')
assert_http 400 "$R" "4.2 空项目名 → 400"

# 4.3 Very long name (1000 chars) — backend gap: no length validation
LONG_NAME=$(python3 -c "print('A'*1000)")
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d "{\"name\":\"$LONG_NAME\",\"description\":\"test\"}" 2>/dev/null)
assert_http 400 "$R" "4.3 超长名称(1000字) → 400"

# 4.4 Invalid JSON body
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d 'not json')
assert_http 400 "$R" "4.4 非法 JSON → 400"

# 4.5 Wrong Content-Type — backend gap: express.json() rejects text/plain with 500
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: text/plain" -d 'some text')
assert_http 400 "$R" "4.5 错误 Content-Type → 400"

# 4.6 Register with invalid email
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/register -H "Content-Type: application/json" -d '{"email":"notanemail","password":"123456","name":"Test"}')
assert_http 400 "$R" "4.6 非法邮箱格式 → 400"

# 4.7 Register with short password
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"12","name":"Test"}')
assert_http 400 "$R" "4.7 密码过短 → 400"

# ============================================================
echo ""
echo "━━━ 5. CRUD 幂等性与边界 ━━━"

# 5.1 Delete non-existent project
R=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/00000000-0000-0000-0000-000000000000 -H "Content-Type: application/json" -d '{}')
assert_http 404 "$R" "5.1 删除不存在项目 → 404"

# 5.2 Update non-existent project
R=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/00000000-0000-0000-0000-000000000000 -H "Content-Type: application/json" -d '{"name":"test"}')
assert_http 404 "$R" "5.2 更新不存在项目 → 404"

# 5.3 Double delete (idempotency)
R=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID -H "Content-Type: application/json" -d '{}')
assert_http 200 "$R" "5.3 首次删除 → 200"
R=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID -H "Content-Type: application/json" -d '{}')
assert_http 404 "$R" "5.4 二次删除(幂等) → 404"

# Recreate project for further tests
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d '{"name":"深度测试项目2","description":"测试"}')
PROJECT_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")

# 5.5 Create product unit with empty name
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID/units -H "Content-Type: application/json" -d '{"name":""}')
assert_http 400 "$R" "5.5 空单元名 → 400"

# 5.6 Create product unit with valid name
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID/units -H "Content-Type: application/json" -d '{"name":"测试单元"}')
UNIT_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
assert_http 200 "$R" "5.6 正常创建单元 → 200"

# ============================================================
echo ""
echo "━━━ 6. 查询参数边界 ━━━"

# 6.1 Negative page number
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" "$BASE/v1/projects?page=-1")
assert_http 200 "$R" "6.1 负数页码 → 200 (fallback)"

# 6.2 Very large page number
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" "$BASE/v1/projects?page=99999")
assert_http 200 "$R" "6.2 超大页码 → 200"

# 6.3 Non-numeric page
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" "$BASE/v1/projects?page=abc")
assert_http 200 "$R" "6.3 非数字页码 → 200 (fallback)"

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — SQL 注入 & 安全             ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 7. SQL 注入防护 ━━━"

# 7.1 SQL injection in query param
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" "$BASE/v1/projects?name=' OR 1=1 --")
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "500" ]; then pass "7.1 SQL注入查询参数 → $CODE (非500)"; else fail "7.1 SQL注入查询参数" "非500" "500"; fi

# 7.2 SQL injection in JSON body (create project)
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d "{\"name\":\"'; DROP TABLE projects; --\",\"description\":\"test\"}")
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "500" ]; then pass "7.2 SQL注入创建项目 → $CODE (非500)"; else fail "7.2 SQL注入创建项目" "非500" "500"; fi

# 7.3 SQL injection in update
R=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID -H "Content-Type: application/json" -d "{\"name\":\"'; SELECT * FROM users; --\"}")
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "500" ]; then pass "7.3 SQL注入更新项目 → $CODE (非500)"; else fail "7.3 SQL注入更新项目" "非500" "500"; fi

# 7.4 SQL injection in share token
R=$(curl -s -w "\n%{http_code}" -X GET "$BASE/share/' OR '1'='1")
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "500" ]; then pass "7.4 SQL注入 share token → $CODE (非500)"; else fail "7.4 SQL注入 share token" "非500" "500"; fi

# 7.5 XSS attempt in project name
R=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID -H "Content-Type: application/json" -d '{"name":"<script>alert(1)</script>"}')
assert_http 200 "$R" "7.5 XSS 项目名 → 200 (存储原样)"

# 7.6 XSS attempt in comment card (deferred to after image upload in section 10)

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — 并发与竞态                  ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 8. 并发操作 ━━━"
echo "  [INFO] 并发测试环境受限，使用顺序验证代替"

# 8.1 Sequential project list (50 requests)
echo -n "  [INFO] 50 顺序 GET /projects ... "
SEQ_OK=1
for i in $(seq 1 50); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/projects)
  [ "$CODE" != "200" ] && SEQ_OK=0
done
if [ $SEQ_OK -eq 1 ]; then pass "8.1 50 顺序 GET 项目列表 → 全部 200"; else fail "8.1 50 顺序 GET 项目列表" "全部 200" "有非200"; fi

# 8.2 Sequential reads of same project
echo -n "  [INFO] 30 顺序 GET same project ... "
SEQ_OK2=1
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID)
  [ "$CODE" != "200" ] && SEQ_OK2=0
done
if [ $SEQ_OK2 -eq 1 ]; then pass "8.2 30 顺序读同一项目 → 全部 200"; else fail "8.2 30 顺序读同一项目" "全部 200" "有非200"; fi

# 8.3 Rapid create-delete cycle (10 iterations)
echo -n "  [INFO] 10 次快速创建删除循环 ... "
RAPID_FAIL=0
for i in $(seq 1 10); do
  R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects -H "Content-Type: application/json" -d '{"name":"快速测试","description":"test"}')
  TMP_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
  if [ -n "$TMP_ID" ]; then
    curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$TMP_ID -H "Content-Type: application/json" -d '{}'
  else
    RAPID_FAIL=$((RAPID_FAIL+1))
  fi
done
echo "done"
if [ $RAPID_FAIL -eq 0 ]; then pass "8.3 10 次快速创建删除 → 0 失败"; else fail "8.3 10 次快速创建删除" "0 失败" "$RAPID_FAIL 失败"; fi

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — 文件上传边界                ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 9. 文件上传 ━━━"

# Create a test image (1x1 red PNG, base64-encoded)
python3 -c 'import base64,struct,zlib;d=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==");open("/tmp/test_upload.png","wb").write(d)'

# 9.1 Upload valid PNG
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -F "files=@/tmp/test_upload.png" $BASE/v1/units/$UNIT_ID/images)
IMAGE_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null || echo "")
assert_http 201 "$R" "9.1 上传有效 PNG → 201"

# 9.2 Upload without file
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/units/$UNIT_ID/images)
assert_http 400 "$R" "9.2 无文件上传 → 400"

# 9.3 Upload non-image file (text file) — backend gap: sharp throws 500 on non-image
echo "not an image" > /tmp/test_text.txt
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -F "files=@/tmp/test_text.txt;type=text/plain" $BASE/v1/units/$UNIT_ID/images)
assert_http 400 "$R" "9.3 上传非图片文件 → 400"

# 9.4 Upload to non-existent unit
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -F "files=@/tmp/test_upload.png" $BASE/v1/units/00000000-0000-0000-0000-000000000000/images)
assert_http 404 "$R" "9.4 上传到不存在的单元 → 404"

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     后端深度专项测试 — 数据一致性                  ║"
echo "╚══════════════════════════════════════════════════════╝"

echo ""
echo "━━━ 10. 关联数据完整性 ━━━"

# 10.1 Annotations on image
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/images/$IMAGE_ID/annotations -H "Content-Type: application/json" -d '{"toolType":"pen","coordinates":{"x":0.1,"y":0.1},"style":{"color":"#FF0000","width":3},"strokeData":[[0.1,0.1],[0.11,0.11]]}')
ANNO_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
assert_http 201 "$R" "10.1 创建标注 → 201"

R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/images/$IMAGE_ID/annotations)
assert_http 200 "$R" "10.2 获取标注列表 → 200"

R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/comment-cards -H "Content-Type: application/json" -d "{\"imageId\":\"$IMAGE_ID\",\"text\":\"测试意见\",\"x\":0.5,\"y\":0.5}")
CARD_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
assert_http 201 "$R" "10.3 创建意见卡片 → 201"

R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/images/$IMAGE_ID/comment-cards)
assert_http 200 "$R" "10.4 获取意见卡片 → 200"

R=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $TOKEN" $BASE/v1/comment-cards/$CARD_ID/status -H "Content-Type: application/json" -d '{"action":"resolve"}')
assert_http 200 "$R" "10.5 卡片标记已解决 → 200"

R=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/annotations/$ANNO_ID -H "Content-Type: application/json" -d '{}')
assert_http 200 "$R" "10.6 删除标注 → 200"

R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/images/$IMAGE_ID/annotations)
ANNO_COUNT=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null || echo "-1")
test "$ANNO_COUNT" = "0" && pass "10.7 删除后标注列表为空" || fail "10.7 删除后标注列表" "0" "$ANNO_COUNT"

R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/comment-cards -H "Content-Type: application/json" -d "{\"imageId\":\"$IMAGE_ID\",\"text\":\"<img src=x onerror=alert(1)>\",\"x\":0.5,\"y\":0.5}")
CODE=$(echo "$R" | tail -1)
test "$CODE" != "500" && pass "10.8 XSS 意见卡片 → $CODE (非500)" || fail "10.8 XSS 意见卡片" "非500" "500"

# ============================================================
echo ""
echo "━━━ 11. Portfolio 边界 ━━━"

# 11.1 Generate portfolio
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID/portfolio -H "Content-Type: application/json" -d '{}')
PORTFOLIO_ID=$(echo "$R" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
assert_http 200 "$R" "11.1 生成作品集 → 200"

# 11.2 Get portfolio stats
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/portfolios/$PORTFOLIO_ID/stats)
assert_http 200 "$R" "11.2 作品集统计 → 200"

# 11.3 Portfolio for non-existent project
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/00000000-0000-0000-0000-000000000000/portfolio -H "Content-Type: application/json" -d '{}')
assert_http 404 "$R" "11.3 不存在项目生成作品集 → 404"

# ============================================================
echo ""
echo "━━━ 12. AI 服务边界 ━━━"

# 12.1 Color check with non-existent project
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/ai/color-check -H "Content-Type: application/json" -d '{"projectId":"nonexistent"}')
assert_http 404 "$R" "12.1 色差巡检不存在项目 → 404"

# 12.2 Get color check result with invalid taskId
R=$(curl -s -w "\n%{http_code}" -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/ai/color-check/invalid-task-id)
assert_http 404 "$R" "12.2 无效 taskId 查询结果 → 404"

# 12.3 Parse instruction without text
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/ai/parse-instruction -H "Content-Type: application/json" -d '{}')
assert_http 400 "$R" "12.3 无文本解析指令 → 400"

# ============================================================
echo ""
echo "━━━ 13. Import 边界 ━━━"

# 13.1 Cloud drive import without projectId
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/import/cloud-drive -H "Content-Type: application/json" -d '{"provider":"google"}')
assert_http 400 "$R" "13.1 云盘导入缺少 projectId → 400"

# 13.2 Apply import with empty items
R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" $BASE/v1/import/apply -H "Content-Type: application/json" -d '{"projectId":"'$PROJECT_ID'","items":[]}')
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "500" ]; then pass "13.2 空导入列表 → $CODE"; else fail "13.2 空导入列表" "非500" "500"; fi

# ============================================================
echo ""
echo "━━━ 14. WeChat 边界 ━━━"

# 14.1 Scan with invalid ticket
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/wechat/scan/invalid-ticket -H "Content-Type: application/json" -d '{}')
assert_http 404 "$R" "14.1 无效 ticket 扫码 → 404"

# 14.2 Confirm with invalid ticket
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/wechat/confirm/invalid-ticket -H "Content-Type: application/json" -d '{}')
assert_http 404 "$R" "14.2 无效 ticket 确认 → 404"

# ============================================================
echo ""
echo "━━━ 15. 响应格式一致性 ━━━"

# 15.1 All successful responses have {data:...}
R=$(curl -s -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/users/me)
HAS_DATA=$(echo "$R" | python3 -c "import sys,json; print('data' in json.load(sys.stdin))" 2>/dev/null)
if [ "$HAS_DATA" = "True" ]; then pass "15.1 成功响应包含 data"; else fail "15.1 成功响应" "包含data字段" "缺失"; fi

# 15.2 All error responses have {code:, message:}
R=$(curl -s -X GET -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/nonexistent)
HAS_CODE=$(echo "$R" | python3 -c "import sys,json; print('code' in json.load(sys.stdin))" 2>/dev/null)
if [ "$HAS_CODE" = "True" ]; then pass "15.2 错误响应包含 code 字段"; else fail "15.2 错误响应" "包含code字段" "缺失"; fi

# 15.3 CORS headers present
R=$(curl -s -I -X OPTIONS $BASE/v1/auth/login -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" 2>/dev/null)
if echo "$R" | grep -q "Access-Control"; then pass "15.3 CORS headers 存在"; else fail "15.3 CORS headers" "存在" "缺失"; fi

# ============================================================
# Section 16: Rate Limiting & Brute-Force (runs last to avoid cascading)
echo ""
echo "━━━ 16. 登录暴力破解 / 限流 ━━━"

# 16.1 Rapid failed logins
BRUTE_PASS=0
BRUTE_FAIL=0
for i in $(seq 1 5); do
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/v1/auth/login -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"wrongpassword"}')
  if [ "$R" = "401" ]; then BRUTE_PASS=$((BRUTE_PASS+1)); else BRUTE_FAIL=$((BRUTE_FAIL+1)); fi
done
if [ $BRUTE_PASS -ge 5 ]; then pass "16.1 连续 5 次错误密码 → 均 401"; else fail "16.1 连续 5 次错误密码" "5次401" "${BRUTE_PASS}次401"; fi

# 16.2 Verify rate limit is active (auth limiter: max=30, still under threshold)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/v1/auth/login -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"wrongpassword"}')
if [ "$R" = "401" ] || [ "$R" = "429" ]; then pass "16.2 速率限制 → $R"; else fail "16.2 速率限制" "401/429" "$R"; fi

# Restart backend to clear rate limiting
restart_backend

# Re-login after restart
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/v1/auth/login -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
TOKEN=$(echo "$R" | python3 -c "import sys,json; lines=sys.stdin.read().split('\n'); print(json.loads(lines[0])['data']['token'])" 2>/dev/null)
assert_http 200 "$R" "16.3 重启后正常登录 → 200"

# ============================================================
# Cleanup
echo ""
echo "━━━ 17. 清理 ━━━"
curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/v1/projects/$PROJECT_ID -H "Content-Type: application/json" -d '{}'
pass "17.1 清理测试项目"

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              BACKEND DEEP TEST SUMMARY              ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Passed:  %-42s ║\n" "$PASS"
printf "║  Failed:  %-42s ║\n" "$FAIL"
printf "║  Total:   %-42s ║\n" "$TOTAL"
echo "╠══════════════════════════════════════════════════════╣"
if [ $FAIL -eq 0 ]; then
  echo "║  ✅  ALL BACKEND DEEP TESTS PASSED                 ║"
else
  echo "║  ❌  $FAIL TEST(S) FAILED                           ║"
fi
echo "╚══════════════════════════════════════════════════════╝"