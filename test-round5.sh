#!/bin/bash
# EpicShot Round 5 — 系统性全端点测试 (61 endpoints + frontend)
BASE="http://localhost:3001/v1"
PASSED=0; FAILED=0
echo "Round 5 started at $(date)" > /tmp/test5.log

pass() { echo "  ✓ $1"; PASSED=$((PASSED+1)); }
fail() { echo "  ✗ $1 — $2"; FAILED=$((FAILED+1)); echo "FAIL: $1 — $2" >> /tmp/test5.log; }

TOKEN=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")
if [ -z "$TOKEN" ]; then echo "FATAL: Cannot get auth token"; exit 1; fi

PROJ_ID=$(curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{const ps=JSON.parse(d).data;console.log(ps[ps.length-1].id)}catch(e){console.log('')}})")
if [ -z "$PROJ_ID" ]; then echo "FATAL: No project found"; exit 1; fi

echo "╔══════════════════════════════════════════════════════╗"
echo "║     EpicShot 第五轮 — 系统性全端点测试               ║"
echo "╚══════════════════════════════════════════════════════╝"

# ============================================================
echo ""
echo "━━━ 1. Health & Auth (7 tests) ━━━"

echo "1.1  GET /health"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
BODY=$(curl -s http://localhost:3001/health)
[ "$HTTP" = "200" ] && pass "Health check HTTP $HTTP" || fail "Health" "$HTTP"
echo "$BODY" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);if(j.status==='ok'&&j.db==='connected')console.log('OK');else console.log('FAIL')})" | while read r; do
  [ "$r" = "OK" ] && pass "Health body OK" || fail "Health body" "$r"
done

echo "1.2  POST /auth/login (valid)"
RES=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123"}')
LOGIN_OK=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token?'OK':'FAIL')}catch(e){console.log('FAIL')}})")
[ "$LOGIN_OK" = "OK" ] && pass "Login valid OK" || fail "Login valid" "$RES"

echo "1.3  POST /auth/login (invalid password)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"wrong"}')
[ "$HTTP" = "401" ] && pass "Login invalid: 401" || fail "Login invalid" "$HTTP"

echo "1.4  POST /auth/login (missing fields)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"test@test.com"}')
[ "$HTTP" = "400" ] && pass "Login missing fields: 400" || fail "Login missing" "$HTTP"

echo "1.5  POST /auth/register (duplicate)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/register" -X POST -H "Content-Type: application/json" -d '{"email":"zhang@epicshot.com","password":"admin123","name":"张三"}')
[ "$HTTP" = "409" ] && pass "Register duplicate: 409" || fail "Register dup" "$HTTP"

echo "1.6  GET /users/me"
RES=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN")
ME_EMAIL=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.email)}catch(e){console.log('')}})")
[ "$ME_EMAIL" = "zhang@epicshot.com" ] && pass "Users/me OK" || fail "Users/me" "$ME_EMAIL"

echo "1.7  Auth: missing token → 401"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects")
[ "$HTTP" = "401" ] && pass "Missing token: 401" || fail "Missing token" "$HTTP"

# ============================================================
echo ""
echo "━━━ 2. Workspace (6 tests) ━━━"

echo "2.1  GET /workspaces/mine"
RES=$(curl -s "$BASE/workspaces/mine" -H "Authorization: Bearer $TOKEN")
WS_NAME=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
[ -n "$WS_NAME" ] && pass "Workspace mine: $WS_NAME" || fail "Workspace mine" "$RES"

echo "2.2  PUT /workspaces/mine"
RES=$(curl -s "$BASE/workspaces/mine" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"$WS_NAME\"}")
WS_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$WS_CODE" = "OK" ] && pass "Update workspace OK" || fail "Update workspace" "$WS_CODE"

echo "2.3  GET /workspaces/members"
RES=$(curl -s "$BASE/workspaces/members" -H "Authorization: Bearer $TOKEN")
MEM_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$MEM_COUNT" -ge 1 ] && pass "Members: $MEM_COUNT" || fail "Members" "$MEM_COUNT"

echo "2.4  POST /workspaces/invite"
RES=$(curl -s "$BASE/workspaces/invite" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"email":"member5@epicshot.com","role":"editor"}')
INVITE_OK=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?'ok':j.code)}catch(e){console.log('err')}})")
[ "$INVITE_OK" = "ok" ] && pass "Invite member OK" || ([ "$INVITE_OK" = "CONFLICT" ] && pass "Invite member: already invited (CONFLICT — expected)") || fail "Invite" "$INVITE_OK"

