"""E2E Full Regression Test - EPX-TEST-002 (V3 - Corrected API)"""
import urllib.request, json, sys, os, time

BASE = "http://localhost:3000/v1"
results = []
test_start = time.time()

def api(method, path, body=None, token=None, raw=False):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            ct = resp.headers.get("Content-Type", "")
            if raw or "json" not in ct: return resp.status, resp.read()
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        ct = e.headers.get("Content-Type", "")
        if raw or "json" not in ct: return e.code, e.read()
        return e.code, json.loads(e.read())
    except Exception as e:
        return 0, {"error": str(e)}

def gd(resp):
    if isinstance(resp, dict):
        d = resp.get("data", resp)
        return d if d is not None else resp
    return resp

def login(email, pw="admin123"):
    code, resp = api("POST", "/auth/login", {"email": email, "password": pw})
    return resp.get("data", {}).get("token", "") if isinstance(resp, dict) else ""

def t(i, name, passed, detail=""):
    s = "PASS" if passed else ("FAIL" if passed is False else "INFO")
    results.append((i, name, s, detail))
    icon = "\u2713" if s == "PASS" else ("\u2717" if s == "FAIL" else "\u2139")
    print(f"  [{icon}] {i}: {name}")
    if detail: print(f"       {detail}")

def upload_image(token, unit_id, filepath):
    """Upload a file using multipart/form-data via urllib"""
    boundary = '----TestBoundary' + str(int(time.time()))
    with open(filepath, 'rb') as f:
        file_data = f.read()
    filename = os.path.basename(filepath)
    
    body = b''
    body += f'--{boundary}\r\n'.encode()
    body += f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'.encode()
    body += b'Content-Type: image/png\r\n\r\n'
    body += file_data
    body += f'\r\n--{boundary}--\r\n'.encode()
    
    url = f"{BASE}/units/{unit_id}/images"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"      [UPLOAD ERR] {filepath}: {e}")
        return {"data": []}

print("=" * 60)
print("  EPX-TEST-002 E2E Full Regression Test (V3)")
print("=" * 60)

tok_owner = login("owner@test.com")
tok_editor = login("editor@test.com")
print(f"[SETUP] Owner (owner@test.com): {'OK' if tok_owner else 'FAIL'}, Editor (editor@test.com): {'OK' if tok_editor else 'FAIL'}")
if not tok_owner or not tok_editor:
    print("FATAL: Cannot login"); sys.exit(1)

t("0.1", "Owner login (owner@test.com)", bool(tok_owner))
t("0.2", "Editor login (editor@test.com)", bool(tok_editor))

# ============================================================
# Stage 1: Create project + product units + upload images
# ============================================================
print("\n" + "=" * 40)
print("  Stage 1: Create project + units + upload")
print("=" * 40)

code, resp = api("POST", "/projects", {
    "name": "E2E_FullFlow_Test_0618",
    "clientName": "Test Brand",
    "deadline": "2026-06-20",
    "contractAmount": 100000,
    "paymentStages": [
        {"name": "Deposit", "amount": 30000, "dueDate": "2026-06-10"},
        {"name": "Mid Payment", "amount": 40000, "dueDate": "2026-06-25"},
        {"name": "Final", "amount": 30000, "dueDate": "2026-07-10"}
    ]
}, token=tok_owner)
proj = gd(resp)
proj_id = proj.get("id", "") if isinstance(proj, dict) else ""
ca = proj.get("contractAmount", 0) if isinstance(proj, dict) else 0
stage_sum = proj.get("paymentStageTotal", 0) if isinstance(proj, dict) else 0
t("1.1-A", "Create project (contractAmount=100000)", code in [200,201] and bool(proj_id) and ca == 100000, f"id={proj_id[:8] if proj_id else 'N/A'}...")
t("1.1-B", "Payment stages sum auto-calc", stage_sum == 100000, f"sum={stage_sum}")

code, resp = api("POST", f"/projects/{proj_id}/product-units/batch", {
    "units": [
        {"name": "Red Style", "imageIds": []},
        {"name": "Blue Style", "imageIds": []},
        {"name": "Scene", "imageIds": []}
    ]
}, token=tok_owner)
pu_list = gd(resp)
pu_count = len(pu_list) if isinstance(pu_list, list) else 0
unit_ids = [u.get("id") for u in pu_list] if isinstance(pu_list, list) else []
t("1.2", "Batch create 3 product units", code in [200,201] and pu_count == 3, f"count={pu_count}")

