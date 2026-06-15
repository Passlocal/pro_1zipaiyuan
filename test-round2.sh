#!/bin/bash
# EpicShot Round 2 — Comprehensive API Test (v2 with fixes)
BASE="http://localhost:3001/v1"
PASSED=0; FAILED=0; TOTAL=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED+1)); TOTAL=$((TOTAL+1)); }
fail() { echo "  ✗ $1 — $2"; FAILED=$((FAILED+1)); TOTAL=$((TOTAL+1)); }

# Get admin token
TOKEN=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" \
  -d '{"email":"zhang@epicshot.com","password":"admin123"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")

# =============================================================================
echo "=== SECTION 1: Authentication ==="
# =============================================================================

echo "1.1 POST /auth/login (valid)"
RES=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
[ -n "$(echo $RES | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")" ] && pass "Login success" || fail "Login" "$RES"

echo "1.2 POST /auth/login (wrong password)"
CODE=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"wrong"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "INVALID_CREDENTIALS" ] && pass "Wrong password returns INVALID_CREDENTIALS" || fail "Wrong password" "$CODE"

echo "1.3 POST /auth/login (missing fields)"
CODE=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Missing password returns VALIDATION_ERROR" || fail "Missing password" "$CODE"

echo "1.4 GET /users/me"
NAME=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
[ "$NAME" = "张总监" ] && pass "GetMe returns correct user" || fail "GetMe" "$NAME"

echo "1.5 GET /users/me (no token)"
CODE=$(curl -s "$BASE/users/me" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "UNAUTHORIZED" ] && pass "No token returns UNAUTHORIZED" || fail "No token" "$CODE"

echo "1.6 POST /auth/register (valid)"
RAND_EMAIL="test_$(date +%s)@epicshot.com"
RES=$(curl -s "$BASE/auth/register" -X POST -H "Content-Type: application/json" -d "{\"name\":\"测试用户\",\"email\":\"$RAND_EMAIL\",\"password\":\"Test123456\"}")
REG_TOKEN=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")
[ -n "$REG_TOKEN" ] && pass "Register success" || fail "Register" "$RES"

echo "1.7 POST /auth/register (duplicate email)"
CODE=$(curl -s "$BASE/auth/register" -X POST -H "Content-Type: application/json" -d '{"name":"重复","email":"zhang@epicshot.com","password":"Test123456"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "CONFLICT" ] && pass "Duplicate email returns CONFLICT" || fail "Duplicate email" "$CODE"

echo "1.8 POST /auth/register (short password)"
CODE=$(curl -s "$BASE/auth/register" -X POST -H "Content-Type: application/json" -d '{"name":"短密码","email":"short@test.com","password":"123"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Short password returns VALIDATION_ERROR" || fail "Short password" "$CODE"

# =============================================================================
echo ""
echo "=== SECTION 2: Projects ==="
# =============================================================================

echo "2.1 POST /projects (valid)"
RES=$(curl -s "$BASE/projects" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"第二轮测试项目","clientName":"测试客户","status":"review"}')
PROJ_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$PROJ_ID" ] && pass "Create project success" || fail "Create project" "$RES"

echo "2.2 POST /projects (missing name)"
CODE=$(curl -s "$BASE/projects" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"clientName":"no name"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Missing name returns VALIDATION_ERROR" || fail "Missing name" "$CODE"

echo "2.3 GET /projects"
COUNT=$(curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log('0')}})")
[ "$COUNT" -ge 1 ] && pass "List projects returns $COUNT items" || fail "List projects" "$COUNT"

echo "2.4 GET /projects/:id"
PNAME=$(curl -s "$BASE/projects/$PROJ_ID" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
[ "$PNAME" = "第二轮测试项目" ] && pass "Get project returns correct name" || fail "Get project" "$PNAME"

echo "2.5 PUT /projects/:id (update name+status)"
RES=$(curl -s "$BASE/projects/$PROJ_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"已更新项目","status":"in_progress"}')
UNAME=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
USTATUS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$UNAME" = "已更新项目" ] && [ "$USTATUS" = "in_progress" ] && pass "Update project OK" || fail "Update project" "$RES"

echo "2.6 PUT /projects/:id (status=completed)"
US=$(curl -s "$BASE/projects/$PROJ_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"completed"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$US" = "completed" ] && pass "Status to completed OK" || fail "Status completed" "$US"

echo "2.7 PUT /projects/:id (invalid status)"
CODE=$(curl -s "$BASE/projects/$PROJ_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"invalid_status"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Invalid status returns VALIDATION_ERROR" || fail "Invalid status" "$CODE"

echo "2.8 GET /projects/nonexistent"
CODE=$(curl -s "$BASE/projects/nonexistent" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "NOT_FOUND" ] && pass "Non-existent project returns NOT_FOUND" || fail "Non-existent project" "$CODE"

# =============================================================================
echo ""
echo "=== SECTION 3: Product Units & Images ==="
# =============================================================================

echo "3.1 POST /projects/:id/units"
RES=$(curl -s "$BASE/projects/$PROJ_ID/units" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"测试产品单元","code":"SKU-001"}')
UNIT_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$UNIT_ID" ] && pass "Create unit success" || fail "Create unit" "$RES"

echo "3.2 GET /projects/:id/units"
UCOUNT=$(curl -s "$BASE/projects/$PROJ_ID/units" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log('0')}})")
[ "$UCOUNT" -ge 1 ] && pass "List units returns $UCOUNT items" || fail "List units" "$UCOUNT"

echo "3.3 POST /units/:id/images"
RES=$(curl -s "$BASE/units/$UNIT_ID/images" -X POST -H "Authorization: Bearer $TOKEN" -F "files=@/workspace/epicshot-backend/uploads/placeholder.svg")
IMG_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data[0].id)}catch(e){console.log('')}})")
[ -n "$IMG_ID" ] && pass "Upload image success" || fail "Upload image" "$RES"

