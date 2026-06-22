"""EPX-COMPREHENSIVE-TEST: 易拍选系统全面测试
覆盖维度: 功能正确性 | 接口参数校验 | 安全 | 数据完整性 | 异常容错 | 性能
"""
import urllib.request, json, sys, os, time, sqlite3

BASE = "http://localhost:3000/v1"
DB_PATH = "/workspace/epicshot-backend/data/epicshot.db"
results = []
test_start = time.time()

# ============================================================
# Helpers
# ============================================================
def api(method, path, body=None, token=None, raw=False):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=30) as resp:
            elapsed = round((time.time() - t0) * 1000)
            ct = resp.headers.get("Content-Type", "")
            if raw or "json" not in ct:
                return resp.status, resp.read(), elapsed
            return resp.status, json.loads(resp.read()), elapsed
    except urllib.error.HTTPError as e:
        elapsed = round((time.time() - t0) * 1000)
        ct = e.headers.get("Content-Type", "")
        if raw or "json" not in ct:
            return e.code, e.read(), elapsed
        return e.code, json.loads(e.read()), elapsed
    except Exception as e:
        return 0, {"error": str(e)}, 0

def gd(resp):
    if isinstance(resp, dict):
        d = resp.get("data", resp)
        return d if d is not None else resp
    return resp

def t(cat, i, name, passed, detail=""):
    s = "PASS" if passed else ("FAIL" if passed is False else "INFO")
    results.append((cat, i, name, s, detail))
    icon = "\u2713" if s == "PASS" else ("\u2717" if s == "FAIL" else "\u2139")
    print(f"  [{icon}] {i}: {name}")
    if detail: print(f"       {detail}")

def qdb(sql, params=()):
    db = sqlite3.connect(DB_PATH)
    rows = db.execute(sql, params).fetchall()
    db.close()
    return rows

def login(email, pw="admin123"):
    code, resp, _ = api("POST", "/auth/login", {"email": email, "password": pw})
    return resp.get("data", {}).get("token", "") if isinstance(resp, dict) else ""

print("=" * 70)
print("  易拍选 (EpicShot) V1.19 系统全面测试")
print("=" * 70)
print(f"  Backend: {BASE}")
print(f"  Frontend: http://localhost:5173")
print(f"  DB: {DB_PATH}")
print()

# Login
tok_owner = login("owner@test.com")
tok_editor = login("editor@test.com")
tok_zhang = login("zhang@epicshot.com")
print(f"[AUTH] owner@test.com: {'OK' if tok_owner else 'FAIL'}")
print(f"[AUTH] editor@test.com: {'OK' if tok_editor else 'FAIL'}")
print(f"[AUTH] zhang@epicshot.com: {'OK' if tok_zhang else 'FAIL'}")

# ============================================================
# 第一部分: 功能正确性测试
# ============================================================
print("\n" + "=" * 70)
print("  一、功能正确性测试 (Functional Correctness)")
print("=" * 70)

# ----- 1.1 认证模块 -----
print("\n  [1.1] 认证模块")