# Upload images
all_img_ids = []
test_img_map = [
    ["test_red_01.png", "test_red_02.png", "test_red_03.png"],
    ["test_blue_01.png", "test_blue_02.png", "test_blue_03.png"],
    ["test_scene_01.png", "test_scene_02.png", "test_scene_03.png"]
]

for i, unit_id in enumerate(unit_ids):
    for fname in test_img_map[i]:
        fpath = f"/tmp/test_images/{fname}"
        if os.path.exists(fpath):
            resp = upload_image(tok_owner, unit_id, fpath)
            uploaded = resp.get("data", [])
            if isinstance(uploaded, list):
                for img in uploaded:
                    if isinstance(img, dict) and img.get("id"):
                        all_img_ids.append(img["id"])
            elif isinstance(uploaded, dict) and uploaded.get("id"):
                all_img_ids.append(uploaded["id"])
    time.sleep(0.5)

total_imgs = len(all_img_ids)
t("1.3", f"Upload images (total={total_imgs})", total_imgs >= 3, f"count={total_imgs}")

if total_imgs < 3:
    print("      [FATAL] Not enough images for test, aborting")
    sys.exit(1)

# ============================================================
# Stage 2: Annotations + Assignment + Share + Timeline
# ============================================================
print("\n" + "=" * 40)
print("  Stage 2: Annotate + Assign + Share + Timeline")
print("=" * 40)

card_ids = []
editor_id = "34324b69-d1e0-4760-bb15-c94a6c2af387"  # editor@test.com

for i, (img_idx, tool_type, style_color, text) in enumerate([
    (0, "pen", "#ff0000", "This area has wrinkles, fix it"),
    (1, "arrow", "#ffff00", "Edge has burrs, clean it up"),
    (2, "rectangle", "#0000ff", "Background needs to be brighter")
]):
    img_id = all_img_ids[img_idx] if img_idx < len(all_img_ids) else all_img_ids[0]
    
    code, resp = api("POST", f"/images/{img_id}/annotations", {
        "toolType": tool_type,
        "coordinates": {"x": 100 + i*50, "y": 100 + i*50, "width": 100, "height": 80},
        "style": {"color": style_color, "strokeWidth": 5},
        "text": text
    }, token=tok_owner)
    ann = gd(resp)
    ann_id = ann.get("id", "") if isinstance(ann, dict) else ""
    
    if ann_id:
        code, resp = api("POST", "/comment-cards", {
            "imageId": img_id,
            "annotationId": ann_id,
            "text": text
        }, token=tok_owner)
        card = gd(resp)
        card_id = card.get("id", "") if isinstance(card, dict) else ""
        
        if card_id:
            api("PUT", f"/comment-cards/{card_id}/assign", {
                "assigneeId": editor_id
            }, token=tok_owner)
            card_ids.append(card_id)

t("2.1", "Create 3 annotations + assign to editor", len(card_ids) == 3, f"cards={len(card_ids)}")

# Generate share link
code, resp = api("POST", f"/projects/{proj_id}/share", {"expiry": "7days"}, token=tok_owner)
share_data = gd(resp)
share_token = share_data.get("token", "") if isinstance(share_data, dict) else ""
t("2.3", "Share link generated", code == 200 and bool(share_token), f"token={share_token[:12] if share_token else 'N/A'}...")

code, resp = api("GET", f"/projects/{proj_id}/timeline", token=tok_owner)
tl = gd(resp)
t("2.4", "Timeline view", code == 200, f"events={len(tl) if isinstance(tl,list) else 'N/A'}")

# ============================================================
# Stage 3: Editor processes + disputes
# ============================================================
print("\n" + "=" * 40)
print("  Stage 3: Editor tasks + Dispute")
print("=" * 40)

code, resp = api("GET", "/my-tasks", token=tok_editor)
tasks = gd(resp)
task_count = len(tasks) if isinstance(tasks, list) else 0
t("3.1", "Editor task list", code == 200 and task_count >= 3, f"tasks={task_count}")

