#!/bin/bash
BASE="http://127.0.0.1:3001/v1"
PASS=0; FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

assert() {
  local label="$1"; local expected_code="$2"; local actual="$3"; local body="$4"
  if [ "$actual" = "$expected_code" ]; then
    echo -e "${GREEN}[PASS]${NC} $label (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo -e "${RED}[FAIL]${NC} $label (expected $expected_code, got $actual) body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

assert_json() {
  local label="$1"; local expected_code="$2"; local actual="$3"; local body="$4"
  if [ "$actual" = "$expected_code" ]; then
    # Check valid JSON
    if echo "$body" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
      echo -e "${GREEN}[PASS]${NC} $label (valid JSON)"
      PASS=$((PASS+1))
    else
      echo -e "${RED}[FAIL]${NC} $label (invalid JSON response) body: $(echo "$body" | head -c 200)"
      FAIL=$((FAIL+1))
    fi
  else
    echo -e "${RED}[FAIL]${NC} $label (expected $expected_code, got $actual) body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo "========== 1. Health Check =========="
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/../health)
assert "Health Check" 200 "$R" ""

echo ""
echo "========== 2. Auth - Login =========="

# 2a. Valid login
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"admin123"}')
CODE=$(echo "$BODY" | tail -1)
DATA=$(echo "$BODY" | head -1)
assert_json "Login - valid credentials" 200 "$CODE" "$DATA"
TOKEN=$(echo "$DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "Token obtained: ${TOKEN:0:20}..."

# 2b. Invalid password
BODY=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"wrong"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"wrong"}')
assert "Login - invalid password" 401 "$CODE" ""

# 2c. Missing fields
BODY=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{}')
assert "Login - missing fields" 400 "$CODE" ""

# 2d. Invalid email format
BODY=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"notanemail","password":"admin123"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"notanemail","password":"admin123"}')
assert "Login - invalid email" 400 "$CODE" ""

echo ""
echo "========== 3. Auth - Register =========="

# 3a. Valid registration
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"testqa_$(date +%s)@test.com\",\"password\":\"test123456\",\"name\":\"测试用户\"}")
CODE=$(echo "$BODY" | tail -1)
assert_json "Register - valid" 201 "$CODE" "$(echo "$BODY" | head -1)"
REG_TOKEN=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 3b. Duplicate email
BODY=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"admin123","name":"重复"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"zhang@epicshot.com","password":"admin123","name":"重复"}')
assert "Register - duplicate email" 409 "$CODE" ""

# 3c. Short password
BODY=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"new@test.com","password":"123","name":"短密码"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"new@test.com","password":"123","name":"短密码"}')
assert "Register - short password" 400 "$CODE" ""

echo ""
echo "========== 4. User/Workspace =========="