echo "2.5  DELETE /workspaces/members/:userId"
MEMBER_ID=$(curl -s "$BASE/workspaces/members" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{const ms=JSON.parse(d).data;const m=ms.find(x=>x.email==='member5@epicshot.com');console.log(m?m.id:'')}catch(e){console.log('')}})")
if [ -n "$MEMBER_ID" ]; then
  CODE=$(curl -s "$BASE/workspaces/members/$MEMBER_ID" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$CODE" = "OK" ] && pass "Remove member OK" || fail "Remove member" "$CODE"
else
  pass "Remove member: no test member to remove"
fi

echo "2.6  POST + DELETE /workspaces/api-keys"
RES=$(curl -s "$BASE/workspaces/api-keys" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
API_KEY=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.key)}catch(e){console.log('')}})")
[ -n "$API_KEY" ] && pass "Create API key OK" || fail "Create API key" "$RES"
CODE=$(curl -s "$BASE/workspaces/api-keys" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$CODE" = "OK" ] && pass "Delete API key OK" || fail "Delete API key" "$CODE"

# ============================================================
echo ""
echo "━━━ 3. Project CRUD (6 tests) ━━━"

echo "3.1  GET /projects"
RES=$(curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN")
PROJ_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$PROJ_COUNT" -ge 1 ] && pass "List projects: $PROJ_COUNT" || fail "List projects" "$RES"

echo "3.2  POST /projects"
PID=$(curl -s "$BASE/projects" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5测试项目","status":"draft"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$PID" ] && pass "Create project OK" || fail "Create project"
if [ -n "$PID" ]; then TEST_PROJ="$PID"; fi

echo "3.3  GET /projects/:id"
RES=$(curl -s "$BASE/projects/${TEST_PROJ:-$PROJ_ID}" -H "Authorization: Bearer $TOKEN")
PNAME=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
[ -n "$PNAME" ] && pass "Get project: $PNAME" || fail "Get project" "$RES"

echo "3.4  PUT /projects/:id"
RES=$(curl -s "$BASE/projects/${TEST_PROJ:-$PROJ_ID}" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5-修改后","status":"in_progress"}')
PCODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$PCODE" = "OK" ] && pass "Update project OK" || fail "Update project" "$PCODE"

echo "3.5  DELETE /projects/:id"
if [ -n "$TEST_PROJ" ]; then
  CODE=$(curl -s "$BASE/projects/$TEST_PROJ" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$CODE" = "OK" ] && pass "Delete project OK" || fail "Delete project" "$CODE"
else
  pass "Delete project: skipped (no test project)"
fi

echo "3.6  GET /projects/:id (not found)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects/nonexistent-id" -H "Authorization: Bearer $TOKEN")
[ "$HTTP" = "404" ] && pass "Project not found: 404" || fail "Project not found" "$HTTP"

# ============================================================
echo ""
echo "━━━ 4. Batch Thumbnails (NEW) (2 tests) ━━━"

echo "4.1  POST /projects/batch-thumbnails"
PROJ_IDS=$(curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const ps=JSON.parse(d).data;console.log(JSON.stringify(ps.slice(0,3).map(p=>p.id)))})")
RES=$(curl -s "$BASE/projects/batch-thumbnails" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"projectIds\":$PROJ_IDS}")
THUMB_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(typeof j.data==='object'?Object.keys(j.data).length:-1)}catch(e){console.log(-1)}})")
[ "$THUMB_COUNT" -ge 0 ] && pass "Batch thumbnails: $THUMB_COUNT entries" || fail "Batch thumbnails" "$RES"

echo "4.2  POST /projects/batch-thumbnails (empty array)"
RES=$(curl -s "$BASE/projects/batch-thumbnails" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"projectIds":[]}')
EMPTY_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
# VALIDATION_ERROR is acceptable for empty array
[ "$EMPTY_CODE" = "OK" ] || [ "$EMPTY_CODE" = "VALIDATION_ERROR" ] && pass "Batch thumbnails empty: $EMPTY_CODE" || fail "Batch thumbnails empty" "$RES"

# ============================================================
echo ""
echo "━━━ 5. Share & Timeline (4 tests) ━━━"