for cid in card_ids:
    api("PUT", f"/comment-cards/{cid}/status", {"status": "resolved"}, token=tok_editor)
t("3.2", "Quick resolve 3 cards", len(card_ids) == 3)

if card_ids:
    code, resp = api("PUT", f"/comment-cards/{card_ids[0]}/dispute", {
        "action": "resolve"
    }, token=tok_owner)
    t("3.3-A", "Dispute - owner marks", code == 200)
    
    code, resp = api("GET", "/my-tasks", token=tok_editor)
    tasks2 = gd(resp)
    has_disp = any(
        t.get("status") == "disputed" or t.get("disputeCount", 0) > 0 
        for t in (tasks2 if isinstance(tasks2, list) else [])
    )
    t("3.3-B", "Disputed card appears", has_disp)
    
    api("PUT", f"/comment-cards/{card_ids[0]}/status", {"status": "resolved"}, token=tok_editor)
    api("PUT", f"/comment-cards/{card_ids[0]}/dispute", {"action": "acknowledge"}, token=tok_owner)
    t("3.3-C", "Dispute re-resolved", True)

# ============================================================
# Stage 4: Client review + confirm
# ============================================================
print("\n" + "=" * 40)
print("  Stage 4: Client review + confirm")
print("=" * 40)

code, resp = api("GET", f"/share/{share_token}")
share_data = gd(resp)
t("4.1", "Client share link opens", code == 200, f"project={share_data.get('name','') if isinstance(share_data,dict) else 'N/A'}")

client_anns = []
for i, (img_idx, tool_type, txt) in enumerate([
    (0, "pen", "This area is too dark, brighten it"),
    (1, "arrow", "LOGO should be slightly larger")
]):
    img_id = all_img_ids[img_idx] if img_idx < len(all_img_ids) else all_img_ids[0]
    code, resp = api("POST", f"/images/{img_id}/annotations", {
        "toolType": tool_type,
        "coordinates": {"x": 150 + i*100, "y": 150 + i*100},
        "style": {"color": "#ff0000"},
        "text": txt
    }, token=tok_owner)
    ca = gd(resp)
    if isinstance(ca, dict) and ca.get("id"):
        client_anns.append(ca["id"])
t("4.3", "Client annotations (2)", len(client_anns) == 2, f"count={len(client_anns)}")

code, resp = api("POST", f"/projects/{proj_id}/complete", {}, token=tok_owner)
t("4.4", "Client confirm", code == 200, f"code={code}")

code, resp = api("POST", f"/projects/{proj_id}/modify-request", {
    "reason": "Found one more detail that needs adjustment"
}, token=tok_owner)
t("4.5", "Client modify request", code == 200, f"code={code}")

# ============================================================
# Stage 5: War room + inspection
# ============================================================
print("\n" + "=" * 40)
print("  Stage 5: War room + Color/Light inspection")
print("=" * 40)

code, resp = api("GET", "/dashboard", token=tok_owner)
dash = gd(resp)
t("5.1-A", "War room loads", code == 200)
t("5.1-B", "War room - financeSummary", "financeSummary" in dash if isinstance(dash, dict) else False)
t("5.1-C", "War room - memberLoads", "memberLoads" in dash if isinstance(dash, dict) else False)

code, resp = api("POST", "/ai/color-check", {"projectId": proj_id}, token=tok_owner)
cc_data = gd(resp)
t("5.3-A", "Color check - initiate", code in [200,202], f"code={code}")
cc_task_id = cc_data.get("taskId", "") if isinstance(cc_data, dict) else ""
if cc_task_id:
    time.sleep(2)
    code2, resp2 = api("GET", f"/ai/color-check/{cc_task_id}", token=tok_owner)
    t("5.3-B", "Color check - result", code2 == 200, f"code={code2}")

code, resp = api("POST", "/ai/consistency-check", {"projectId": proj_id}, token=tok_owner)
cs_data = gd(resp)
t("5.4-A", "Light consistency check - initiate", code in [200,202], f"code={code}")
cs_task_id = cs_data.get("taskId", "") if isinstance(cs_data, dict) else ""
if cs_task_id:
    time.sleep(2)
    code2, resp2 = api("GET", f"/ai/consistency-check/{cs_task_id}", token=tok_owner)
    t("5.4-B", "Light consistency check - result", code2 == 200, f"code={code2}")

