const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const { v4: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = 3001
const JWT_SECRET = 'epicshot-dev-secret-key-2026'
const UPLOADS_DIR = path.join(__dirname, 'uploads')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// 请求日志中间件
app.use(function(req, res, next) {
  var start = Date.now()
  var origEnd = res.end
  res.end = function() {
    var duration = Date.now() - start
    console.log(req.method + ' ' + req.originalUrl + ' ' + res.statusCode + ' ' + duration + 'ms')
    origEnd.apply(res, arguments)
  }
  next()
})

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

const db = new Database(':memory:')

db.exec(`
  CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, logo_url TEXT DEFAULT '', plan_type TEXT DEFAULT 'free', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, wechat_openid TEXT UNIQUE, workspace_id TEXT, role TEXT DEFAULT 'editor', avatar_url TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE projects (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, client_name TEXT DEFAULT '', deadline TEXT, status TEXT DEFAULT 'draft', share_token TEXT UNIQUE, share_expiry TEXT, pending_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE product_units (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0);
  CREATE TABLE images (id TEXT PRIMARY KEY, product_unit_id TEXT, original_url TEXT, thumbnail_urls TEXT DEFAULT '[]', media_type TEXT DEFAULT 'image', metadata TEXT DEFAULT '{}', uploader_id TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE annotations (id TEXT PRIMARY KEY, image_id TEXT, user_id TEXT, tool_type TEXT, coordinates TEXT DEFAULT '{}', style TEXT DEFAULT '{}', stroke_data TEXT DEFAULT '[]', text_content TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE comment_cards (id TEXT PRIMARY KEY, annotation_id TEXT, image_id TEXT, text_content TEXT DEFAULT '', status TEXT DEFAULT 'unresolved', sort_order INTEGER DEFAULT 0, resolved_by TEXT, resolved_at TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE revisions (id TEXT PRIMARY KEY, image_id TEXT, comment_card_id TEXT, uploaded_image_url TEXT, diff_summary TEXT DEFAULT '{}', created_by TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE ai_samples (id TEXT PRIMARY KEY, image_id TEXT, style TEXT, output_urls TEXT DEFAULT '[]', liked_indexes TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE ai_instructions (id TEXT PRIMARY KEY, comment_card_id TEXT, original_text TEXT, suggestion_text TEXT DEFAULT '', suggested_params TEXT DEFAULT '{}', editor_confirmed_params TEXT DEFAULT '{}', helpful INTEGER, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE timeline_events (id TEXT PRIMARY KEY, project_id TEXT, type TEXT, user_name TEXT, user_avatar TEXT DEFAULT '', description TEXT, image_id TEXT, revision_id TEXT, comment_card_id TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE portfolio (id TEXT PRIMARY KEY, project_id TEXT, cover_url TEXT DEFAULT '', images TEXT DEFAULT '[]', client_name TEXT, workspace_logo TEXT DEFAULT '', contact_info TEXT DEFAULT '', qr_code TEXT DEFAULT '', views INTEGER DEFAULT 0, avg_duration REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE api_keys (id TEXT PRIMARY KEY, workspace_id TEXT, key TEXT, secret TEXT, created_at TEXT DEFAULT (datetime('now')));
`)

// Seed data
const wsId = 'ws-001', ownerId = 'user-001', editorId = 'user-002'
db.prepare("INSERT INTO workspaces VALUES (?,?,?,?,?)").run(wsId, '素影摄影工作室', '', 'enterprise', '2026-01-15T08:00:00Z')
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)").run(ownerId, '张总监', 'zhang@epicshot.com', 'admin123', null, wsId, 'owner', '', 'active', '2026-01-15T08:00:00Z')
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)").run(editorId, '李修图', 'li@epicshot.com', 'admin123', null, wsId, 'editor', '', 'active', '2026-02-10T10:00:00Z')
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)").run('user-003', '王后期', 'wang@epicshot.com', 'admin123', null, wsId, 'editor', '', 'active', '2026-03-05T09:00:00Z')