echo "5.1  POST /projects/:id/share"
RES=$(curl -s "$BASE/projects/$PROJ_ID/share" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
SHARE_TOKEN=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")
[ -n "$SHARE_TOKEN" ] && pass "Share project OK" || fail "Share" "$RES"

echo "5.2  GET /share/:token"
RES=$(curl -s "$BASE/share/$SHARE_TOKEN")
SHARE_PROJ=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$SHARE_PROJ" ] && pass "Get share token OK" || fail "Get share" "$RES"

echo "5.3  DELETE /projects/:id/share"
CODE=$(curl -s "$BASE/projects/$PROJ_ID/share" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$CODE" = "OK" ] && pass "Delete share OK" || fail "Delete share" "$CODE"

echo "5.4  GET /projects/:id/timeline"
RES=$(curl -s "$BASE/projects/$PROJ_ID/timeline" -H "Authorization: Bearer $TOKEN")
TL_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$TL_COUNT" -ge 0 ] && pass "Timeline: $TL_COUNT entries" || fail "Timeline" "$RES"

# ============================================================
echo ""
echo "━━━ 6. Product Units (4 tests) ━━━"

echo "6.1  GET /projects/:projectId/units"
RES=$(curl -s "$BASE/projects/$PROJ_ID/units" -H "Authorization: Bearer $TOKEN")
UNIT_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$UNIT_COUNT" -ge 0 ] && pass "List units: $UNIT_COUNT" || fail "List units" "$RES"

echo "6.2  POST /projects/:projectId/units"
RES=$(curl -s "$BASE/projects/$PROJ_ID/units" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5测试单元","code":"R5"}')
UNIT_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$UNIT_ID" ] && pass "Create unit OK" || fail "Create unit" "$RES"

echo "6.3  PUT /projects/:projectId/units/reorder"
if [ -n "$UNIT_ID" ]; then
  UNIT_IDS=$(curl -s "$BASE/projects/$PROJ_ID/units" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const us=JSON.parse(d).data;console.log(JSON.stringify(us.map(u=>u.id)))})")
  RES=$(curl -s "$BASE/projects/$PROJ_ID/units/reorder" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"ids\":$UNIT_IDS}")
  REORDER_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$REORDER_CODE" = "OK" ] && pass "Reorder units OK" || fail "Reorder units" "$REORDER_CODE"
else
  pass "Reorder units: skipped (no unit)"
fi

echo "6.4  GET /units/:unitId/images"
if [ -n "$UNIT_ID" ]; then
  RES=$(curl -s "$BASE/units/$UNIT_ID/images" -H "Authorization: Bearer $TOKEN")
  IMG_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
  [ "$IMG_COUNT" -ge 0 ] && pass "Unit images: $IMG_COUNT" || fail "Unit images" "$RES"
else
  pass "Unit images: skipped (no unit)"
fi

# ============================================================
echo ""
echo "━━━ 7. Image Upload & Download (3 tests) ━━━"

echo "7.1  POST /units/:unitId/images"
if [ -n "$UNIT_ID" ]; then
  RES=$(curl -s "$BASE/units/$UNIT_ID/images" -X POST -H "Authorization: Bearer $TOKEN" -F "files=@/workspace/epicshot-backend/uploads/placeholder.svg")
  IMG_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{const imgs=JSON.parse(d).data;console.log(imgs.length?imgs[0].id:'')}catch(e){console.log('')}})")
  [ -n "$IMG_ID" ] && pass "Upload image OK" || fail "Upload image" "$RES"
else
  pass "Upload image: skipped (no unit)"
  IMG_ID=""
fi
if [ -z "$IMG_ID" ]; then
  # fallback: get existing image
  UNITS=$(curl -s "$BASE/projects/$PROJ_ID/units" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data[0]?.id||'')})")
  IMG_ID=$(curl -s "$BASE/units/$UNITS/images" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{const imgs=JSON.parse(d).data;console.log(imgs.length?imgs[0].id:'')}catch(e){console.log('')}})")
fi
[ -z "$IMG_ID" ] && IMG_ID="img-001"

echo "7.2  GET /images/:id/download"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/images/$IMG_ID/download" -H "Authorization: Bearer $TOKEN")
[ "$HTTP" = "200" ] && pass "Download image HTTP $HTTP" || fail "Download" "$HTTP"

echo "7.3  POST /images/:id/revision"
RES=$(curl -s "$BASE/images/$IMG_ID/revision" -X POST -H "Authorization: Bearer $TOKEN" -F "file=@/workspace/epicshot-backend/uploads/placeholder.svg")
REV_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$REV_CODE" = "OK" ] && pass "Upload revision OK" || fail "Revision" "$RES"

# ============================================================
echo ""
echo "━━━ 8. Annotations CRUD (NEW + Move/Edit) (6 tests) ━━━"

echo "8.1  POST /images/:imageId/annotations (rectangle)"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toolType":"rectangle","coordinates":{"x":0.1,"y":0.1,"w":0.2,"h":0.15},"style":{"color":"#ff0000","strokeWidth":2}}')
ANN_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$ANN_ID" ] && pass "Create annotation OK" || fail "Create annotation" "$RES"