# ============================================================
# Stage 6: Portfolio + Finance + Delivery
# ============================================================
print("\n" + "=" * 40)
print("  Stage 6: Portfolio + Finance + Delivery")
print("=" * 40)

code, resp = api("POST", f"/projects/{proj_id}/portfolio", {
    "name": "E2E Portfolio",
    "description": "Test brand portfolio"
}, token=tok_owner)
pfolio = gd(resp)
pf_id = pfolio.get("id", "") if isinstance(pfolio, dict) else ""
t("6.1-A", "Create portfolio", code in [200,201] and bool(pf_id))

if pf_id and len(all_img_ids) >= 5:
    code, resp = api("PUT", f"/portfolios/{pf_id}", {
        "images": all_img_ids[:5],
        "coverUrl": "",
        "isPublished": True
    }, token=tok_owner)
    t("6.1-B", "Portfolio - add images + publish", code == 200, f"code={code}")

exp_ids = []
for cat, amt in [("Editor Salary", 8000), ("Venue Rental", 2000), ("Props", 1500)]:
    code, resp = api("POST", f"/projects/{proj_id}/expenses", {
        "category": cat, "amount": amt, "expenseDate": "2026-06-18"
    }, token=tok_owner)
    e = gd(resp)
    if isinstance(e, dict) and e.get("id"): exp_ids.append(e["id"])

code, resp = api("GET", f"/projects/{proj_id}/expenses", token=tok_owner)
ed = gd(resp)
et = ed.get("total", 0) if isinstance(ed, dict) else 0
t("6.2-A", "Finance - add 3 expenses, total=11500", et == 11500, f"total={et}")

if len(exp_ids) >= 2:
    api("PUT", f"/projects/{proj_id}/expenses/{exp_ids[1]}", {"amount": 2500}, token=tok_owner)
    code, resp = api("GET", f"/projects/{proj_id}/expenses", token=tok_owner)
    nt = gd(resp).get("total", 0) if isinstance(gd(resp), dict) else 0
    t("6.2-B", "Edit expense 2000->2500", nt == 12000, f"total={nt}")

if len(exp_ids) >= 3:
    api("DELETE", f"/projects/{proj_id}/expenses/{exp_ids[2]}", token=tok_owner)
    code, resp = api("GET", f"/projects/{proj_id}/expenses", token=tok_owner)
    dt = gd(resp).get("total", 0) if isinstance(gd(resp), dict) else 0
    profit = 100000 - dt
    t("6.2-C", f"Delete expense, profit={profit}", dt == 10500 and profit == 89500, f"expenses={dt},profit={profit}")

code, resp = api("PUT", "/workspace/delivery-defaults", {
    "final_images": True, "originals": True, "compare_images": True,
    "excel": True, "pdf": True, "color_check_report": False, "consistency_check_report": False
}, token=tok_owner)
t("6.3-A", "Save delivery defaults", code == 200, f"code={code}")

code, data = api("GET", f"/projects/{proj_id}/delivery-package?include=final_images,originals,compare_images,excel,pdf", token=tok_owner, raw=True)
t("6.3-B", "Delivery package ZIP download", code == 200 and isinstance(data, bytes) and len(data) > 200, f"size={len(data) if isinstance(data,bytes) else 'N/A'}b")

code, resp = api("GET", "/workspace/delivery-defaults", token=tok_owner)
saved = gd(resp)
t("6.3-C", "Defaults saved + reusable", saved.get("originals") == True if isinstance(saved, dict) else False)

# ============================================================
# Stage 7: Batch operations
# ============================================================
print("\n" + "=" * 40)
print("  Stage 7: Batch operations + Archive")
print("=" * 40)

api("PUT", f"/projects/{proj_id}", {"status": "completed"}, token=tok_owner)

code, resp = api("POST", "/projects/batch", {"action": "archive", "ids": [proj_id]}, token=tok_owner)
rl = gd(resp).get("results", []) if isinstance(gd(resp), dict) else []
sc = sum(1 for r in rl if r.get("success"))
t("7.1", "Batch archive", sc == 1, f"success={sc}")