const proj1 = 'proj-001', proj2 = 'proj-002', proj3 = 'proj-003'
db.prepare("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(proj1, wsId, '小米15系列官网主图', '小米科技', null, 'in_progress', 'share-token-001', null, 8, '2026-06-01T10:00:00Z', '2026-06-14T10:00:00Z')
db.prepare("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(proj2, wsId, '花西子口红新品', '花西子', null, 'final_review', 'share-token-002', null, 3, '2026-05-28T14:00:00Z', '2026-06-13T16:00:00Z')
db.prepare("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(proj3, wsId, '2026春季跑鞋系列', '安踏体育', null, 'completed', 'share-token-003', null, 0, '2026-05-15T09:00:00Z', '2026-06-10T09:00:00Z')

const uid1 = 'unit-001', uid2 = 'unit-002'
db.prepare("INSERT INTO product_units VALUES (?,?,?,?)").run(uid1, proj1, '主图', 1)
db.prepare("INSERT INTO product_units VALUES (?,?,?,?)").run(uid2, proj1, '细节图', 2)

const img1 = 'img-001', img2 = 'img-002'
db.prepare("INSERT INTO images VALUES (?,?,?,?,?,?,?,?)").run(img1, uid1, '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":600}', ownerId, '2026-06-01T10:00:00Z')
db.prepare("INSERT INTO images VALUES (?,?,?,?,?,?,?,?)").run(img2, uid1, '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":1200}', ownerId, '2026-06-01T10:30:00Z')

const ann1 = 'ann-001', ann2 = 'ann-002'
db.prepare("INSERT INTO annotations VALUES (?,?,?,?,?,?,?,?,?)").run(ann1, img1, ownerId, 'rectangle', '{"x":0.15,"y":0.2,"w":0.3,"h":0.25}', '{"color":"#FF0000","width":3}', '[]', '', '2026-06-05T10:00:00Z')
db.prepare("INSERT INTO annotations VALUES (?,?,?,?,?,?,?,?,?)").run(ann2, img1, ownerId, 'arrow', '{"x":0.5,"y":0.6,"w":0.15,"h":-0.2}', '{"color":"#0066FF","width":3}', '[]', '', '2026-06-05T10:05:00Z')

db.prepare("INSERT INTO comment_cards VALUES (?,?,?,?,?,?,?,?,?)").run('card-001', ann1, img1, '这个区域需要重新构图', 'resolved', 1, editorId, '2026-06-06T14:00:00Z', '2026-06-05T10:00:00Z')
db.prepare("INSERT INTO comment_cards VALUES (?,?,?,?,?,?,?,?,?)").run('card-002', ann2, img1, '箭头指向的元素请替换', 'unresolved', 2, null, null, '2026-06-05T10:05:00Z')

db.prepare("INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)").run('tl-001', proj1, 'annotation', '客户 张经理', '', '提交了 2 条批注意见', null, null, null, '2026-06-05T10:10:00Z')
db.prepare("INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)").run('tl-002', proj1, 'status_change', '张总监', '', '项目状态变更：草稿 -> 待客户确认', null, null, null, '2026-06-05T10:30:00Z')
db.prepare("INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)").run('tl-003', proj1, 'revision', '李修图', '', '上传了修改后成片', img1, null, 'card-001', '2026-06-06T14:00:00Z')
db.prepare("INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)").run('tl-004', proj1, 'confirm', '客户 张经理', '', '确认了 1 张图片', null, null, null, '2026-06-06T16:00:00Z')

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '未登录' })
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    req.userId = payload.userId
    req.userRole = payload.role
    req.workspaceId = payload.workspaceId
    next()
  } catch (e) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token 无效或已过期' })
  }
}

function ownerOnly(req, res, next) {
  if (req.userRole !== 'owner') return res.status(403).json({ code: 'FORBIDDEN', message: '仅管理员可操作' })
  next()
}

function makeToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, workspaceId: user.workspace_id }, JWT_SECRET, { expiresIn: '7d' })
}

// ============ Auth APIs ============
app.post('/v1/auth/login', function(req, res) {
  var email = req.body.email, password = req.body.password
  var user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password)
  if (!user) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' })
  res.json({ data: { token: makeToken(user), user: formatUser(user) } })
})