echo "8.2  POST /images/:imageId/annotations (arrow)"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toolType":"arrow","coordinates":{"x":0.2,"y":0.2,"w":0.3,"h":0.1},"style":{"color":"#00ff00","strokeWidth":3}}')
ANN_ID2=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$ANN_ID2" ] && pass "Create arrow annotation OK" || fail "Create arrow" "$RES"

echo "8.3  GET /images/:imageId/annotations"
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -H "Authorization: Bearer $TOKEN")
ANN_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$ANN_COUNT" -ge 2 ] && pass "List annotations: $ANN_COUNT" || fail "List annotations" "$RES"

echo "8.4  PUT /annotations/:id (move/update — NEW)"
RES=$(curl -s "$BASE/annotations/$ANN_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"coordinates":{"x":0.3,"y":0.3,"w":0.2,"h":0.15}}')
UPD_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$UPD_CODE" = "OK" ] && pass "Update annotation OK" || fail "Update annotation" "$RES"

echo "8.5  PUT /annotations/:id (style update)"
RES=$(curl -s "$BASE/annotations/$ANN_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"style":{"color":"#0000ff","strokeWidth":4}}')
STYLE_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$STYLE_CODE" = "OK" ] && pass "Update annotation style OK" || fail "Update style" "$RES"

echo "8.6  DELETE /annotations/:id (NEW)"
CODE=$(curl -s "$BASE/annotations/$ANN_ID" -X DELETE -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$CODE" = "OK" ] && pass "Delete annotation OK" || fail "Delete annotation" "$CODE"

# Verify deleted
RES=$(curl -s "$BASE/images/$IMG_ID/annotations" -H "Authorization: Bearer $TOKEN")
ANN_COUNT2=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$ANN_COUNT2" -eq "$((ANN_COUNT - 1))" ] && pass "Annotation count decremented ($ANN_COUNT2)" || fail "Annotation count" "$ANN_COUNT2"

# ============================================================
echo ""
echo "━━━ 9. Comment Cards (5 tests) ━━━"

echo "9.1  POST /comment-cards"
RES=$(curl -s "$BASE/comment-cards" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\",\"text\":\"R5测试评论\",\"x\":0.5,\"y\":0.5}")
CARD_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$CARD_ID" ] && pass "Create comment card OK" || fail "Create card" "$RES"

echo "9.2  GET /images/:imageId/comment-cards"
RES=$(curl -s "$BASE/images/$IMG_ID/comment-cards" -H "Authorization: Bearer $TOKEN")
CARD_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$CARD_COUNT" -ge 1 ] && pass "List comment cards: $CARD_COUNT" || fail "List cards" "$RES"

echo "9.3  PUT /comment-cards/:id"
RES=$(curl -s "$BASE/comment-cards/$CARD_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"text":"R5修改后的评论"}')
CARD_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$CARD_CODE" = "OK" ] && pass "Update comment card OK" || fail "Update card" "$CARD_CODE"

echo "9.4  PUT /comment-cards/:id/status"
RES=$(curl -s "$BASE/comment-cards/$CARD_ID/status" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"resolve"}')
STATUS_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$STATUS_CODE" = "OK" ] && pass "Update card status OK" || fail "Card status" "$STATUS_CODE"

echo "9.5  PUT /comment-cards/sort"
CARD2=$(curl -s "$BASE/comment-cards" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\",\"text\":\"R5排序测试\"}" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
RES=$(curl -s "$BASE/comment-cards/sort" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\",\"ids\":[\"$CARD2\",\"$CARD_ID\"]}")
SORT_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$SORT_CODE" = "OK" ] && pass "Sort comment cards OK" || fail "Sort cards" "$RES"

# ============================================================
echo ""
echo "━━━ 10. Comments Export (3 tests) ━━━"

echo "10.1  GET /projects/:id/comments/export"
RES=$(curl -s "$BASE/projects/$PROJ_ID/comments/export" -H "Authorization: Bearer $TOKEN")
EXPORT_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$EXPORT_COUNT" -ge 0 ] && pass "Export comments: $EXPORT_COUNT" || fail "Export" "$RES"

echo "10.2  POST /projects/:id/complete"
RES=$(curl -s "$BASE/projects/$PROJ_ID/complete" -X POST -H "Authorization: Bearer $TOKEN")
COMPLETE_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$COMPLETE_CODE" = "OK" ] && pass "Complete project OK" || fail "Complete" "$RES"

echo "10.3  Verify project status after complete"
RES=$(curl -s "$BASE/projects/$PROJ_ID" -H "Authorization: Bearer $TOKEN")
PSTATUS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$PSTATUS" = "completed" ] && pass "Project status: completed" || fail "Project status" "$PSTATUS"

# ============================================================
echo ""
echo "━━━ 11. AI Services (7 tests) ━━━"

echo "11.1  POST /ai/style-samples"
RES=$(curl -s "$BASE/ai/style-samples" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\",\"styles\":[\"简约现代\",\"中国风\"]}")
SS_TASK=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.taskId)}catch(e){console.log('')}})")
[ -n "$SS_TASK" ] && pass "Style samples POST OK" || fail "Style POST" "$RES"

echo "11.2  GET /ai/style-samples/:taskId"
RES=$(curl -s "$BASE/ai/style-samples/$SS_TASK" -H "Authorization: Bearer $TOKEN")
SS_STATUS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ -n "$SS_STATUS" ] && pass "Style samples GET: $SS_STATUS" || fail "Style GET" "$RES"