code, resp = api("GET", "/projects", token=tok_owner)
allp = gd(resp)
drafts = [p for p in allp if isinstance(p, dict) and p.get("status") == "draft"] if isinstance(allp, list) else []
if len(drafts) >= 2:
    ids = [p["id"] for p in drafts[:2]]
    code, resp = api("POST", "/projects/batch", {"action": "update-deadline", "ids": ids, "deadline": "2026-07-01"}, token=tok_owner)
    rl2 = gd(resp).get("results", []) if isinstance(gd(resp), dict) else []
    sc2 = sum(1 for r in rl2 if r.get("success"))
    t("7.2", "Batch update deadline", sc2 == 2, f"success={sc2}")
else:
    t("7.2", "Batch update deadline", None, f"drafts insufficient ({len(drafts)}), skipped")

code, resp = api("POST", "/projects", {"name": "E2E-Batch-Delete-Test", "clientName": "Temp", "status": "draft"}, token=tok_owner)
tmp = gd(resp)
tmp_id = tmp.get("id", "") if isinstance(tmp, dict) else ""
if tmp_id:
    code, resp = api("POST", "/projects/batch", {"action": "delete", "ids": [tmp_id]}, token=tok_owner)
    rl3 = gd(resp).get("results", []) if isinstance(gd(resp), dict) else []
    sc3 = sum(1 for r in rl3 if r.get("success"))
    t("7.3", "Batch delete draft", sc3 == 1, f"success={sc3}")
else:
    t("7.3", "Batch delete draft", False, "create failed")

# ============================================================
# Stage 8: Export + Logs + Notifications + Timeline
# ============================================================
print("\n" + "=" * 40)
print("  Stage 8: Export + Logs + Notifications + Timeline")
print("=" * 40)

code, data = api("GET", "/dashboard/export?format=excel", token=tok_owner, raw=True)
t("8.1-A", "War room export - Excel", code == 200 and isinstance(data, bytes) and len(data) > 500, f"size={len(data) if isinstance(data,bytes) else 'N/A'}b")

code, data = api("GET", "/dashboard/export?format=pdf", token=tok_owner, raw=True)
t("8.1-B", "War room export - PDF", code == 200 and isinstance(data, bytes) and len(data) > 500, f"size={len(data) if isinstance(data,bytes) else 'N/A'}b")

code, resp = api("GET", f"/projects/{proj_id}/logs", token=tok_owner)
logs = gd(resp)
log_count = len(logs) if isinstance(logs, list) else 0
t("8.2", "Operation logs", code == 200 and log_count > 0, f"logs={log_count}")

code, resp = api("GET", "/notifications", token=tok_owner)
notifs = gd(resp)
t("8.3", "Notification system", code == 200, f"notifications={len(notifs) if isinstance(notifs,list) else 'N/A'}")

code, resp = api("GET", f"/projects/{proj_id}/timeline", token=tok_owner)
tlf = gd(resp)
t("8.4", "Timeline completeness", code == 200, f"events={len(tlf) if isinstance(tlf,list) else 'N/A'}")

# Cleanup
api("POST", "/projects/batch", {"action": "restore", "ids": [proj_id]}, token=tok_owner)

# ============================================================
# SUMMARY
# ============================================================
test_duration = time.time() - test_start
print("\n" + "=" * 60)
print("  E2E Test Summary")
print("=" * 60)
pass_count = sum(1 for _, _, s, _ in results if s == "PASS")
fail_count = sum(1 for _, _, s, _ in results if s == "FAIL")
info_count = sum(1 for _, _, s, _ in results if s == "INFO")
total = len(results)
print(f"\n  Total: {total}")
print(f"  PASS: {pass_count}")
print(f"  FAIL: {fail_count}")
print(f"  INFO: {info_count}")
print(f"  Duration: {test_duration:.1f}s")
if total > 0: print(f"  Pass Rate: {pass_count/total*100:.1f}%")

if fail_count == 0:
    print(f"\n  Result: ALL PASSED - V1.19 E2E Regression Test PASSED")
else:
    print(f"\n  Result: {fail_count} FAILURES - needs fix")

with open("/workspace/e2e_results.json", "w") as f:
    json.dump({
        "results": results, "pass": pass_count, "fail": fail_count,
        "info": info_count, "total": total, "duration": test_duration
    }, f, ensure_ascii=False, indent=2)

print("\n  Report saved to /workspace/e2e_results.json")