app.post('/v1/auth/register', function(req, res) {
  var email = req.body.email, password = req.body.password, name = req.body.name
  if (!email || !password || !name) return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少必填字段' })
  var existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ code: 'CONFLICT', message: '邮箱已被注册' })
  var wsId = uuidv4(), userId = uuidv4()
  db.prepare('INSERT INTO workspaces (id,name) VALUES (?,?)').run(wsId, name + ' 的工作空间')
  db.prepare('INSERT INTO users (id,name,email,password,workspace_id,role) VALUES (?,?,?,?,?,?)').run(userId, name, email, password, wsId, 'owner')
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  res.status(201).json({ data: { token: makeToken(user), user: formatUser(user) } })
})

app.get('/v1/users/me', authMiddleware, function(req, res) {
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' })
  res.json({ data: formatUser(user) })
})

app.get('/v1/workspaces/mine', authMiddleware, function(req, res) {
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  res.json({ data: ws ? formatWorkspace(ws) : null })
})

app.put('/v1/workspaces/mine', authMiddleware, ownerOnly, function(req, res) {
  if (req.body.name) db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(req.body.name, req.workspaceId)
  if (req.body.logo_url) db.prepare('UPDATE workspaces SET logo_url = ? WHERE id = ?').run(req.body.logo_url, req.workspaceId)
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  res.json({ data: formatWorkspace(ws) })
})

app.get('/v1/workspaces/members', authMiddleware, function(req, res) {
  var members = db.prepare('SELECT * FROM users WHERE workspace_id = ?').all(req.workspaceId)
  res.json({ data: members.map(formatUser) })
})

app.post('/v1/workspaces/invite', authMiddleware, ownerOnly, function(req, res) {
  var email = req.body.email, role = req.body.role
  var existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ code: 'CONFLICT', message: '该邮箱已注册' })
  var userId = uuidv4()
  db.prepare('INSERT INTO users (id,name,email,password,workspace_id,role) VALUES (?,?,?,?,?,?)').run(userId, email.split('@')[0], email, 'invited123', req.workspaceId, role || 'editor')
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  res.json({ data: formatUser(user) })
})

app.delete('/v1/workspaces/members/:userId', authMiddleware, ownerOnly, function(req, res) {
  db.prepare('UPDATE users SET status = ? WHERE id = ? AND workspace_id = ?').run('disabled', req.params.userId, req.workspaceId)
  res.json({ data: null })
})

app.post('/v1/workspaces/api-keys', authMiddleware, ownerOnly, function(req, res) {
  var existing = db.prepare('SELECT * FROM api_keys WHERE workspace_id = ?').get(req.workspaceId)
  if (existing) return res.status(409).json({ code: 'CONFLICT', message: '已有 API Key' })
  var key = 'epk_' + uuidv4().replace(/-/g, ''), secret = 'eps_' + uuidv4().replace(/-/g, '')
  db.prepare('INSERT INTO api_keys (id,workspace_id,key,secret) VALUES (?,?,?,?)').run(uuidv4(), req.workspaceId, key, secret)
  res.json({ data: { key: key, secret: secret } })
})

app.delete('/v1/workspaces/api-keys', authMiddleware, ownerOnly, function(req, res) {
  db.prepare('DELETE FROM api_keys WHERE workspace_id = ?').run(req.workspaceId)
  res.json({ data: null })
})

// ============ Project APIs ============
app.get('/v1/projects', authMiddleware, function(req, res) {
  var sql = 'SELECT * FROM projects WHERE workspace_id = ?', params = [req.workspaceId]
  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status) }
  if (req.query.search) { sql += ' AND (name LIKE ? OR client_name LIKE ?)'; params.push('%' + req.query.search + '%', '%' + req.query.search + '%') }
  sql += ' ORDER BY updated_at DESC'
  var rows = db.prepare(sql).all.apply(db.prepare(sql), params)
  var page = parseInt(req.query.page) || 1, pageSize = parseInt(req.query.pageSize) || 20
  var start = (page - 1) * pageSize
  res.json({ data: rows.slice(start, start + pageSize).map(formatProject), total: rows.length, page: page, pageSize: pageSize })
})

app.get('/v1/projects/:id', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })
  res.json({ data: formatProject(proj) })
})