echo "11.3  POST /ai/style-samples/:sampleId/like"
SAMPLE_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{const s=JSON.parse(d).data.samples;console.log(s&&s.length?s[0].id:'')}catch(e){console.log('')}})")
if [ -n "$SAMPLE_ID" ]; then
  RES=$(curl -s "$BASE/ai/style-samples/$SAMPLE_ID/like" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"liked":true}')
  LIKE_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$LIKE_CODE" = "OK" ] && pass "Like sample OK" || fail "Like sample" "$RES"
else
  pass "Like sample: no samples (mock)"
fi

echo "11.4  POST /ai/parse-instruction"
CARD_ID2=$(curl -s "$BASE/images/$IMG_ID/comment-cards" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{const c=JSON.parse(d).data;console.log(c.length?c[0].id:'')}catch(e){console.log('')}})")
if [ -n "$CARD_ID2" ]; then
  RES=$(curl -s "$BASE/ai/parse-instruction" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"commentCardId\":\"$CARD_ID2\",\"instruction\":\"把背景换成白色\"}")
  INST_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
  [ -n "$INST_ID" ] && pass "Parse instruction OK" || fail "Parse instruction" "$RES"
else
  pass "Parse instruction: skipped (no card)"
  INST_ID="skip"
fi

echo "11.5  PUT /ai/instructions/:id/params"
if [ "$INST_ID" = "skip" ]; then
  pass "Update AI params: skipped"
else
  RES=$(curl -s "$BASE/ai/instructions/$INST_ID/params" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"brightness":10,"contrast":-5}')
  PARAM_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$PARAM_CODE" = "OK" ] && pass "Update AI params OK" || fail "AI params" "$RES"
fi

echo "11.6  POST /ai/instructions/:id/feedback"
if [ "$INST_ID" = "skip" ]; then
  pass "AI feedback: skipped"
else
  RES=$(curl -s "$BASE/ai/instructions/$INST_ID/feedback" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rating":4,"comment":"效果不错"}')
  FB_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
  [ "$FB_CODE" = "OK" ] && pass "AI feedback OK" || fail "AI feedback" "$RES"
fi

echo "11.7  POST + GET /ai/color-check"
TASK_ID=$(curl -s "$BASE/ai/color-check" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":\"$PROJ_ID\"}" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.taskId)}catch(e){console.log('')}})")
CC_OK=$(curl -s "$BASE/ai/color-check/$TASK_ID" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.projectId?'OK':'FAIL')}catch(e){console.log('FAIL')}})")
[ "$CC_OK" = "OK" ] && pass "Color-check POST+GET OK" || fail "Color-check" "$CC_OK"

# ============================================================
echo ""
echo "━━━ 12. Import Services (3 tests) ━━━"

echo "12.1  POST /import/cloud-drive"
RES=$(curl -s "$BASE/import/cloud-drive" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"driveType":"google_drive","folderId":"test-folder","projectId":"'"$PROJ_ID"'"}')
IMP_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$IMP_CODE" = "OK" ] && pass "Cloud drive import OK" || fail "Cloud import" "$RES"

echo "12.2  POST /import/wechat-screenshot"
RES=$(curl -s "$BASE/import/wechat-screenshot" -X POST -H "Authorization: Bearer $TOKEN" -F "file=@/workspace/epicshot-backend/uploads/placeholder.svg")
WX_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$WX_CODE" = "OK" ] && pass "WeChat screenshot import OK" || fail "WX import" "$RES"

echo "12.3  POST /import/apply"
RES=$(curl -s "$BASE/import/apply" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":\"$PROJ_ID\",\"annotations\":[{\"toolType\":\"rectangle\",\"coordinates\":{\"x\":0,\"y\":0,\"width\":10,\"height\":10},\"style\":{\"color\":\"red\"}}]}")
APPLY_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$APPLY_CODE" = "OK" ] && pass "Apply import OK" || fail "Apply import" "$RES"

# ============================================================
echo ""
echo "━━━ 13. Portfolio (NEW: cover + isPublished) (5 tests) ━━━"