echo "3.4 POST /units/:id/images (no file)"
CODE=$(curl -s "$BASE/units/$UNIT_ID/images" -X POST -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "No file returns VALIDATION_ERROR" || fail "No file" "$CODE"

echo "3.5 GET /units/:id/images"
ICOUNT=$(curl -s "$BASE/units/$UNIT_ID/images" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log('0')}})")
[ "$ICOUNT" -ge 1 ] && pass "List images returns $ICOUNT items" || fail "List images" "$ICOUNT"

echo "3.6 PUT /projects/:id/units/reorder"
RES=$(curl -s "$BASE/projects/$PROJ_ID/units/reorder" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"ids\":[\"$UNIT_ID\"]}")
CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('fail')}})")
[ "$CODE" = "OK" ] && pass "Reorder units OK" || fail "Reorder units" "$RES"

# =============================================================================
echo ""
echo "=== SECTION 4: Annotations ==="
# =============================================================================

echo "4.1 POST /images/:id/annotations (rectangle)"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toolType":"rectangle","coordinates":{"x":10,"y":20,"width":100,"height":80},"style":{"color":"#ff0000","strokeWidth":2}}')
ANN_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$ANN_ID" ] && pass "Create rectangle annotation" || fail "Create rectangle" "$RES"

echo "4.2 POST /images/:id/annotations (pen)"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toolType":"pen","coordinates":{"points":[[0,0],[10,10]]},"style":{"color":"#00ff00","strokeWidth":3}}')
PEN_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$PEN_ID" ] && pass "Create pen annotation" || fail "Create pen" "$RES"

echo "4.3 POST /images/:id/annotations (ellipse)"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toolType":"ellipse","coordinates":{"cx":50,"cy":50,"rx":30,"ry":20},"style":{"color":"#0000ff"}}')
ELLIPSE_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$ELLIPSE_ID" ] && pass "Create ellipse annotation" || fail "Create ellipse" "$RES"

echo "4.4 PUT /annotations/:id"
RES=$(curl -s "$BASE/annotations/$ANN_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"coordinates":{"x":50,"y":60,"width":120,"height":90}}')
UPD=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data?'ok':'fail')}catch(e){console.log('fail')}})")
[ "$UPD" = "ok" ] && pass "Update annotation OK" || fail "Update annotation" "$RES"

echo "4.5 DELETE /annotations/:id"
DEL=$(curl -s "$BASE/annotations/$PEN_ID" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('fail')}})")
[ "$DEL" = "OK" ] && pass "Delete annotation OK" || fail "Delete annotation" "$DEL"

# =============================================================================
echo ""
echo "=== SECTION 5: Comment Cards ==="
# =============================================================================

echo "5.1 POST /comment-cards (create)"
RES=$(curl -s "$BASE/comment-cards" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\",\"text\":\"需要调整亮度\",\"annotationId\":\"$ANN_ID\"}")
CARD_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$CARD_ID" ] && pass "Create comment card success" || fail "Create comment card" "$RES"

echo "5.2 GET /images/:id/comment-cards"
CCOUNT=$(curl -s "$BASE/images/$IMG_ID/comment-cards" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log('0')}})")
[ "$CCOUNT" -ge 1 ] && pass "List comment cards: $CCOUNT items" || fail "List comment cards" "$CCOUNT"