app.post('/v1/projects', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline) VALUES (?,?,?,?,?)').run(id, req.workspaceId, req.body.name || '未命名项目', req.body.clientName || '', req.body.deadline || null)
  var proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  res.status(201).json({ data: formatProject(proj) })
})

app.put('/v1/projects/:id', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  if (req.body.status) db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, req.params.id)
  if (req.body.name) db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(req.body.name, req.params.id)
  if (req.body.clientName) db.prepare('UPDATE projects SET client_name = ? WHERE id = ?').run(req.body.clientName, req.params.id)
  var updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ data: formatProject(updated) })
})

app.delete('/v1/projects/:id', authMiddleware, function(req, res) {
  db.prepare('DELETE FROM projects WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId)
  res.json({ data: null })
})

app.post('/v1/projects/:id/share', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var token = 'share_' + uuidv4().replace(/-/g, '').slice(0, 16)
  var expiry = req.body.expiry === '7days' ? new Date(Date.now() + 7*86400000).toISOString() : req.body.expiry === '30days' ? new Date(Date.now() + 30*86400000).toISOString() : null
  db.prepare('UPDATE projects SET share_token = ?, share_expiry = ? WHERE id = ?').run(token, expiry, req.params.id)
  res.json({ data: { token: token, url: 'http://localhost:5173/client/project/' + token } })
})

app.delete('/v1/projects/:id/share', authMiddleware, function(req, res) {
  db.prepare('UPDATE projects SET share_token = NULL, share_expiry = NULL WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId)
  res.json({ data: null })
})

app.post('/v1/projects/:id/complete', authMiddleware, function(req, res) {
  db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ? AND workspace_id = ?").run('completed', req.params.id, req.workspaceId)
  db.prepare("INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)").run(uuidv4(), req.params.id, 'confirm', '系统', '项目已完成')
  res.json({ data: null })
})

// ============ Product Unit APIs ============
app.get('/v1/projects/:projectId/units', authMiddleware, function(req, res) {
  var units = db.prepare('SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId)
  res.json({ data: units.map(function(u) { return { id: u.id, projectId: u.project_id, name: u.name, sortOrder: u.sort_order } }) })
})

app.post('/v1/projects/:projectId/units', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO product_units (id,project_id,name,sort_order) VALUES (?,?,?,?)').run(id, req.params.projectId, req.body.name || '未命名单元', 99)
  var u = db.prepare('SELECT * FROM product_units WHERE id = ?').get(id)
  res.json({ data: { id: u.id, projectId: u.project_id, name: u.name, sortOrder: u.sort_order } })
})

app.put('/v1/projects/:projectId/units/reorder', authMiddleware, function(req, res) {
  if (req.body.ids) req.body.ids.forEach(function(id, i) { db.prepare('UPDATE product_units SET sort_order = ? WHERE id = ?').run(i, id) })
  res.json({ data: null })
})

// ============ Image APIs ============
app.get('/v1/units/:unitId/images', authMiddleware, function(req, res) {
  var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(req.params.unitId)
  res.json({ data: images.map(formatImage) })
})

app.get('/v1/images/:id/download', authMiddleware, function(req, res) {
  var img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: { url: img.original_url, expiresAt: new Date(Date.now() + 3600000).toISOString() } })
})

// ============ Annotation APIs ============
app.get('/v1/images/:imageId/annotations', authMiddleware, function(req, res) {
  var anns = db.prepare('SELECT * FROM annotations WHERE image_id = ?').all(req.params.imageId)
  res.json({ data: anns.map(formatAnnotation) })
})

app.post('/v1/images/:imageId/annotations', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.params.imageId, req.userId, req.body.toolType, JSON.stringify(req.body.coordinates), JSON.stringify(req.body.style), JSON.stringify(req.body.strokeData || []), req.body.text || '')
  var ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id)
  var cardId = uuidv4()
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,sort_order) VALUES (?,?,?,?,?)').run(cardId, id, req.params.imageId, req.body.text || '', Date.now())
  res.status(201).json({ data: formatAnnotation(ann) })
})