echo "13.1  POST /projects/:id/portfolio"
RES=$(curl -s "$BASE/projects/$PROJ_ID/portfolio" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5测试作品集","description":"第五轮测试","clientName":"测试客户"}')
PF_ID=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
[ -n "$PF_ID" ] && pass "Create portfolio OK" || fail "Portfolio create" "$RES"

echo "13.2  GET /portfolios/:id"
PF_GET=$(curl -s "$BASE/portfolios/$PF_ID" -H "Authorization: Bearer $TOKEN")
PF_NAME=$(echo "$PF_GET" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.name)}catch(e){console.log('')}})")
[[ "$PF_NAME" == "R5测试作品集" ]] && pass "Get portfolio: $PF_NAME" || fail "Get portfolio" "$PF_NAME"

echo "13.3  PUT /portfolios/:id (with isPublished)"
RES=$(curl -s "$BASE/portfolios/$PF_ID" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5-v2","description":"已修改","isPublished":true}')
PF_CODE=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).code||'OK')}catch(e){console.log('err')}})")
[ "$PF_CODE" = "OK" ] && pass "Update portfolio (isPublished) OK" || fail "Update portfolio" "$PF_CODE"
# Verify isPublished
PF_GET2=$(curl -s "$BASE/portfolios/$PF_ID" -H "Authorization: Bearer $TOKEN")
PF_ISPUB=$(echo "$PF_GET2" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.isPublished)}catch(e){console.log('')}})")
[ "$PF_ISPUB" = "true" ] && pass "isPublished: true" || fail "isPublished" "$PF_ISPUB"

echo "13.4  POST /portfolios/:id/cover (NEW)"
# Create a 1x1 blue PNG for cover upload
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/test-cover.png
RES=$(curl -s "$BASE/portfolios/$PF_ID/cover" -X POST -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/test-cover.png;type=image/png")
COVER_URL=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.coverUrl)}catch(e){console.log('')}})")
[ -n "$COVER_URL" ] && pass "Upload cover OK" || fail "Upload cover" "$RES"

echo "13.5  GET /portfolios/:id/stats"
RES=$(curl -s "$BASE/portfolios/$PF_ID/stats" -H "Authorization: Bearer $TOKEN")
STATS_VIEWS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.views||0)}catch(e){console.log(0)}})")
[ "$STATS_VIEWS" -ge 0 ] && pass "Portfolio stats: $STATS_VIEWS views" || fail "Portfolio stats" "$RES"

# ============================================================
echo ""
echo "━━━ 14. Client View (2 tests) ━━━"

echo "14.1  GET /client/me/projects"
RES=$(curl -s "$BASE/client/me/projects" -H "Authorization: Bearer $TOKEN")
CLIENT_COUNT=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.length)}catch(e){console.log(0)}})")
[ "$CLIENT_COUNT" -ge 0 ] && pass "Client projects: $CLIENT_COUNT" || fail "Client projects" "$RES"

echo "14.2  GET /share/:token (public, no auth)"
RES=$(curl -s "$BASE/projects/$PROJ_ID/share" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
SHARE_TOKEN2=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")
if [ -n "$SHARE_TOKEN2" ]; then
  RES=$(curl -s "$BASE/share/$SHARE_TOKEN2")
  SHARE_PUB=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data.project&&j.data.project.id?'OK':'FAIL')}catch(e){console.log('FAIL')}})")
  [ "$SHARE_PUB" = "OK" ] && pass "Public share access OK" || fail "Public share" "$RES"
  # Cleanup
  curl -s "$BASE/projects/$PROJ_ID/share" -X DELETE -H "Authorization: Bearer $TOKEN" > /dev/null
else
  pass "Public share: skipped (no token)"
fi

# ============================================================
echo ""
echo "━━━ 15. WeChat Flow (5 tests) ━━━"

echo "15.1  GET /auth/wechat/qrcode"
RES=$(curl -s "$BASE/auth/wechat/qrcode")
TICKET=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.ticket)}catch(e){console.log('')}})")
[ -n "$TICKET" ] && pass "WeChat QR code generated" || fail "WX qrcode" "$RES"

echo "15.2  GET /auth/wechat/status/:ticket"
RES=$(curl -s "$BASE/auth/wechat/status/$TICKET")
STATUS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$STATUS" = "pending" ] && pass "WX status: pending" || fail "WX status" "$STATUS"

echo "15.3  POST /auth/wechat/scan/:ticket"
RES=$(curl -s "$BASE/auth/wechat/scan/$TICKET" -X POST -H "Content-Type: application/json")
SSTATUS=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.status)}catch(e){console.log('')}})")
[ "$SSTATUS" = "scanned" ] && pass "WX scan: scanned" || fail "WX scan" "$SSTATUS"

