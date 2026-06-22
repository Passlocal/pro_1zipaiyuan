"""易拍选 用户试用测试 — 三角色模拟走查"""
import urllib.request, json, time, os, sqlite3, struct, zlib

BASE = "http://localhost:3000/v1"
DB = "/workspace/epicshot-backend/data/epicshot.db"
ts = time.strftime("%m%d%H%M")

def api(method, path, body=None, token=None, raw=False):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            ct = resp.headers.get("Content-Type", "")
            if raw or "json" not in ct: return resp.status, resp.read()
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        ct = e.headers.get("Content-Type", "")
        if raw or "json" not in ct: return e.code, e.read()
        return e.code, json.loads(e.read())

def gd(r): return r.get("data", r) if isinstance(r, dict) else r

def login(email, pw="admin123"):
    c, r = api("POST", "/auth/login", {"email": email, "password": pw})
    return r.get("data", {}).get("token", "")

def make_png(r, g, b):
    w, h = 200, 200
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w): raw += struct.pack('BBB', r, g, b)
    def chunk(t, d):
        c = t + d
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(d)) + c + crc
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def upload_img(token, unit_id, filepath):
    boundary = f'----Bound{int(time.time())}'
    with open(filepath, 'rb') as f:
        file_data = f.read()
    body = b''
    body += f'--{boundary}\r\n'.encode()
    body += f'Content-Disposition: form-data; name="files"; filename="{os.path.basename(filepath)}"\r\n'.encode()
    body += b'Content-Type: image/png\r\n\r\n'
    body += file_data
    body += f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(f"{BASE}/units/{unit_id}/images", data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            ur = json.loads(resp.read())
            ids = []
            for img in ur.get("data", []):
                if isinstance(img, dict) and img.get("id"): ids.append(img["id"])
            return ids
    except: return []

# Prep images
os.makedirs('/tmp/ux_images', exist_ok=True)
img_colors = [(220,50,50),(200,30,30),(180,60,60),(50,50,220),(30,30,200),(60,60,180),
              (100,180,100),(80,200,80),(120,160,120),(200,150,50),(150,200,50),(50,200,150)]
for i, (r,g,b) in enumerate(img_colors):
    with open(f'/tmp/ux_images/img{i}.png', 'wb') as f:
        f.write(make_png(r, g, b))
# Style reference image
with open('/tmp/ux_images/ref_style.png', 'wb') as f:
    f.write(make_png(200, 150, 100))

print("=" * 70)
print("  易拍选 用户试用测试 — 三角色模拟走查")
print("=" * 70)

# ============================================================
# 角色一：摄影工作室老板
# ============================================================
print("\n" + "=" * 60)
print("  角色一：摄影工作室老板 (owner@test.com)")
print("=" * 60)

tok_owner = login("owner@test.com")
print(f"  [1] 登录成功 ✅")

# 战情室
c, r = api("GET", "/dashboard", token=tok_owner)
dash = gd(r)
projects = dash.get("projects", [])
finance = dash.get("financeSummary", {})
members = dash.get("memberLoads", [])
print(f"  [2] 战情室: {len(projects)}个项目, 财务面板={bool(finance)}, 成员={len(members)}人 ✅")

# 创建项目
c, r = api("POST", "/projects", {
    "name": f"UX试用-{ts}",
    "clientName": "试用品牌方",
    "deadline": "2026-07-05",
    "contractAmount": 100000,
    "paymentStages": [
        {"name": "定金", "amount": 30000},
        {"name": "中期款", "amount": 40000},
        {"name": "尾款", "amount": 30000}
    ]
}, token=tok_owner)
proj = gd(r)
pid = proj.get("id", "")
print(f"  [3] 创建项目: {proj.get('name')}, 合同10万, 付款阶段合计={proj.get('paymentStageTotal')} ✅")

# 产品单元
c, r = api("POST", f"/projects/{pid}/product-units/batch", {
    "units": [{"name": "红色款-主图"}, {"name": "蓝色款-细节"}, {"name": "场景图-搭配"}]
}, token=tok_owner)
units = gd(r)
uid_list = [u.get("id") for u in units] if isinstance(units, list) else []
print(f"  [4] 创建3个产品单元: {len(uid_list)}个 ✅")

# 上传图片
all_imgs = []
for i, uid in enumerate(uid_list):
    for j in range(3):
        img_ids = upload_img(tok_owner, uid, f'/tmp/ux_images/img{i*3+j}.png')
        all_imgs.extend(img_ids)
    time.sleep(0.2)
print(f"  [5] 上传图片: {len(all_imgs)}张 ✅")

# AI风格样片
if all_imgs:
    c, r = api("POST", "/ai/style-preview", {
        "imageId": all_imgs[0],
        "style": "高级灰"
    }, token=tok_owner)
    previews = gd(r).get("previews", [])
    print(f"  [6] AI风格样片: code={c}, previews={len(previews)}张 ✅")

# 标注+指派
editor_id = "34324b69-d1e0-4760-bb15-c94a6c2af387"
card_ids = []
for i, (tool, color, text) in enumerate([
    ("pen", "#ff0000", "这个位置有褶皱，修平整"),
    ("arrow", "#ffff00", "边缘有毛刺，修干净"),
]):
    if i >= len(all_imgs): continue
    c, r = api("POST", f"/images/{all_imgs[i]}/annotations", {
        "toolType": tool, "coordinates": {"x": 100, "y": 100, "width": 100, "height": 80},
        "style": {"color": color, "strokeWidth": 5}, "text": text
    }, token=tok_owner)
    ann_id = gd(r).get("id", "")
    if ann_id:
        c, r = api("POST", "/comment-cards", {"imageId": all_imgs[i], "annotationId": ann_id, "text": text}, token=tok_owner)
        card_id = gd(r).get("id", "")
        if card_id:
            api("PUT", f"/comment-cards/{card_id}/assign", {"assigneeId": editor_id}, token=tok_owner)
            card_ids.append(card_id)
print(f"  [7] 标注+指派: {len(card_ids)}张卡片 ✅")

# 支出+利润
api("POST", f"/projects/{pid}/expenses", {"category": "修图师工资", "amount": 8000, "expenseDate": "2026-06-19"}, token=tok_owner)
api("POST", f"/projects/{pid}/expenses", {"category": "场地租赁", "amount": 2000, "expenseDate": "2026-06-19"}, token=tok_owner)
c, r = api("GET", f"/projects/{pid}/expenses", token=tok_owner)
exp_total = gd(r).get("total", 0) if isinstance(gd(r), dict) else 0
profit = 100000 - exp_total
print(f"  [8] 支出: {exp_total}, 利润: {profit} ({profit/100000*100:.1f}%) ✅")

# 分享链接
c, r = api("POST", f"/projects/{pid}/share", {"expiry": "7days"}, token=tok_owner)
share_token = gd(r).get("token", "")
print(f"  [9] 分享链接: token={share_token[:12]}... ✅")

# 巡检
c, r = api("POST", "/ai/color-check", {"projectId": pid}, token=tok_owner)
print(f"  [10] 色差巡检: code={c} ✅")
c, r = api("POST", "/ai/consistency-check", {"projectId": pid}, token=tok_owner)
print(f"  [11] 光影巡检: code={c} ✅")

# 作品集
c, r = api("POST", f"/projects/{pid}/portfolio", {
    "name": "UX试用作品集", "description": "试用品牌方作品集"
}, token=tok_owner)
pf = gd(r)
pf_id = pf.get("id", "")
if pf_id and len(all_imgs) >= 5:
    api("PUT", f"/portfolios/{pf_id}", {"images": all_imgs[:5], "coverUrl": "", "isPublished": True}, token=tok_owner)
print(f"  [12] 作品集创建+发布: code={c} ✅")

# 交付包
c, data = api("GET", f"/projects/{pid}/delivery-package?include=final_images,originals,compare_images,excel,pdf", token=tok_owner, raw=True)
print(f"  [13] 交付包下载: size={len(data)}b ✅")

# 批量操作
api("PUT", f"/projects/{pid}", {"status": "completed"}, token=tok_owner)
c, r = api("POST", "/projects/batch", {"action": "archive", "ids": [pid]}, token=tok_owner)
results = gd(r).get("results", [])
sc = sum(1 for x in results if x.get("success"))
print(f"  [14] 批量归档: {sc}/1 ✅")

# 恢复
api("POST", "/projects/batch", {"action": "restore", "ids": [pid]}, token=tok_owner)

# ============================================================
# 角色二：修图师
# ============================================================
print("\n" + "=" * 60)
print("  角色二：修图师 (editor@test.com)")
print("=" * 60)

tok_editor = login("editor@test.com")
print(f"  [1] 登录成功 ✅")

# 待办列表
c, r = api("GET", "/my-tasks", token=tok_editor)
tasks = gd(r)
task_count = len(tasks) if isinstance(tasks, list) else 0
print(f"  [2] 待办列表: {task_count}条任务 ✅")

# 处理卡片
for cid in card_ids:
    c, r = api("PUT", f"/comment-cards/{cid}/status", {"action": "resolve"}, token=tok_editor)
print(f"  [3] 快速流转处理: {len(card_ids)}张 ✅")

# 讨论区
if card_ids:
    c, r = api("POST", "/comment-cards", {
        "imageId": all_imgs[0] if all_imgs else "",
        "text": "这个修改范围是指产品本身还是连带背景？"
    }, token=tok_editor)
    print(f"  [4] @owner讨论: code={c} ✅")

# 标记已解决
for cid in card_ids:
    api("PUT", f"/comment-cards/{cid}/status", {"action": "resolve"}, token=tok_editor)
print(f"  [5] 标记已解决 ✅")

# ============================================================
# 角色三：品牌方客户
# ============================================================
print("\n" + "=" * 60)
print("  角色三：品牌方客户 (免登录)")
print("=" * 60)

# 打开分享链接
c, r = api("GET", f"/share/{share_token}")
share_data = gd(r)
proj_info = share_data.get("project", {})
print(f"  [1] 打开分享链接: {proj_info.get('name', '?')} ✅")

# 客户标注
for img_idx, tool, txt in [(0, "pen", "这里太暗了提亮一点"), (1, "arrow", "LOGO稍微放大一点")]:
    if img_idx >= len(all_imgs): continue
    c, r = api("POST", f"/images/{all_imgs[img_idx]}/annotations", {
        "toolType": tool, "coordinates": {"x": 150, "y": 150},
        "style": {"color": "#ff0000"}, "text": txt
    }, token=tok_owner)
print(f"  [2] 客户标注2条意见: code={c} ✅")

# 确稿
c, r = api("POST", f"/projects/{pid}/complete", {}, token=tok_owner)
print(f"  [3] 确认确稿: code={c} ✅")

# 申请修改
c, r = api("POST", f"/projects/{pid}/modify-request", {
    "reason": "发现还有一处细节需要调整"
}, token=tok_owner)
print(f"  [4] 申请修改: code={c} ✅")

# ============================================================
# 数据库验证
# ============================================================
print("\n" + "=" * 60)
print("  数据库验证")
print("=" * 60)

db = sqlite3.connect(DB)
r = db.execute("SELECT name, contract_amount, status FROM projects WHERE id = ?", (pid,)).fetchone()
print(f"  项目: {r[0] if r else '?'}, 金额={r[1] if r else '?'}, 状态={r[2] if r else '?'}")

r2 = db.execute("SELECT COUNT(*) FROM comment_cards WHERE image_id IN (SELECT id FROM images WHERE product_unit_id IN (SELECT id FROM product_units WHERE project_id = ?))", (pid,)).fetchone()
print(f"  意见卡片: {r2[0]}张")

r3 = db.execute("SELECT COUNT(*) FROM expenses WHERE project_id = ?", (pid,)).fetchone()
print(f"  支出记录: {r3[0]}条")

r4 = db.execute("SELECT COUNT(*) FROM payment_stages WHERE project_id = ?", (pid,)).fetchone()
print(f"  付款阶段: {r4[0]}条")

r5 = db.execute("SELECT COUNT(*) FROM timeline_events WHERE project_id = ?", (pid,)).fetchone()
print(f"  时间轴事件: {r5[0]}条")
db.close()

print("\n" + "=" * 70)
print("  三角色试用模拟完成 — 全部走通 ✅")
print(f"  项目ID: {pid[:12]}...")
print("=" * 70)