app.put('/v1/annotations/:id', authMiddleware, function(req, res) {
  if (req.body.coordinates) db.prepare('UPDATE annotations SET coordinates = ? WHERE id = ?').run(JSON.stringify(req.body.coordinates), req.params.id)
  if (req.body.style) db.prepare('UPDATE annotations SET style = ? WHERE id = ?').run(JSON.stringify(req.body.style), req.params.id)
  if (req.body.text !== undefined) db.prepare('UPDATE annotations SET text_content = ? WHERE id = ?').run(req.body.text, req.params.id)
  var ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id)
  res.json({ data: formatAnnotation(ann) })
})

app.delete('/v1/annotations/:id', authMiddleware, function(req, res) {
  db.prepare('DELETE FROM comment_cards WHERE annotation_id = ?').run(req.params.id)
  db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id)
  res.json({ data: null })
})

// ============ Comment Card APIs ============
app.get('/v1/images/:imageId/comment-cards', authMiddleware, function(req, res) {
  var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? ORDER BY sort_order').all(req.params.imageId)
  res.json({ data: cards.map(formatCommentCard) })
})

app.post('/v1/comment-cards', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,sort_order) VALUES (?,?,?,?,?)').run(id, req.body.annotationId, req.body.imageId, req.body.text || '', Date.now())
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(id)
  res.status(201).json({ data: formatCommentCard(card) })
})

app.put('/v1/comment-cards/:id', authMiddleware, function(req, res) {
  if (req.body.text !== undefined) db.prepare('UPDATE comment_cards SET text_content = ? WHERE id = ?').run(req.body.text, req.params.id)
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  res.json({ data: formatCommentCard(card) })
})

app.put('/v1/comment-cards/:id/status', authMiddleware, function(req, res) {
  var newStatus = req.body.action === 'resolve' ? 'resolved' : 'unresolved'
  db.prepare("UPDATE comment_cards SET status = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?").run(newStatus, req.body.action === 'resolve' ? req.userId : null, req.params.id)
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  res.json({ data: formatCommentCard(card) })
})

app.put('/v1/comment-cards/sort', authMiddleware, function(req, res) {
  if (req.body.ids) req.body.ids.forEach(function(id, i) { db.prepare('UPDATE comment_cards SET sort_order = ? WHERE id = ?').run(i, id) })
  res.json({ data: null })
})

// ============ Revision APIs ============
app.post('/v1/images/:id/revision', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO revisions (id,image_id,comment_card_id,uploaded_image_url,created_by) VALUES (?,?,?,?,?)').run(id, req.params.id, req.body.commentCardId || null, '/uploads/placeholder.svg', req.userId)
  var rev = db.prepare('SELECT * FROM revisions WHERE id = ?').get(id)
  db.prepare("INSERT INTO timeline_events (id,project_id,type,user_name,description,image_id,revision_id,comment_card_id) VALUES (?,?,?,?,?,?,?,?)").run(uuidv4(), 'proj-001', 'revision', '修图师', '上传了修改后成片', req.params.id, id, req.body.commentCardId)
  res.status(201).json({ data: formatRevision(rev) })
})

// ============ Timeline APIs ============
app.get('/v1/projects/:id/timeline', authMiddleware, function(req, res) {
  var events = db.prepare('SELECT * FROM timeline_events WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id)
  var nodes = events.map(function(e) {
    return {
      id: e.id, type: e.type, userAvatar: e.user_avatar, userName: e.user_name,
      description: e.description, timestamp: e.created_at,
      revision: e.revision_id ? formatRevision(db.prepare('SELECT * FROM revisions WHERE id = ?').get(e.revision_id)) : null,
      commentCard: e.comment_card_id ? formatCommentCard(db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(e.comment_card_id)) : null
    }
  })
  res.json({ data: nodes })
})

// ============ AI APIs ============
app.post('/v1/ai/style-samples', authMiddleware, function(req, res) {
  res.json({ data: { taskId: uuidv4() } })
})

app.get('/v1/ai/style-samples/:taskId', authMiddleware, function(req, res) {
  res.json({ data: { taskId: req.params.taskId, status: 'completed', progress: 100, result: null } })
})

app.post('/v1/ai/style-samples/:sampleId/like', authMiddleware, function(req, res) {
  res.json({ data: null })
})

app.post('/v1/ai/parse-instruction', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.body.commentCardId)
  var id = uuidv4()
  var suggestion = card && card.text_content ? '针对"' + card.text_content + '"的建议：请调整该区域的光影和色彩' : '暂无意见文本'
  db.prepare('INSERT INTO ai_instructions (id,comment_card_id,original_text,suggestion_text,suggested_params) VALUES (?,?,?,?,?)').run(id, req.body.commentCardId, card ? card.text_content : '', suggestion, '{"阴影":15,"曝光":0.3}')
  var inst = db.prepare('SELECT * FROM ai_instructions WHERE id = ?').get(id)
  res.json({ data: formatAIInstruction(inst) })
})