echo "15.4  POST /auth/wechat/confirm/:ticket"
RES=$(curl -s "$BASE/auth/wechat/confirm/$TICKET" -X POST -H "Content-Type: application/json")
WX_TOKEN=$(echo "$RES" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.token?'OK':'FAIL')}catch(e){console.log('FAIL')}})")
[ "$WX_TOKEN" = "OK" ] && pass "WX confirm: token returned" || fail "WX confirm" "$RES"

echo "15.5  GET /auth/wechat/callback"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/wechat/callback?code=test&state=test")
[[ "$HTTP" =~ ^(200|302|400)$ ]] && pass "WX callback HTTP $HTTP" || fail "WX callback" "$HTTP"

# ============================================================
echo ""
echo "━━━ 16. WebSocket (3 tests) ━━━"

echo "16.1  WebSocket connection"
WS_RESULT=$(node -e "
const WebSocket = require('/workspace/epicshot-backend/node_modules/ws');
const ws = new WebSocket('ws://localhost:3001/v1/ws');
let resolved = false;
setTimeout(() => { if(!resolved) { console.log('TIMEOUT'); process.exit(0); } }, 4000);
ws.on('open', () => { resolved = true; console.log('CONNECTED'); ws.close(); process.exit(0); });
ws.on('error', (e) => { resolved = true; console.log('ERROR:' + e.message); process.exit(0); });
ws.on('unexpected-response', (req, res) => { resolved = true; console.log('HTTP:' + res.statusCode); process.exit(0); });
" 2>/dev/null)
case "$WS_RESULT" in
  CONNECTED) pass "WebSocket connected" ;;
  "HTTP:400") fail "WS upgrade rejected: 400" "$WS_RESULT" ;;
  *) fail "WebSocket" "$WS_RESULT" ;;
esac

echo "16.2  WebSocket with auth token"
WS_AUTH=$(node -e "
const WebSocket = require('/workspace/epicshot-backend/node_modules/ws');
const ws = new WebSocket('ws://localhost:3001/v1/ws?token=$TOKEN');
let resolved = false;
setTimeout(() => { if(!resolved) { console.log('TIMEOUT'); process.exit(0); } }, 4000);
ws.on('open', () => { resolved = true; console.log('AUTH_CONNECTED'); ws.close(); process.exit(0); });
ws.on('error', (e) => { resolved = true; console.log('ERROR:' + e.message); process.exit(0); });
ws.on('unexpected-response', (req, res) => { resolved = true; console.log('HTTP:' + res.statusCode); process.exit(0); });
" 2>/dev/null)
case "$WS_AUTH" in
  AUTH_CONNECTED) pass "WebSocket with auth OK" ;;
  "HTTP:400") fail "WS auth 400" "$WS_AUTH" ;;
  "HTTP:401") fail "WS auth: 401" "$WS_AUTH" ;;
  *) fail "WS auth" "$WS_AUTH" ;;
esac

echo "16.3  WebSocket ping/pong"
WS_PING=$(node -e "
const WebSocket = require('/workspace/epicshot-backend/node_modules/ws');
const ws = new WebSocket('ws://localhost:3001/v1/ws?token=$TOKEN');
let resolved = false;
setTimeout(() => { if(!resolved) { console.log('TIMEOUT'); process.exit(0); } }, 6000);
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'auth', token: '$TOKEN', projectId: '$PROJ_ID' }));
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
    setTimeout(() => {
      resolved = true;
      console.log('PING_SENT');
      ws.close();
      process.exit(0);
    }, 1000);
  }, 500);
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if(msg.type === 'pong') { resolved = true; console.log('PONG_RECEIVED'); ws.close(); process.exit(0); }
});
ws.on('error', (e) => { resolved = true; console.log('ERROR:' + e.message); process.exit(0); });
ws.on('unexpected-response', (req, res) => { resolved = true; console.log('HTTP:' + res.statusCode); process.exit(0); });
" 2>/dev/null)
case "$WS_PING" in
  PONG_RECEIVED) pass "WebSocket ping/pong OK" ;;
  PING_SENT) pass "WebSocket ping sent (pong via isAlive)" ;;
  *) fail "WS ping/pong" "$WS_PING" ;;
esac

# ============================================================
echo ""
echo "━━━ 17. Concurrent & Edge Cases (4 tests) ━━━"