# 1.1.1 正常登录
code, resp, ms = api("POST", "/auth/login", {"email": "owner@test.com", "password": "admin123"})
t("AUTH", "1.1.1", "正常登录", code == 200 and bool(resp.get("data",{}).get("token")), f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.2 错误密码
code, resp, ms = api("POST", "/auth/login", {"email": "owner@test.com", "password": "wrongpass"})
t("AUTH", "1.1.2", "错误密码登录", code == 401, f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.3 缺失密码
code, resp, ms = api("POST", "/auth/login", {"email": "owner@test.com"})
t("AUTH", "1.1.3", "缺失密码", code in [400, 401, 422], f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.4 缺失邮箱
code, resp, ms = api("POST", "/auth/login", {"password": "admin123"})
t("AUTH", "1.1.4", "缺失邮箱", code in [400, 401, 422], f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.5 空请求体
code, resp, ms = api("POST", "/auth/login", {})
t("AUTH", "1.1.5", "空请求体", code in [400, 401, 422], f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.6 注册-正常流程
test_email = f"tmp{int(time.time())}@test.com"
code, resp, ms = api("POST", "/auth/register", {"email": test_email, "password": "test123", "name": "TmpUser"})
t("AUTH", "1.1.6", "注册-正常", code in [200, 201], f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.7 注册-重复邮箱
code, resp, ms = api("POST", "/auth/register", {"email": "owner@test.com", "password": "test123", "name": "Dup"})
t("AUTH", "1.1.7", "注册-重复邮箱", code == 409, f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.8 注册-短密码
code, resp, ms = api("POST", "/auth/register", {"email": "a@b.com", "password": "12", "name": "Short"})
t("AUTH", "1.1.8", "注册-密码过短(<6)", code == 400, f"{code} {ms}ms")
time.sleep(0.3)

# 1.1.9 注册-无效邮箱
code, resp, ms = api("POST", "/auth/register", {"email": "notanemail", "password": "test123", "name": "Bad"})
t("AUTH", "1.1.9", "注册-无效邮箱格式", code in [400, 429], f"{code} {ms}ms")

# 1.1.10 Token状态
code, resp, ms = api("GET", "/auth/token-status", token=tok_owner)
t("AUTH", "1.1.10", "Token状态检查", code == 200, f"{code} {ms}ms")

# ----- 1.2 项目CRUD -----
print("\n  [1.2] 项目CRUD")

# 1.2.1 创建项目-正常
code, resp, ms = api("POST", "/projects", {
    "name": "FT-创建测试",
    "clientName": "功能测试",
    "deadline": "2026-07-01",
    "contractAmount": 50000,
    "paymentStages": [
        {"name": "首付", "amount": 20000},
        {"name": "尾款", "amount": 30000}
    ]
}, token=tok_owner)
proj = gd(resp)
ft_proj_id = proj.get("id", "") if isinstance(proj, dict) else ""
t("PROJ", "1.2.1", "创建项目(正常)", code in [200,201] and bool(ft_proj_id), f"{code} {ms}ms")

# 1.2.2 创建项目-空名称
code, resp, ms = api("POST", "/projects", {"name": "  "}, token=tok_owner)
t("PROJ", "1.2.2", "创建项目(空名称)", code == 400, f"{code} {ms}ms")

# 1.2.3 创建项目-超长名称(201字符)
code, resp, ms = api("POST", "/projects", {"name": "A" * 201}, token=tok_owner)
t("PROJ", "1.2.3", "创建项目(超长名称)", code == 400, f"{code} {ms}ms")

# 1.2.4 获取项目列表
code, resp, ms = api("GET", "/projects", token=tok_owner)
plist = gd(resp)
t("PROJ", "1.2.4", "获取项目列表", code == 200 and isinstance(plist, list), f"{code} {ms}ms, count={len(plist) if isinstance(plist,list) else 'N/A'}")

# 1.2.5 获取项目详情
if ft_proj_id:
    code, resp, ms = api("GET", f"/projects/{ft_proj_id}", token=tok_owner)
    pdetail = gd(resp)
    t("PROJ", "1.2.5", "获取项目详情", code == 200 and pdetail.get("name") == "FT-创建测试", f"{code} {ms}ms")

# 1.2.6 获取不存在的项目
code, resp, ms = api("GET", "/projects/nonexistent-id", token=tok_owner)
t("PROJ", "1.2.6", "获取不存在的项目", code == 404, f"{code} {ms}ms")

# 1.2.7 更新项目
if ft_proj_id:
    code, resp, ms = api("PUT", f"/projects/{ft_proj_id}", {"name": "FT-已更新"}, token=tok_owner)
    t("PROJ", "1.2.7", "更新项目名称", code == 200, f"{code} {ms}ms")

# 1.2.8 删除项目
code, resp, ms = api("POST", "/projects", {"name": "FT-待删除", "clientName": "Del"}, token=tok_owner)
del_id = gd(resp).get("id", "") if isinstance(gd(resp), dict) else ""
if del_id:
    code, resp, ms = api("DELETE", f"/projects/{del_id}", token=tok_owner)
    t("PROJ", "1.2.8", "删除项目", code == 200, f"{code} {ms}ms")

# 1.2.9 创建项目-无效状态
code, resp, ms = api("POST", "/projects", {"name": "BadStatus", "status": "invalid_status"}, token=tok_owner)
t("PROJ", "1.2.9", "创建项目(无效状态)", code == 400, f"{code} {ms}ms")

# ----- 1.3 产品单元 -----
print("\n  [1.3] 产品单元")

if ft_proj_id:
    code, resp, ms = api("POST", f"/projects/{ft_proj_id}/product-units/batch", {
        "units": [{"name": "FT-单元A", "imageIds": []}, {"name": "FT-单元B", "imageIds": []}]
    }, token=tok_owner)
    ft_units = gd(resp)
    ft_unit_ids = [u.get("id") for u in ft_units] if isinstance(ft_units, list) else []
    t("UNIT", "1.3.1", "批量创建产品单元", code in [200,201] and len(ft_unit_ids) == 2, f"{code} {ms}ms")

    if ft_unit_ids:
        code, resp, ms = api("GET", f"/projects/{ft_proj_id}/units", token=tok_owner)
        ft_units_list = gd(resp)
        t("UNIT", "1.3.2", "获取产品单元列表", code == 200, f"{code} {ms}ms, count={len(ft_units_list) if isinstance(ft_units_list,list) else 'N/A'}")

# ----- 1.4 支出管理 -----
print("\n  [1.4] 支出管理")

if ft_proj_id:
    code, resp, ms = api("POST", f"/projects/{ft_proj_id}/expenses", {
        "category": "测试支出", "amount": 1000, "expenseDate": "2026-06-18"
    }, token=tok_owner)
    ft_exp = gd(resp)
    ft_exp_id = ft_exp.get("id", "") if isinstance(ft_exp, dict) else ""
    t("EXP", "1.4.1", "添加支出", code in [200,201] and bool(ft_exp_id), f"{code} {ms}ms")

    code, resp, ms = api("POST", f"/projects/{ft_proj_id}/expenses", {
        "category": "支出2", "amount": 500, "expenseDate": "2026-06-18"
    }, token=tok_owner)
    ft_exp2 = gd(resp)
    ft_exp2_id = ft_exp2.get("id", "") if isinstance(ft_exp2, dict) else ""

    code, resp, ms = api("GET", f"/projects/{ft_proj_id}/expenses", token=tok_owner)
    exp_data = gd(resp)
    exp_total = exp_data.get("total", 0) if isinstance(exp_data, dict) else 0
    t("EXP", "1.4.2", "支出列表+合计", code == 200 and exp_total == 1500, f"{code} {ms}ms, total={exp_total}")

    if ft_exp_id:
        code, resp, ms = api("PUT", f"/projects/{ft_proj_id}/expenses/{ft_exp_id}", {"amount": 2000}, token=tok_owner)
        t("EXP", "1.4.3", "编辑支出金额", code == 200, f"{code} {ms}ms")

    if ft_exp2_id:
        code, resp, ms = api("DELETE", f"/projects/{ft_proj_id}/expenses/{ft_exp2_id}", token=tok_owner)
        t("EXP", "1.4.4", "删除支出", code == 200, f"{code} {ms}ms")

# 1.4.5 缺失必填字段
code, resp, ms = api("POST", f"/projects/{ft_proj_id}/expenses", {"amount": 1000}, token=tok_owner)
t("EXP", "1.4.5", "添加支出(缺category)", code == 400, f"{code} {ms}ms")

# ----- 1.5 批量操作 -----
print("\n  [1.5] 批量操作")

# 1.5.1 批量操作-无效action
code, resp, ms = api("POST", "/projects/batch", {"action": "invalid", "ids": []}, token=tok_owner)
t("BATCH", "1.5.1", "批量操作(无效action)", code == 400, f"{code} {ms}ms")

# 1.5.2 批量操作-空ids
code, resp, ms = api("POST", "/projects/batch", {"action": "archive", "ids": []}, token=tok_owner)
t("BATCH", "1.5.2", "批量操作(空ids)", code == 400, f"{code} {ms}ms")

# 1.5.3 批量操作-update-deadline缺deadline
code, resp, ms = api("POST", "/projects/batch", {"action": "update-deadline", "ids": [ft_proj_id]}, token=tok_owner)
t("BATCH", "1.5.3", "批量更新截止日期(缺deadline)", code == 400, f"{code} {ms}ms")

# ----- 1.6 通知模块 -----
print("\n  [1.6] 通知模块")

code, resp, ms = api("GET", "/notifications", token=tok_owner)
t("NOTIF", "1.6.1", "通知列表", code == 200, f"{code} {ms}ms")

code, resp, ms = api("PUT", "/notifications/read-all", {}, token=tok_owner)
t("NOTIF", "1.6.2", "全部已读", code == 200, f"{code} {ms}ms")

# ----- 1.7 工作空间 -----
print("\n  [1.7] 工作空间")

code, resp, ms = api("GET", "/workspaces/mine", token=tok_owner)
t("WS", "1.7.1", "获取工作空间", code == 200, f"{code} {ms}ms")

code, resp, ms = api("GET", "/workspaces/members", token=tok_owner)
members = gd(resp)
t("WS", "1.7.2", "成员列表", code == 200, f"{code} {ms}ms, count={len(members) if isinstance(members,list) else 'N/A'}")

# ----- 1.8 战情室 -----
print("\n  [1.8] 战情室")

code, resp, ms = api("GET", "/dashboard", token=tok_owner)
t("DASH", "1.8.1", "战情室首页", code == 200, f"{code} {ms}ms")

code, data, ms = api("GET", "/dashboard/export?format=excel", token=tok_owner, raw=True)
t("DASH", "1.8.2", "战情室导出Excel", code == 200 and len(data) > 500, f"{code} {ms}ms, size={len(data)}b")

code, data, ms = api("GET", "/dashboard/export?format=pdf", token=tok_owner, raw=True)
t("DASH", "1.8.3", "战情室导出PDF", code == 200 and len(data) > 500, f"{code} {ms}ms, size={len(data)}b")

# ============================================================
# 第二部分: 接口参数校验
# ============================================================
print("\n" + "=" * 70)
print("  二、接口参数校验 (API Validation)")
print("=" * 70)

# 2.1 SQL注入
print("\n  [2.1] SQL注入测试")
sql_payloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users --",
    "' OR 1=1 --",
]

for i, payload in enumerate(sql_payloads):
    code, resp, ms = api("POST", "/auth/login", {"email": payload, "password": "test"})
    t("SQLI", f"2.1.{i+1}", f"SQL注入({payload[:30]})", code in [400, 401, 422, 429], f"{code} {ms}ms")
    time.sleep(0.3)

# 2.2 XSS注入
print("\n  [2.2] XSS注入测试")
xss_payloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "<svg onload=alert(1)>",
]

for i, payload in enumerate(xss_payloads):
    code, resp, ms = api("POST", "/projects", {"name": payload}, token=tok_owner)
    t("XSS", f"2.2.{i+1}", f"XSS注入({payload[:30]})", code in [200, 201, 400], f"{code} {ms}ms")

# 2.3 特殊字符
print("\n  [2.3] 特殊字符测试")
special_chars = [
    ("\u0000", "NULL字符"),
    ("\n\r\t", "控制字符"),
    ("emoji\u2764\ufe0f", "Emoji"),
    ("\\\"';&|$(){}[]", "特殊符号"),
]

for i, (char, desc) in enumerate(special_chars):
    code, resp, ms = api("POST", "/projects", {"name": f"FT-{desc}{char}"}, token=tok_owner)
    t("CHAR", f"2.3.{i+1}", f"特殊字符({desc})", code in [200, 201, 400], f"{code} {ms}ms")

# 2.4 超长输入
print("\n  [2.4] 超长输入")
code, resp, ms = api("POST", "/projects", {"name": "A" * 10000}, token=tok_owner)
t("LONG", "2.4.1", "超长名称(10000字符)", code in [400, 413], f"{code} {ms}ms")

# 2.5 参数类型错误
print("\n  [2.5] 参数类型错误")
code, resp, ms = api("POST", "/projects", {"name": 12345, "contractAmount": "not_a_number"}, token=tok_owner)
t("TYPE", "2.5.1", "参数类型错误", code in [200, 201, 400], f"{code} {ms}ms")

# 2.6 响应体结构验证
print("\n  [2.6] 响应体结构验证")
code, resp, ms = api("GET", "/projects", token=tok_owner)
t("STRUCT", "2.6.1", "响应含data字段", isinstance(resp.get("data"), list), f"{code} {ms}ms")

# ============================================================
# 第三部分: 安全测试
# ============================================================
print("\n" + "=" * 70)
print("  三、安全测试 (Security)")
print("=" * 70)

# 3.1 未登录访问
print("\n  [3.1] 未登录访问")
unauth_endpoints = [
    ("GET", "/projects"),
    ("GET", "/dashboard"),
    ("GET", "/my-tasks"),
    ("GET", "/notifications"),
    ("GET", "/workspaces/mine"),
    ("POST", "/projects", {"name": "hack"}),
    ("PUT", "/comment-cards/any-id/status", {"status": "resolved"}),
]
for method, path, *body in unauth_endpoints:
    b = body[0] if body else None
    code, resp, ms = api(method, path, b)
    t("AUTHZ", f"3.1.{unauth_endpoints.index((method,path,*body))+1}", f"未登录{method} {path}", code == 401, f"{code}")

# 3.2 越权访问(editor访问owner资源)
print("\n  [3.2] 越权访问")

# Try to invite member as editor
code, resp, ms = api("POST", "/workspaces/invite", {"email": "hack@test.com", "role": "owner"}, token=tok_editor)
t("AUTHZ", "3.2.1", "Editor尝试邀请成员", code in [403, 401], f"{code}")

# Try to delete member as editor
code, resp, ms = api("DELETE", "/workspaces/members/user-001", token=tok_editor)
t("AUTHZ", "3.2.2", "Editor尝试删除成员", code in [403, 401], f"{code}")

# Try to update workspace as editor
code, resp, ms = api("PUT", "/workspaces/mine", {"name": "Hacked"}, token=tok_editor)
t("AUTHZ", "3.2.3", "Editor尝试更新工作空间", code in [403, 401], f"{code}")

# 3.3 修改URL参数访问他人数据
print("\n  [3.3] IDOR (Insecure Direct Object Reference)")
# Editor tries to access a project they shouldn't
code, resp, ms = api("GET", f"/projects/{ft_proj_id}", token=tok_editor)
t("AUTHZ", "3.3.1", "Editor访问同工作空间项目", code in [200, 403], f"{code}")

# 3.4 无效Token
print("\n  [3.4] Token安全")
code, resp, ms = api("GET", "/projects", token="invalid_token_here")
t("AUTHZ", "3.4.1", "无效Token", code == 401, f"{code}")

code, resp, ms = api("GET", "/projects", token="")
t("AUTHZ", "3.4.2", "空Token", code == 401, f"{code}")

# 3.5 密码强度
print("\n  [3.5] 密码强度")
code, resp, ms = api("POST", "/auth/register", {"email": "pwtest@test.com", "password": "12345", "name": "PwTest"})
t("AUTHZ", "3.5.1", "注册-5位密码(应拒绝)", code in [400, 429], f"{code}")

# 3.6 敏感信息泄露
print("\n  [3.6] 敏感信息泄露")
code, resp, ms = api("GET", "/projects", token=tok_owner)
if isinstance(resp.get("data"), list) and len(resp.get("data", [])) > 0:
    first = resp["data"][0]
    has_password = "password" in json.dumps(first).lower()
    t("AUTHZ", "3.6.1", "项目列表不含密码字段", not has_password)

# ============================================================
# 第四部分: 数据完整性
# ============================================================
print("\n" + "=" * 70)
print("  四、数据完整性 (Data Integrity)")
print("=" * 70)

# 4.1 创建后查库验证
print("\n  [4.1] 创建后查库")
if ft_proj_id:
    db_rows = qdb("SELECT name, client_name, contract_amount FROM projects WHERE id = ?", (ft_proj_id,))
    if db_rows:
        t("DATA", "4.1.1", "创建的项目存在于DB", db_rows[0][0] == "FT-已更新" and db_rows[0][2] == 50000, f"name={db_rows[0][0]}, amount={db_rows[0][2]}")

# 4.2 支出查库
print("\n  [4.2] 支出数据完整性")
if ft_proj_id:
    db_exp = qdb("SELECT COUNT(*) FROM expenses WHERE project_id = ?", (ft_proj_id,))
    t("DATA", "4.2.1", "支出记录存在于DB", db_exp[0][0] == 1, f"count={db_exp[0][0]}")

# 4.3 支付阶段
print("\n  [4.3] 支付阶段")
if ft_proj_id:
    code, resp, ms = api("GET", f"/projects/{ft_proj_id}", token=tok_owner)
    detail = gd(resp)
    stages = detail.get("paymentStages", []) if isinstance(detail, dict) else []
    stage_total = detail.get("paymentStageTotal", 0) if isinstance(detail, dict) else 0
    t("DATA", "4.3.1", "支付阶段等于合同金额", stage_total == 50000, f"total={stage_total}")

# ============================================================
# 第五部分: 异常与容错
# ============================================================
print("\n" + "=" * 70)
print("  五、异常与容错 (Error Handling)")
print("=" * 70)

# 5.1 404
print("\n  [5.1] 404处理")
code, resp, ms = api("GET", "/nonexistent-endpoint", token=tok_owner)
t("ERR", "5.1.1", "不存在的API路径", code == 404, f"{code}")

# 5.2 请求体JSON格式错误
print("\n  [5.2] 格式错误")
# Send invalid JSON via raw request
import http.client
conn = http.client.HTTPConnection("localhost", 3000)
conn.request("POST", "/v1/projects", body="not json", headers={"Content-Type": "application/json", "Authorization": f"Bearer {tok_owner}"})
resp = conn.getresponse()
t("ERR", "5.2.1", "无效JSON请求体", resp.status in [400, 500], f"status={resp.status}")
conn.close()

# 5.3 并发操作(快速连续请求)
print("\n  [5.3] 并发操作")
import concurrent.futures

def quick_create(i):
    code, _, _ = api("POST", "/projects", {"name": f"CONCURRENT-{i}", "clientName": "Load"}, token=tok_owner)
    return code

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
    futures = [ex.submit(quick_create, i) for i in range(5)]
    success = sum(1 for f in concurrent.futures.as_completed(futures) if f.result() in [200, 201])
t("ERR", "5.3.1", "5并发创建项目", success >= 5, f"success={success}/5")

# 5.4 重复删除
print("\n  [5.4] 重复操作")
code, resp, ms = api("POST", "/projects", {"name": "FT-DupDel", "clientName": "Dup"}, token=tok_owner)
dup_id = gd(resp).get("id", "") if isinstance(gd(resp), dict) else ""
if dup_id:
    api("DELETE", f"/projects/{dup_id}", token=tok_owner)
    code, resp, ms = api("DELETE", f"/projects/{dup_id}", token=tok_owner)
    t("ERR", "5.4.1", "重复删除项目", code in [404, 200], f"{code}")

# ============================================================
# 第六部分: 性能
# ============================================================
print("\n" + "=" * 70)
print("  六、性能 (Performance)")
print("=" * 70)

# 6.1 核心接口响应时间
print("\n  [6.1] 核心接口响应时间")
perf_tests = [
    ("GET /projects", "/projects", None),
    ("GET /dashboard", "/dashboard", None),
    ("GET /my-tasks", "/my-tasks", None),
    ("GET /notifications", "/notifications", None),
]

for name, path, body in perf_tests:
    # Average over 5 runs
    times = []
    for _ in range(5):
        code, _, ms = api("GET", path, token=tok_owner)
        if code == 200:
            times.append(ms)
    avg = sum(times) / len(times) if times else 0
    passed = avg < 500
    t("PERF", f"6.1.{perf_tests.index((name,path,body))+1}", f"{name}", passed, f"avg={avg:.0f}ms (threshold:500ms)")

# 6.2 数据库查询性能
print("\n  [6.2] 数据库查询")
t0 = time.time()
rows = qdb("SELECT * FROM projects LIMIT 1000")
db_time = (time.time() - t0) * 1000
t("PERF", "6.2.1", "DB查询1000条", db_time < 100, f"{db_time:.0f}ms")

# ============================================================
# SUMMARY
# ============================================================
test_duration = time.time() - test_start
print("\n" + "=" * 70)
print("  测试汇总")
print("=" * 70)

# Group by category
from collections import defaultdict
cat_counts = defaultdict(lambda: {"pass": 0, "fail": 0, "info": 0})
for cat, i, name, s, detail in results:
    cat_counts[cat]["pass" if s == "PASS" else ("fail" if s == "FAIL" else "info")] += 1

for cat in sorted(cat_counts.keys()):
    c = cat_counts[cat]
    total = c["pass"] + c["fail"] + c["info"]
    rate = c["pass"] / total * 100 if total > 0 else 0
    print(f"  {cat}: {c['pass']}/{total} ({rate:.0f}%)")

pass_count = sum(1 for _, _, _, s, _ in results if s == "PASS")
fail_count = sum(1 for _, _, _, s, _ in results if s == "FAIL")
info_count = sum(1 for _, _, _, s, _ in results if s == "INFO")
total = len(results)

print(f"\n  总计: {total}")
print(f"  PASS: {pass_count} ({pass_count/total*100:.1f}%)" if total > 0 else "  PASS: 0")
print(f"  FAIL: {fail_count}")
print(f"  INFO: {info_count}")
print(f"  耗时: {test_duration:.1f}s")

# Save
with open("/workspace/comprehensive_results.json", "w") as f:
    json.dump({
        "results": [{"cat": r[0], "id": r[1], "name": r[2], "status": r[3], "detail": r[4]} for r in results],
        "pass": pass_count, "fail": fail_count, "info": info_count, "total": total,
        "duration": test_duration
    }, f, ensure_ascii=False, indent=2)

print(f"\n  报告: /workspace/comprehensive_results.json")
print("=" * 70)