echo "5.3 PUT /comment-cards/:id/status (resolve)"
CSTATUS=$(curl -s "$BASE/comment-cards/$CARD_ID/status" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"resolve"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$CSTATUS" = "resolved" ] && pass "Resolve comment card OK" || fail "Resolve" "$CSTATUS"

echo "5.4 PUT /comment-cards/:id/status (unresolve)"
CSTATUS2=$(curl -s "$BASE/comment-cards/$CARD_ID/status" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"unresolve"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$CSTATUS2" = "unresolved" ] && pass "Unresolve returns to unresolved" || fail "Unresolve" "$CSTATUS2"

echo "5.5 PUT /comment-cards/:id/status (invalid action)"
CODE=$(curl -s "$BASE/comment-cards/$CARD_ID/status" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"invalid"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Invalid action returns VALIDATION_ERROR" || fail "Invalid action" "$CODE"

# =============================================================================
echo ""
echo "=== SECTION 6: AI & Share ==="
# =============================================================================

echo "6.1 POST /projects/:id/share"
RES=$(curl -s "$BASE/projects/$PROJ_ID/share" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"role":"client"}')
SHARE_TOKEN=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")
[ -n "$SHARE_TOKEN" ] && pass "Create share link success" || fail "Create share" "$RES"

echo "6.2 GET /share/:token (no auth)"
SPROJ=$(curl -s "$BASE/share/$SHARE_TOKEN" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data.project?j.data.project.id:j.code||'NOT_FOUND')}catch(e){console.log('err')}})")
[ "$SPROJ" = "$PROJ_ID" ] && pass "Share token access OK" || fail "Share token" "$SPROJ"

echo "6.3 GET /share/invalid"
CODE=$(curl -s "$BASE/share/invalid" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "NOT_FOUND" ] && pass "Invalid share token returns NOT_FOUND" || fail "Invalid share" "$CODE"

echo "6.4 POST /ai/color-check"
RES=$(curl -s "$BASE/ai/color-check" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":\"$PROJ_ID\"}")
TASK_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.taskId)}catch(e){console.log('')}})")
[ -n "$TASK_ID" ] && pass "Color check POST success" || fail "Color check POST" "$RES"

echo "6.5 GET /ai/color-check/:taskId"
RES=$(curl -s "$BASE/ai/color-check/$TASK_ID" -H "Authorization: Bearer $TOKEN")
CPROJ=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.projectId)}catch(e){console.log('')}})")
CITEMS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.items.length)}catch(e){console.log('0')}})")
[ "$CPROJ" = "$PROJ_ID" ] && pass "Color check GET returns real data ($CITEMS items)" || fail "Color check GET" "$RES"

echo "6.6 POST /ai/color-check (missing projectId)"
CODE=$(curl -s "$BASE/ai/color-check" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "VALIDATION_ERROR" ] && pass "Missing projectId returns VALIDATION_ERROR" || fail "Missing projectId" "$CODE"

# =============================================================================
echo ""
echo "=== SECTION 7: Revisions & Timeline ==="
# =============================================================================

echo "7.1 POST /images/:id/revision"
RES=$(curl -s "$BASE/images/$IMG_ID/revision" -X POST -H "Authorization: Bearer $TOKEN" -F "file=@/workspace/epicshot-backend/uploads/placeholder.svg")
REV_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$REV_ID" ] && pass "Upload revision success" || fail "Upload revision" "$RES"

echo "7.2 GET /images/:id/revisions (check route)"
RCOUNT=$(curl -s "$BASE/images/img-001/revisions" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data?JSON.parse(d).data.length:'no_data')}catch(e){console.log('err')}})")
echo "  (revisions route test: $RCOUNT)"

echo "7.3 GET /projects/:id/timeline"
TCOUNT=$(curl -s "$BASE/projects/$PROJ_ID/timeline" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log('0')}})")
[ "$TCOUNT" -ge 1 ] && pass "Timeline returns $TCOUNT events" || fail "Timeline" "$TCOUNT"

# =============================================================================
echo ""
echo "=== SECTION 8: Frontend HTTP Check ==="
# =============================================================================

echo "8.1 GET /login"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/login)
[ "$HTTP" = "200" ] && pass "Frontend /login returns 200" || fail "Frontend /login" "$HTTP"

echo "8.2 GET /register"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/register)
[ "$HTTP" = "200" ] && pass "Frontend /register returns 200" || fail "Frontend /register" "$HTTP"

echo "8.3 GET / (dashboard)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)
[ "$HTTP" = "200" ] && pass "Frontend / returns 200" || fail "Frontend /" "$HTTP"

echo "8.4 GET /404"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/nonexistent-page)
[ "$HTTP" = "200" ] && pass "Frontend 404 page returns 200 (SPA)" || fail "Frontend 404" "$HTTP"

# =============================================================================
echo ""
echo "=== SECTION 9: Cleanup ==="
# =============================================================================

echo "9.1 DELETE /projects/:id"
DEL=$(curl -s "$BASE/projects/$PROJ_ID" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('fail')}})")
[ "$DEL" = "OK" ] && pass "Delete project OK" || fail "Delete project" "$DEL"

echo "9.2 Verify deletion"
CODE=$(curl -s "$BASE/projects/$PROJ_ID" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code)}catch(e){console.log('')}})")
[ "$CODE" = "NOT_FOUND" ] && pass "Deleted project returns NOT_FOUND" || fail "Deleted project" "$CODE"

# =============================================================================
echo ""
echo "============================================"
echo "           TEST SUMMARY"
echo "============================================"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $TOTAL"
echo "============================================"
[ "$FAILED" -eq 0 ] && echo "  ALL TESTS PASSED" || echo "  SOME TESTS FAILED"
echo "============================================"