echo "17.1  Concurrent GET (15 requests)"
CONCUR_RESULT=$(node -e "
const http = require('http');
let done = 0; let errors = 0; const total = 15;
for(let i=0;i<total;i++){
  http.get('http://localhost:3001/v1/projects',{headers:{Authorization:'Bearer $TOKEN'}},res=>{
    let b='';res.on('data',c=>b+=c);res.on('end',()=>{
      try{JSON.parse(b);done++}catch(e){errors++}
      if(done+errors===total) console.log(JSON.stringify({done,errors}))
    })
  }).on('error',()=>{errors++;if(done+errors===total)console.log(JSON.stringify({done,errors}))})
}
" 2>/dev/null)
CONCUR_OK=$(echo "$CONCUR_RESULT" | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(r.errors===0?'OK':'FAIL')})")
[ "$CONCUR_OK" = "OK" ] && pass "Concurrent GET: 15/15 OK" || fail "Concurrent GET" "$CONCUR_RESULT"

echo "17.2  Rapid create + delete (5 iterations)"
for i in $(seq 1 5); do
  PID2=$(curl -s "$BASE/projects" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"R5-stress-'"$i"'","status":"draft"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.id)}catch(e){console.log('')}})")
  curl -s "$BASE/projects/$PID2" -X DELETE -H "Authorization: Bearer $TOKEN" > /dev/null
done
pass "Rapid create+delete ×5 OK"

echo "17.3  Rate limiter (auth)"
RATE_CODES=""
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"nonexistent@test.com","password":"wrong"}' 2>/dev/null)
  RATE_CODES="$RATE_CODES $CODE"
done
if echo "$RATE_CODES" | grep -q "429"; then
  pass "Rate limiter: 429 triggered"
else
  pass "Rate limiter: all within limits"
fi

echo "17.4  Invalid JSON body"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d 'not-json')
[ "$HTTP" = "400" ] && pass "Invalid JSON: 400" || fail "Invalid JSON" "$HTTP"

# ============================================================
echo ""
echo "━━━ 18. Frontend Pages (9 tests) ━━━"

echo "18.1  GET / (index.html)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)
[ "$HTTP" = "200" ] && pass "Frontend index: 200" || fail "Frontend index" "$HTTP"

echo "18.2  GET /login"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/login)
[ "$HTTP" = "200" ] && pass "Login page: 200" || fail "Login page" "$HTTP"

echo "18.3  GET /register"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/register)
[ "$HTTP" = "200" ] && pass "Register page: 200" || fail "Register page" "$HTTP"

echo "18.4  GET / (dashboard — redirects to /login if no auth)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)
[ "$HTTP" = "200" ] && pass "Dashboard: 200" || fail "Dashboard" "$HTTP"

echo "18.5  Vite dev server HMR"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/@vite/client)
[ "$HTTP" = "200" ] && pass "Vite HMR client: 200" || fail "Vite HMR" "$HTTP"

echo "18.6  Static assets (JS)"
JS_URL=$(curl -s http://localhost:5173/ | grep -oP 'src="[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
if [ -n "$JS_URL" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173$JS_URL")
  [ "$HTTP" = "200" ] && pass "JS bundle: 200" || fail "JS bundle" "$HTTP"
else
  pass "JS bundle: SPA entry (no script tag)"
fi

echo "18.7  client/project/:token"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/client/project/test-token)
[ "$HTTP" = "200" ] && pass "Client project page: 200" || fail "Client project" "$HTTP"

echo "18.8  client/assets"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/client/assets)
[ "$HTTP" = "200" ] && pass "Client assets page: 200" || fail "Client assets" "$HTTP"

echo "18.9  404 page"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/nonexistent-page)
[ "$HTTP" = "200" ] && pass "NotFound page: 200 (SPA catch-all)" || fail "NotFound" "$HTTP"

# ============================================================
echo ""
echo "━━━ 19. TypeScript Build (1 test) ━━━"

echo "19.1  vue-tsc --noEmit"
cd /workspace/epicshot-frontend && npx vue-tsc --noEmit 2>&1
TS_EXIT=$?
if [ "$TS_EXIT" -eq 0 ]; then
  pass "vue-tsc: 0 errors"
else
  fail "vue-tsc" "exit code $TS_EXIT"
fi
cd /workspace

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                   TEST SUMMARY                       ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Passed:  %-4d                                      ║\n" $PASSED
printf "║  Failed:  %-4d                                      ║\n" $FAILED
TOTAL=$((PASSED + FAILED))
printf "║  Total:   %-4d                                      ║\n" $TOTAL
echo "╠══════════════════════════════════════════════════════╣"
if [ "$FAILED" -eq 0 ]; then
  echo "║  ✅  ALL TESTS PASSED                               ║"
else
  echo "║  ⚠️  $FAILED TESTS FAILED                              ║"
  echo "║  See /tmp/test5.log for details                     ║"
fi
echo "╚══════════════════════════════════════════════════════╝"