app.post('/v1/ai/instructions/:id/feedback', authMiddleware, function(req, res) {
  db.prepare('UPDATE ai_instructions SET helpful = ? WHERE id = ?').run(req.body.helpful ? 1 : 0, req.params.id)
  res.json({ data: null })
})

app.put('/v1/ai/instructions/:id/params', authMiddleware, function(req, res) {
  db.prepare('UPDATE ai_instructions SET editor_confirmed_params = ? WHERE id = ?').run(JSON.stringify(req.body.params || {}), req.params.id)
  var inst = db.prepare('SELECT * FROM ai_instructions WHERE id = ?').get(req.params.id)
  res.json({ data: formatAIInstruction(inst) })
})

app.post('/v1/ai/color-check', authMiddleware, function(req, res) {
  res.json({ data: { taskId: uuidv4() } })
})

app.get('/v1/ai/color-check/:taskId', authMiddleware, function(req, res) {
  res.json({
    data: {
      id: 'cc-001', projectId: 'proj-001', totalImages: 12, abnormalCount: 3,
      items: [
        { imageId: 'img-001', thumbnailUrl: '/uploads/placeholder.svg', deviationType: 'color_temp', deviationValue: 350, suggestion: '白平衡 -200K' },
        { imageId: 'img-002', thumbnailUrl: '/uploads/placeholder.svg', deviationType: 'brightness', deviationValue: -15, suggestion: '曝光 +0.4' },
        { imageId: 'img-003', thumbnailUrl: '/uploads/placeholder.svg', deviationType: 'contrast', deviationValue: 22, suggestion: '对比度 -12' }
      ],
      createdAt: new Date().toISOString()
    }
  })
})

// ============ Import APIs ============
app.post('/v1/import/cloud-drive', authMiddleware, function(req, res) {
  res.json({ data: { files: [{ name: '产品图', path: '/产品图', size: 0, type: 'folder' }, { name: 'IMG_001.jpg', path: '/产品图/IMG_001.jpg', size: 2048000, type: 'image' }] } })
})

app.post('/v1/import/wechat-screenshot', authMiddleware, function(req, res) {
  res.json({ data: { annotations: [{ coordinates: { x: 0.2, y: 0.3, w: 0.15, h: 0.1 }, text: '这个区域颜色不对', confidence: 0.85 }] } })
})

app.post('/v1/import/apply', authMiddleware, function(req, res) {
  res.json({ data: { taskId: uuidv4() } })
})

// ============ Portfolio APIs ============
app.post('/v1/projects/:id/portfolio', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO portfolio (id,project_id,client_name,workspace_logo,contact_info) VALUES (?,?,?,?,?)').run(id, req.params.id, '客户', '', '微信：epicshot_studio')
  res.json({ data: { taskId: id } })
})

app.get('/v1/portfolios/:id', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: formatPortfolio(p) })
})

app.put('/v1/portfolios/:id', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND' })
  if (req.body.coverUrl) db.prepare('UPDATE portfolio SET cover_url = ? WHERE id = ?').run(req.body.coverUrl, req.params.id)
  if (req.body.images) db.prepare('UPDATE portfolio SET images = ? WHERE id = ?').run(JSON.stringify(req.body.images), req.params.id)
  if (req.body.contactInfo) db.prepare('UPDATE portfolio SET contact_info = ? WHERE id = ?').run(req.body.contactInfo, req.params.id)
  var updated = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  res.json({ data: formatPortfolio(updated) })
})

app.get('/v1/portfolios/:id/stats', authMiddleware, function(req, res) {
  res.json({ data: { views: 128, avgDuration: 45.5 } })
})