# 4a. Get current user
BODY=$(curl -s -w "\n%{http_code}" $BASE/users/me -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "/users/me" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 4b. Get workspace
BODY=$(curl -s -w "\n%{http_code}" $BASE/workspaces/mine -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "/workspaces/mine" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 4c. Get members
BODY=$(curl -s -w "\n%{http_code}" $BASE/workspaces/members -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "/workspaces/members" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 4d. Update workspace (owner only)
BODY=$(curl -s -X PUT $BASE/workspaces/mine -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"更新后的工作室"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/workspaces/mine -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"更新后的工作室"}')
assert "Update workspace" 200 "$CODE" ""

# 4e. Non-owner cannot update (test with editor token)
EDITOR_TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"li@epicshot.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/workspaces/mine -H "Authorization: Bearer $EDITOR_TOKEN" -H 'Content-Type: application/json' -d '{"name":"bad"}')
assert "Editor cannot update workspace" 403 "$CODE" ""

echo ""
echo "========== 5. Projects =========="

# 5a. List projects
BODY=$(curl -s -w "\n%{http_code}" $BASE/projects -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "List projects" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 5b. List with status filter
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects?status=in_progress" -H "Authorization: Bearer $TOKEN")
assert "List projects - status filter" 200 "$CODE" ""

# 5c. List with search
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects?search=小米" -H "Authorization: Bearer $TOKEN")
assert "List projects - search" 200 "$CODE" ""

# 5d. Get project detail
BODY=$(curl -s -w "\n%{http_code}" $BASE/projects/proj-001 -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get project detail" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 5e. Get nonexistent project
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/projects/nonexistent -H "Authorization: Bearer $TOKEN")
assert "Get nonexistent project" 404 "$CODE" ""

# 5f. Create project
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/projects -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"测试项目","clientName":"测试客户"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Create project" 201 "$CODE" "$(echo "$BODY" | head -1)"
NEW_PROJ=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 5g. Create project - empty name
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/projects -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":""}')
assert "Create project - empty name" 400 "$CODE" ""

# 5h. Update project status
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/projects/$NEW_PROJ -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"in_progress"}')
assert "Update project status" 200 "$CODE" ""

# 5i. Generate share
BODY=$(curl -s -X POST $BASE/projects/proj-001/share -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"expiry":"7days"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/projects/proj-001/share -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"expiry":"7days"}')
assert "Generate share link" 200 "$CODE" ""

# 5j. Complete project
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/projects/$NEW_PROJ/complete -H "Authorization: Bearer $TOKEN")
assert "Complete project" 200 "$CODE" ""

# 5k. Delete project
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/projects/$NEW_PROJ -H "Authorization: Bearer $TOKEN")
assert "Delete project" 200 "$CODE" ""

echo ""
echo "========== 6. Product Units =========="

# 6a. Get units
BODY=$(curl -s -w "\n%{http_code}" $BASE/projects/proj-001/units -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get product units" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 6b. Create unit
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/projects/proj-001/units -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"新单元"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Create product unit" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 6c. Create unit - empty name
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/projects/proj-001/units -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":""}')
assert "Create unit - empty name" 400 "$CODE" ""

echo ""
echo "========== 7. Images =========="

# 7a. Get images
BODY=$(curl -s -w "\n%{http_code}" $BASE/units/unit-001/images -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get images" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 7b. Upload image
echo "test" > /tmp/test_upload.jpg
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/units/unit-001/images -H "Authorization: Bearer $TOKEN" -F "files=@/tmp/test_upload.jpg;type=image/jpeg")
CODE=$(echo "$BODY" | tail -1)
assert_json "Upload image" 201 "$CODE" "$(echo "$BODY" | head -1)"
rm -f /tmp/test_upload.jpg

# 7c. Upload without file
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/units/unit-001/images -H "Authorization: Bearer $TOKEN" -H 'Content-Type: multipart/form-data')
assert "Upload - no file" 400 "$CODE" ""

echo ""
echo "========== 8. Annotations =========="

# 8a. Get annotations
BODY=$(curl -s -w "\n%{http_code}" $BASE/images/img-001/annotations -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get annotations" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 8b. Create annotation
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/images/img-001/annotations -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"toolType":"rectangle","coordinates":{"x":0.1,"y":0.1,"w":0.3,"h":0.2},"style":{"color":"#FF0000","width":3}}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Create annotation" 201 "$CODE" "$(echo "$BODY" | head -1)"
NEW_ANN=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 8c. Update annotation
BODY=$(curl -s -w "\n%{http_code}" -X PUT $BASE/annotations/$NEW_ANN -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"coordinates":{"x":0.2,"y":0.2,"w":0.4,"h":0.3}}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Update annotation" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 8d. Delete annotation
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/annotations/$NEW_ANN -H "Authorization: Bearer $TOKEN")
assert "Delete annotation" 200 "$CODE" ""

# 8e. Invalid tool type
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/images/img-001/annotations -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"toolType":"invalid","coordinates":{}}')
assert "Create annotation - invalid tool" 400 "$CODE" ""

echo ""
echo "========== 9. Comment Cards =========="

# 9a. Get comment cards
BODY=$(curl -s -w "\n%{http_code}" $BASE/images/img-001/comment-cards -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get comment cards" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 9b. Create comment card
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/comment-cards -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"imageId":"img-001","text":"测试意见"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Create comment card" 201 "$CODE" "$(echo "$BODY" | head -1)"
NEW_CARD=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 9c. Resolve comment card
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/comment-cards/$NEW_CARD/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"resolve"}')
assert "Resolve comment card" 200 "$CODE" ""