// ============ Client APIs ============
app.get('/v1/client/me/projects', authMiddleware, function(req, res) {
  var projects = db.prepare('SELECT * FROM projects WHERE workspace_id = ?').all(req.workspaceId)
  res.json({ data: projects.map(formatProject), total: projects.length, page: 1, pageSize: 20 })
})

// ============ Formatters ============
function formatUser(u) {
  return { id: u.id, name: u.name, email: u.email, wechatOpenid: u.wechat_openid, workspaceId: u.workspace_id, role: u.role, avatarUrl: u.avatar_url, status: u.status, createdAt: u.created_at }
}
function formatWorkspace(ws) {
  return { id: ws.id, name: ws.name, logoUrl: ws.logo_url, planType: ws.plan_type, createdAt: ws.created_at }
}
function formatProject(p) {
  return { id: p.id, workspaceId: p.workspace_id, name: p.name, clientName: p.client_name || '', deadline: p.deadline, status: p.status, shareToken: p.share_token, shareExpiry: p.share_expiry, pendingCount: p.pending_count || 0, recentActivity: p.updated_at, createdAt: p.created_at, updatedAt: p.updated_at }
}
function formatImage(img) {
  return { id: img.id, productUnitId: img.product_unit_id, originalUrl: img.original_url, thumbnailUrls: JSON.parse(img.thumbnail_urls || '[]'), mediaType: img.media_type, metadata: JSON.parse(img.metadata || '{}'), uploaderId: img.uploader_id, createdAt: img.created_at }
}
function formatAnnotation(a) {
  return { id: a.id, imageId: a.image_id, userId: a.user_id, toolType: a.tool_type, coordinates: JSON.parse(a.coordinates || '{}'), style: JSON.parse(a.style || '{}'), strokeData: JSON.parse(a.stroke_data || '[]'), text: a.text_content, createdAt: a.created_at }
}
function formatCommentCard(c) {
  return { id: c.id, annotationId: c.annotation_id, imageId: c.image_id, text: c.text_content, status: c.status, sortOrder: c.sort_order, resolvedBy: c.resolved_by, resolvedAt: c.resolved_at, createdAt: c.created_at }
}
function formatRevision(r) {
  return { id: r.id, imageId: r.image_id, commentCardId: r.comment_card_id, uploadedImageUrl: r.uploaded_image_url, diffSummary: JSON.parse(r.diff_summary || '{}'), createdBy: r.created_by, createdAt: r.created_at }
}
function formatAIInstruction(i) {
  return { id: i.id, commentCardId: i.comment_card_id, originalText: i.original_text, suggestionText: i.suggestion_text, suggestedParams: JSON.parse(i.suggested_params || '{}'), editorConfirmedParams: JSON.parse(i.editor_confirmed_params || '{}'), helpful: i.helpful === 1 ? true : i.helpful === 0 ? false : undefined, createdAt: i.created_at }
}
function formatPortfolio(p) {
  return { id: p.id, projectId: p.project_id, coverUrl: p.cover_url, images: JSON.parse(p.images || '[]'), clientName: p.client_name, workspaceLogo: p.workspace_logo, contactInfo: p.contact_info, qrCode: p.qr_code, views: p.views, avgDuration: p.avg_duration, createdAt: p.created_at }
}

// Generate placeholder SVG
var svgLines = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
  '<rect width="800" height="600" fill="#e8eaed"/>',
  '<circle cx="400" cy="250" r="80" fill="#667eea" opacity="0.3"/>',
  '<rect x="250" y="380" width="300" height="60" rx="8" fill="#667eea" opacity="0.4"/>',
  '<text x="400" y="260" text-anchor="middle" font-family="Arial" font-size="28" fill="#5f6368">Sample Photo</text>',
  '</svg>'
]
fs.writeFileSync(path.join(UPLOADS_DIR, 'placeholder.svg'), svgLines.join('\n'))

// Start server
var serverMsg = 'EpicShot API Server running on http://localhost:' + PORT
app.listen(PORT, '0.0.0.0', function() {
  console.log(serverMsg)
  console.log('Admin account: zhang@epicshot.com / admin123')
})