# 9d. Unresolve comment card
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/comment-cards/$NEW_CARD/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"action":"unresolve"}')
assert "Unresolve comment card" 200 "$CODE" ""

echo ""
echo "========== 10. AI Endpoints =========="

# 10a. Style samples
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/ai/style-samples -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"imageId":"img-001","style":"default"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "AI style samples" 200 "$CODE" "$(echo "$BODY" | head -1)"
AI_TASK=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['taskId'])")

# 10b. Get style sample result
BODY=$(curl -s -w "\n%{http_code}" $BASE/ai/style-samples/$AI_TASK -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get style sample result" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 10c. Parse instruction
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/ai/parse-instruction -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"commentCardId":"card-001"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Parse instruction" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 10d. Color check
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/ai/color-check -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"proj-001"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Color check" 200 "$CODE" "$(echo "$BODY" | head -1)"
COLOR_TASK=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['taskId'])")

# 10e. Get color check result
BODY=$(curl -s -w "\n%{http_code}" $BASE/ai/color-check/$COLOR_TASK -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get color check result" 200 "$CODE" "$(echo "$BODY" | head -1)"

echo ""
echo "========== 11. Import =========="

# 11a. Cloud drive browse
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/import/cloud-drive -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"provider":"local","path":"/"}')
CODE=$(echo "$BODY" | tail -1)
assert_json "Cloud drive browse" 200 "$CODE" "$(echo "$BODY" | head -1)"

echo ""
echo "========== 12. Portfolio =========="

# 12a. Create portfolio
BODY=$(curl -s -w "\n%{http_code}" -X POST $BASE/projects/proj-001/portfolio -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Create portfolio" 200 "$CODE" "$(echo "$BODY" | head -1)"
PORTFOLIO_ID=$(echo "$BODY" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 12b. Get portfolio
BODY=$(curl -s -w "\n%{http_code}" $BASE/portfolios/$PORTFOLIO_ID -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Get portfolio" 200 "$CODE" "$(echo "$BODY" | head -1)"

# 12c. Portfolio stats
BODY=$(curl -s -w "\n%{http_code}" $BASE/portfolios/$PORTFOLIO_ID/stats -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$BODY" | tail -1)
assert_json "Portfolio stats" 200 "$CODE" "$(echo "$BODY" | head -1)"

echo ""
echo "========== 13. Auth Guard Tests =========="

# 13a. Access protected route without token
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/projects)
assert "Unauthorized - no token" 401 "$CODE" ""

# 13b. Access with invalid token
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/projects -H "Authorization: Bearer invalidtoken")
assert "Unauthorized - invalid token" 401 "$CODE" ""

# 13c. Access with editor token (should work)
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/projects -H "Authorization: Bearer $EDITOR_TOKEN")
assert "Editor access projects" 200 "$CODE" ""

echo ""
echo "========== 14. Rate Limiting =========="

# 14a. Rate limit on auth (send 35 requests, should hit limit at 31st)
LIMIT_HIT=0
for i in $(seq 1 35); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"nonexist@test.com","password":"wrong"}')
  if [ "$CODE" = "429" ]; then LIMIT_HIT=1; echo "Rate limit hit at request #$i"; break; fi
done
if [ "$LIMIT_HIT" = "1" ]; then
  echo -e "${GREEN}[PASS]${NC} Rate limiting works"
  PASS=$((PASS+1))
else
  echo -e "${RED}[FAIL]${NC} Rate limiting not enforced"
  FAIL=$((FAIL+1))
fi

echo ""
echo "========== 15. Image Download =========="

# 15a. Download placeholder
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/images/img-001/download -H "Authorization: Bearer $TOKEN")
assert "Download image" 200 "$CODE" ""

echo ""
echo "========== SUMMARY =========="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
[ "$FAIL" -eq 0 ] && echo -e "${GREEN}ALL TESTS PASSED!${NC}" || echo -e "${RED}SOME TESTS FAILED!${NC}"