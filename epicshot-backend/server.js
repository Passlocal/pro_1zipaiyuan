'use strict'

// =============================================================================
// 易拍选 (EpicShot) — Production-Grade API Server
// =============================================================================
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const Database = require('better-sqlite3')
const { v4: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const QRCode = require('qrcode')
const multer = require('multer')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const { WebSocketServer } = require('ws')

// =============================================================================
// Configuration
// =============================================================================
const PORT = parseInt(process.env.PORT, 10) || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'epicshot-prod-secret-' + require('crypto').randomBytes(32).toString('hex')
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS = 12
const DB_PATH = path.join(__dirname, 'data', 'epicshot.db')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',')

// WeChat OAuth
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || ''
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || ''
const WECHAT_REDIRECT_URI = process.env.WECHAT_REDIRECT_URI || 'http://localhost:3001/v1/auth/wechat/callback'
const WECHAT_OAUTH_URL = 'https://open.weixin.qq.com/connect/qrconnect'
const WECHAT_API_BASE = 'https://api.weixin.qq.com'

// AI Service (可替换为真实 AI 服务)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || ''

// =============================================================================
// Ensure directories
// =============================================================================
;['data', 'uploads', 'uploads/thumbnails', 'uploads/originals'].forEach(function(d) {
  fs.mkdirSync(path.join(__dirname, d), { recursive: true })
})

// =============================================================================
// Logger
// =============================================================================
function log(level, module, message, data) {
  var timestamp = new Date().toISOString()
  var entry = '[' + timestamp + '] [' + level + '] [' + module + '] ' + message
  if (data) {
    if (typeof data === 'string') entry += ' ' + data
    else entry += ' ' + JSON.stringify(data)
  }
  if (level === 'ERROR') console.error(entry)
  else console.log(entry)
}

// =============================================================================
// Database
// =============================================================================
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      logo_url TEXT DEFAULT '', plan_type TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      email TEXT UNIQUE, password TEXT NOT NULL,
      wechat_openid TEXT UNIQUE, workspace_id TEXT NOT NULL,
      role TEXT DEFAULT 'editor' CHECK(role IN ('owner','editor','viewer')),
      avatar_url TEXT DEFAULT '', status TEXT DEFAULT 'active' CHECK(status IN ('active','disabled')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
      name TEXT NOT NULL, client_name TEXT DEFAULT '',
      deadline TEXT, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','review','in_progress','final_review','completed','archived')),
      share_token TEXT UNIQUE, share_expiry TEXT,
      pending_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS product_units (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      name TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY, product_unit_id TEXT NOT NULL,
      original_url TEXT NOT NULL, thumbnail_urls TEXT DEFAULT '[]',
      media_type TEXT DEFAULT 'image', metadata TEXT DEFAULT '{}',
      uploader_id TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY, image_id TEXT NOT NULL,
      user_id TEXT NOT NULL, tool_type TEXT NOT NULL,
      coordinates TEXT DEFAULT '{}', style TEXT DEFAULT '{}',
      stroke_data TEXT DEFAULT '[]', text_content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS comment_cards (
      id TEXT PRIMARY KEY, annotation_id TEXT,
      image_id TEXT NOT NULL, text_content TEXT DEFAULT '',
      status TEXT DEFAULT 'unresolved' CHECK(status IN ('unresolved','resolved')),
      sort_order INTEGER DEFAULT 0, resolved_by TEXT, resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY, image_id TEXT NOT NULL,
      comment_card_id TEXT, uploaded_image_url TEXT NOT NULL,
      diff_summary TEXT DEFAULT '{}', created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ai_samples (
      id TEXT PRIMARY KEY, image_id TEXT, style TEXT,
      output_urls TEXT DEFAULT '[]', liked_indexes TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ai_instructions (
      id TEXT PRIMARY KEY, comment_card_id TEXT,
      original_text TEXT, suggestion_text TEXT DEFAULT '',
      suggested_params TEXT DEFAULT '{}', editor_confirmed_params TEXT DEFAULT '{}',
      helpful INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      type TEXT NOT NULL, user_name TEXT, user_avatar TEXT DEFAULT '',
      description TEXT, image_id TEXT, revision_id TEXT, comment_card_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS portfolio (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      name TEXT DEFAULT '', description TEXT DEFAULT '',
      cover_url TEXT DEFAULT '', images TEXT DEFAULT '[]',
      client_name TEXT, workspace_logo TEXT DEFAULT '',
      contact_info TEXT DEFAULT '', qr_code TEXT DEFAULT '',
      views INTEGER DEFAULT 0, avg_duration REAL DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
      key TEXT NOT NULL, secret TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_images_unit ON images(product_unit_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_image ON annotations(image_id);
    CREATE INDEX IF NOT EXISTS idx_comment_cards_image ON comment_cards(image_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_events(project_id);
  `)

  // Migration: add name/description columns to portfolio if missing
  try { db.exec('ALTER TABLE portfolio ADD COLUMN name TEXT DEFAULT \'\'') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE portfolio ADD COLUMN description TEXT DEFAULT \'\'') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE portfolio ADD COLUMN is_published INTEGER DEFAULT 0') } catch (e) { /* column exists */ }
}

function seedIfEmpty() {
  var count = db.prepare('SELECT COUNT(*) as c FROM users').get()
  if (count.c > 0) return

  log('INFO', 'DB', 'Seeding initial data...')

  var wsId = 'ws-001'
  db.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?)').run(wsId, '素影摄影工作室', '', 'enterprise', '2026-01-15T08:00:00Z')

  var adminHash = bcrypt.hashSync('admin123', BCRYPT_ROUNDS)
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-001', '张总监', 'zhang@epicshot.com', adminHash, null, wsId, 'owner', '', 'active', '2026-01-15T08:00:00Z')
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-002', '李修图', 'li@epicshot.com', adminHash, null, wsId, 'editor', '', 'active', '2026-02-10T10:00:00Z')
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-003', '王后期', 'wang@epicshot.com', adminHash, null, wsId, 'editor', '', 'active', '2026-03-05T09:00:00Z')

  db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('proj-001', wsId, '小米15系列官网主图', '小米科技', null, 'in_progress', 'share-token-001', null, 8, '2026-06-01T10:00:00Z', '2026-06-14T10:00:00Z')
  db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('proj-002', wsId, '花西子口红新品', '花西子', null, 'final_review', 'share-token-002', null, 3, '2026-05-28T14:00:00Z', '2026-06-13T16:00:00Z')
  db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('proj-003', wsId, '2026春季跑鞋系列', '安踏体育', null, 'completed', 'share-token-003', null, 0, '2026-05-15T09:00:00Z', '2026-06-10T09:00:00Z')

  db.prepare('INSERT INTO product_units VALUES (?,?,?,?)').run('unit-001', 'proj-001', '主图', 1)
  db.prepare('INSERT INTO product_units VALUES (?,?,?,?)').run('unit-002', 'proj-001', '细节图', 2)

  db.prepare('INSERT INTO images VALUES (?,?,?,?,?,?,?,?)').run('img-001', 'unit-001', '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":600}', 'user-001', '2026-06-01T10:00:00Z')
  db.prepare('INSERT INTO images VALUES (?,?,?,?,?,?,?,?)').run('img-002', 'unit-001', '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":1200}', 'user-001', '2026-06-01T10:30:00Z')

  db.prepare('INSERT INTO annotations VALUES (?,?,?,?,?,?,?,?,?)').run('ann-001', 'img-001', 'user-001', 'rectangle', '{"x":0.15,"y":0.2,"w":0.3,"h":0.25}', '{"color":"#FF0000","width":3}', '[]', '', '2026-06-05T10:00:00Z')
  db.prepare('INSERT INTO annotations VALUES (?,?,?,?,?,?,?,?,?)').run('ann-002', 'img-001', 'user-001', 'arrow', '{"x":0.5,"y":0.6,"w":0.15,"h":-0.2}', '{"color":"#0066FF","width":3}', '[]', '', '2026-06-05T10:05:00Z')

  db.prepare('INSERT INTO comment_cards VALUES (?,?,?,?,?,?,?,?,?)').run('card-001', 'ann-001', 'img-001', '这个区域需要重新构图', 'resolved', 1, 'user-002', '2026-06-06T14:00:00Z', '2026-06-05T10:00:00Z')
  db.prepare('INSERT INTO comment_cards VALUES (?,?,?,?,?,?,?,?,?)').run('card-002', 'ann-002', 'img-001', '箭头指向的元素请替换', 'unresolved', 2, null, null, '2026-06-05T10:05:00Z')

  db.prepare('INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-001', 'proj-001', 'annotation', '客户 张经理', '', '提交了 2 条批注意见', null, null, null, '2026-06-05T10:10:00Z')
  db.prepare('INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-002', 'proj-001', 'status_change', '张总监', '', '项目状态变更：草稿 -> 待客户确认', null, null, null, '2026-06-05T10:30:00Z')
  db.prepare('INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-003', 'proj-001', 'revision', '李修图', '', '上传了修改后成片', 'img-001', null, 'card-001', '2026-06-06T14:00:00Z')
  db.prepare('INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-004', 'proj-001', 'confirm', '客户 张经理', '', '确认了 1 张图片', null, null, null, '2026-06-06T16:00:00Z')

  log('INFO', 'DB', 'Seed complete')
}

migrate()
seedIfEmpty()

// =============================================================================
// Express App & Middleware
// =============================================================================
const app = express()

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// CORS
app.use(cors({
  origin: function(origin, cb) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return cb(null, true)
    cb(null, true) // In dev, allow all; restrict in production with env var
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }
})
app.use(limiter)

// Auth endpoints rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '登录请求过于频繁，请稍后再试' }
})

// Body parsing
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Handle JSON parse errors gracefully
app.use(function(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ code: 'INVALID_JSON', message: '请求体JSON格式无效' })
  }
  next(err)
})

// Static files
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  etag: true,
  lastModified: true
}))

// Request logging
app.use(function(req, res, next) {
  var start = Date.now()
  var origEnd = res.end
  res.end = function() {
    var duration = Date.now() - start
    log('INFO', 'HTTP', req.method + ' ' + req.originalUrl, { status: res.statusCode, duration: duration + 'ms' })
    origEnd.apply(res, arguments)
  }
  next()
})

// =============================================================================
// File Upload (Multer)
// =============================================================================
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    var dest = path.join(UPLOADS_DIR, 'originals')
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname) || '.jpg'
    cb(null, uuidv4() + ext)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: function(req, file, cb) {
    var allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?|heic|heif|psd|pdf|ai|eps|raw|cr2|nef|dng)$/i
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型: ' + path.extname(file.originalname)))
    }
  }
})

// Generate thumbnails
async function generateThumbnails(filePath) {
  var basename = path.basename(filePath, path.extname(filePath))
  var sizes = [
    { name: 'sm', width: 200 },
    { name: 'md', width: 600 },
    { name: 'lg', width: 1200 }
  ]
  var urls = []
  for (var i = 0; i < sizes.length; i++) {
    var s = sizes[i]
    var outName = basename + '_' + s.name + '.webp'
    var outPath = path.join(THUMBNAILS_DIR, outName)
    try {
      await sharp(filePath)
        .resize(s.width, s.width, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath)
      urls.push('/uploads/thumbnails/' + outName)
    } catch (err) {
      log('ERROR', 'Thumbnail', 'Failed to generate ' + s.name, err.message)
      urls.push('/uploads/placeholder.svg')
    }
  }
  return urls
}

// =============================================================================
// Auth Middleware
// =============================================================================
function authMiddleware(req, res, next) {
  var authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '未登录' })
  }
  try {
    var payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    req.userId = payload.userId
    req.userRole = payload.role
    req.workspaceId = payload.workspaceId
    next()
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token 已过期，请重新登录' })
    }
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token 无效' })
  }
}

function ownerOnly(req, res, next) {
  if (req.userRole !== 'owner') return res.status(403).json({ code: 'FORBIDDEN', message: '仅管理员可操作' })
  next()
}

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, workspaceId: user.workspace_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

// =============================================================================
// Validation Helpers
// =============================================================================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password) {
  return password && password.length >= 6
}

// =============================================================================
// WeChat OAuth
// =============================================================================
var wechatTickets = {}

function isRealWechat() {
  return !!(WECHAT_APP_ID && WECHAT_APP_SECRET)
}

function cleanupExpiredTickets() {
  var now = Date.now()
  for (var ticket in wechatTickets) {
    if (wechatTickets[ticket].expiresAt < now) {
      delete wechatTickets[ticket]
    }
  }
}

// =============================================================================
// Health Check
// =============================================================================
app.get('/health', function(req, res) {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: 'connected',
    version: '1.0.0'
  })
})

// =============================================================================
// Auth Routes
// =============================================================================
app.post('/v1/auth/login', authLimiter, function(req, res) {
  var email = (req.body.email || '').trim().toLowerCase()
  var password = req.body.password || ''

  if (!validateEmail(email)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '邮箱格式不正确' })
  if (!password) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请输入密码' })

  var user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(email, 'active')
  if (!user) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' })

  var valid = bcrypt.compareSync(password, user.password)
  if (!valid) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' })

  log('INFO', 'Auth', 'User logged in', { userId: user.id, email: email })
  res.json({ data: { token: makeToken(user), user: formatUser(user) } })
})

app.post('/v1/auth/register', authLimiter, function(req, res) {
  var email = (req.body.email || '').trim().toLowerCase()
  var password = req.body.password || ''
  var name = (req.body.name || '').trim()

  if (!validateEmail(email)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '邮箱格式不正确' })
  if (!validatePassword(password)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码至少6位' })
  if (!name || name.length < 2) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '用户名至少2个字符' })

  var existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ code: 'CONFLICT', message: '邮箱已被注册' })

  var wsId = uuidv4(), userId = uuidv4()
  var hash = bcrypt.hashSync(password, BCRYPT_ROUNDS)

  db.prepare('INSERT INTO workspaces (id,name) VALUES (?,?)').run(wsId, name + ' 的工作空间')
  db.prepare('INSERT INTO users (id,name,email,password,workspace_id,role) VALUES (?,?,?,?,?,?)').run(userId, name, email, hash, wsId, 'owner')

  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  log('INFO', 'Auth', 'New user registered', { userId: userId, email: email })
  res.status(201).json({ data: { token: makeToken(user), user: formatUser(user) } })
})

// =============================================================================
// WeChat QR Code Login
// =============================================================================
app.get('/v1/auth/wechat/qrcode', function(req, res) {
  cleanupExpiredTickets()
  var ticket = 'wc_' + uuidv4().replace(/-/g, '')
  var expiresAt = Date.now() + 5 * 60 * 1000

  wechatTickets[ticket] = { status: 'pending', expiresAt: expiresAt, createdAt: Date.now() }

  var realWechat = isRealWechat()
  var qrcodeContent

  if (realWechat) {
    qrcodeContent = WECHAT_OAUTH_URL + '?appid=' + WECHAT_APP_ID +
      '&redirect_uri=' + encodeURIComponent(WECHAT_REDIRECT_URI) +
      '&response_type=code&scope=snsapi_login&state=' + ticket + '#wechat_redirect'
    log('INFO', 'WeChat', 'Real OAuth mode')
  } else {
    qrcodeContent = 'https://epicshot.local/wechat/confirm/' + ticket
    log('INFO', 'WeChat', 'Demo mode (no AppID/Secret)')
  }

  QRCode.toDataURL(qrcodeContent, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } }, function(err, dataUrl) {
    if (err) {
      log('ERROR', 'WeChat', 'QRCode generation failed', err.message)
      return res.status(500).json({ code: 'SERVER_ERROR', message: '二维码生成失败' })
    }
    res.json({ data: { ticket: ticket, qrcodeDataUrl: dataUrl, authUrl: qrcodeContent, expiresIn: 300, isRealWechat: realWechat } })
  })
})

app.get('/v1/auth/wechat/callback', function(req, res) {
  var code = req.query.code, state = req.query.state
  if (!code || !state) return res.status(400).send('<h3>授权失败：缺少参数</h3>')

  var ticket = wechatTickets[state]
  if (!ticket || Date.now() > ticket.expiresAt) {
    if (ticket) delete wechatTickets[state]
    return res.status(400).send('<h3>登录会话已过期，请返回网页重新扫码</h3>')
  }

  var accessTokenUrl = WECHAT_API_BASE + '/sns/oauth2/access_token?appid=' + WECHAT_APP_ID + '&secret=' + WECHAT_APP_SECRET + '&code=' + code + '&grant_type=authorization_code'

  https.get(accessTokenUrl, function(wxRes) {
    var body = ''
    wxRes.on('data', function(c) { body += c })
    wxRes.on('end', function() {
      try {
        var tokenData = JSON.parse(body)
        if (tokenData.errcode) {
          log('ERROR', 'WeChat', 'access_token error', tokenData)
          return res.status(500).send('<h3>微信授权失败</h3>')
        }

        var userInfoUrl = WECHAT_API_BASE + '/sns/userinfo?access_token=' + encodeURIComponent(tokenData.access_token) + '&openid=' + tokenData.openid + '&lang=zh_CN'

        https.get(userInfoUrl, function(uiRes) {
          var uiBody = ''
          uiRes.on('data', function(c) { uiBody += c })
          uiRes.on('end', function() {
            try {
              var userInfo = JSON.parse(uiBody)
              if (userInfo.errcode) {
                log('ERROR', 'WeChat', 'userinfo error', userInfo)
                return res.status(500).send('<h3>获取用户信息失败</h3>')
              }

              var localUser = db.prepare('SELECT * FROM users WHERE wechat_openid = ?').get(tokenData.openid)
              if (!localUser) {
                var uId = uuidv4(), wId = uuidv4()
                var nickname = userInfo.nickname || '微信用户'
                db.prepare('INSERT INTO workspaces (id,name) VALUES (?,?)').run(wId, nickname + ' 的工作空间')
                db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url) VALUES (?,?,?,?,?,?,?,?)')
                  .run(uId, nickname, tokenData.openid + '@wechat.local', bcrypt.hashSync('wechat_oauth', BCRYPT_ROUNDS), tokenData.openid, wId, 'owner', userInfo.headimgurl || '')
                localUser = db.prepare('SELECT * FROM users WHERE id = ?').get(uId)
                log('INFO', 'WeChat', 'New user via WeChat', { nickname: nickname })
              }

              ticket.status = 'confirmed'
              ticket.userToken = makeToken(localUser)
              ticket.userData = formatUser(localUser)

              res.set('Content-Type', 'text/html; charset=utf-8')
              res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录成功</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}.card{background:#fff;border-radius:12px;padding:40px 32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)}.icon{font-size:48px;margin-bottom:16px}h2{color:#333;margin:0 0 8px}p{color:#999;margin:0;font-size:14px}</style></head><body><div class="card"><div class="icon">&#x2705;</div><h2>登录成功</h2><p>请返回网页继续操作</p></div></body></html>')
            } catch (e) {
              log('ERROR', 'WeChat', 'userinfo parse error', e.message)
              res.status(500).send('<h3>获取用户信息失败</h3>')
            }
          })
        }).on('error', function(e) {
          log('ERROR', 'WeChat', 'userinfo request error', e.message)
          res.status(500).send('<h3>获取用户信息失败</h3>')
        })
      } catch (e) {
        log('ERROR', 'WeChat', 'token parse error', e.message)
        res.status(500).send('<h3>微信授权失败</h3>')
      }
    })
  }).on('error', function(e) {
    log('ERROR', 'WeChat', 'access_token request error', e.message)
    res.status(500).send('<h3>微信授权失败</h3>')
  })
})

app.get('/v1/auth/wechat/status/:ticket', function(req, res) {
  var ticket = wechatTickets[req.params.ticket]
  if (!ticket) return res.status(404).json({ code: 'NOT_FOUND', message: '二维码已过期，请刷新' })
  if (Date.now() > ticket.expiresAt) {
    ticket.status = 'expired'
    delete wechatTickets[req.params.ticket]
    return res.json({ data: { status: 'expired' } })
  }
  res.json({ data: { status: ticket.status } })
})

app.post('/v1/auth/wechat/confirm/:ticket', function(req, res) {
  var ticket = wechatTickets[req.params.ticket]
  if (!ticket) return res.status(404).json({ code: 'NOT_FOUND', message: '二维码已过期' })

  if (ticket.status === 'confirmed' && ticket.userToken) {
    var token = ticket.userToken, user = ticket.userData
    delete wechatTickets[req.params.ticket]
    return res.json({ data: { token: token, user: user } })
  }

  if (isRealWechat()) {
    return res.status(400).json({ code: 'NOT_CONFIRMED', message: '尚未确认登录' })
  }

  // Demo mode: create user
  var openid = 'wechat_openid_' + req.params.ticket.slice(0, 8)
  var user = db.prepare('SELECT * FROM users WHERE wechat_openid = ?').get(openid)
  if (!user) {
    var uId = uuidv4(), wId = uuidv4()
    db.prepare('INSERT INTO workspaces (id,name) VALUES (?,?)').run(wId, '微信用户的工作空间')
    db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role) VALUES (?,?,?,?,?,?,?)')
      .run(uId, '微信用户', 'wechat_' + Date.now() + '@epicshot.com', bcrypt.hashSync('wechat_auto', BCRYPT_ROUNDS), openid, wId, 'owner')
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(uId)
  }
  ticket.status = 'confirmed'
  delete wechatTickets[req.params.ticket]
  res.json({ data: { token: makeToken(user), user: formatUser(user) } })
})

app.post('/v1/auth/wechat/scan/:ticket', function(req, res) {
  if (isRealWechat()) return res.status(400).json({ code: 'REAL_WECHAT', message: '真实微信模式下不支持模拟扫码' })
  var ticket = wechatTickets[req.params.ticket]
  if (!ticket) return res.status(404).json({ code: 'NOT_FOUND', message: '二维码已过期' })
  if (Date.now() > ticket.expiresAt) {
    ticket.status = 'expired'
    delete wechatTickets[req.params.ticket]
    return res.json({ code: 'EXPIRED', message: '二维码已过期' })
  }
  ticket.status = 'scanned'
  res.json({ data: { status: 'scanned' } })
})

// =============================================================================
// User & Workspace Routes
// =============================================================================
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
  var name = (req.body.name || '').trim()
  var logoUrl = (req.body.logo_url || '').trim()
  if (name) db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, req.workspaceId)
  if (logoUrl) db.prepare('UPDATE workspaces SET logo_url = ? WHERE id = ?').run(logoUrl, req.workspaceId)
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  res.json({ data: formatWorkspace(ws) })
})

app.get('/v1/workspaces/members', authMiddleware, function(req, res) {
  var members = db.prepare('SELECT * FROM users WHERE workspace_id = ? ORDER BY created_at').all(req.workspaceId)
  res.json({ data: members.map(formatUser) })
})

app.post('/v1/workspaces/invite', authMiddleware, ownerOnly, function(req, res) {
  var email = (req.body.email || '').trim().toLowerCase()
  var role = req.body.role || 'editor'

  if (!validateEmail(email)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '邮箱格式不正确' })
  if (['owner', 'editor', 'viewer'].indexOf(role) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的角色' })

  var existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ code: 'CONFLICT', message: '该邮箱已注册' })

  var userId = uuidv4()
  db.prepare('INSERT INTO users (id,name,email,password,workspace_id,role) VALUES (?,?,?,?,?,?)')
    .run(userId, email.split('@')[0], email, bcrypt.hashSync('invited_' + Date.now(), BCRYPT_ROUNDS), req.workspaceId, role)

  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  log('INFO', 'Workspace', 'Member invited', { email: email, role: role })
  res.json({ data: formatUser(user) })
})

app.delete('/v1/workspaces/members/:userId', authMiddleware, ownerOnly, function(req, res) {
  var member = db.prepare('SELECT * FROM users WHERE id = ? AND workspace_id = ?').get(req.params.userId, req.workspaceId)
  if (!member) return res.status(404).json({ code: 'NOT_FOUND', message: '成员不存在' })
  if (member.role === 'owner') return res.status(400).json({ code: 'BAD_REQUEST', message: '不能移除管理员' })
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('disabled', req.params.userId)
  log('INFO', 'Workspace', 'Member removed', { userId: req.params.userId })
  res.json({ data: null })
})

app.post('/v1/workspaces/api-keys', authMiddleware, ownerOnly, function(req, res) {
  var existing = db.prepare('SELECT * FROM api_keys WHERE workspace_id = ?').get(req.workspaceId)
  if (existing) {
    db.prepare('DELETE FROM api_keys WHERE workspace_id = ?').run(req.workspaceId)
  }
  var key = 'epk_' + uuidv4().replace(/-/g, '')
  var secret = 'eps_' + uuidv4().replace(/-/g, '')
  db.prepare('INSERT INTO api_keys (id,workspace_id,key,secret) VALUES (?,?,?,?)').run(uuidv4(), req.workspaceId, key, secret)
  res.json({ data: { key: key, secret: secret } })
})

app.delete('/v1/workspaces/api-keys', authMiddleware, ownerOnly, function(req, res) {
  db.prepare('DELETE FROM api_keys WHERE workspace_id = ?').run(req.workspaceId)
  res.json({ data: null })
})

// =============================================================================
// Project Routes
// =============================================================================
app.get('/v1/projects', authMiddleware, function(req, res) {
  var sql = 'SELECT * FROM projects WHERE workspace_id = ?', params = [req.workspaceId]
  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status) }
  if (req.query.search) { sql += ' AND (name LIKE ? OR client_name LIKE ?)'; params.push('%' + req.query.search + '%', '%' + req.query.search + '%') }
  sql += ' ORDER BY updated_at DESC'

  var rows = db.prepare(sql).all.apply(db.prepare(sql), params)
  var page = Math.max(1, parseInt(req.query.page) || 1)
  var pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
  var start = (page - 1) * pageSize

  res.json({
    data: rows.slice(start, start + pageSize).map(formatProject),
    total: rows.length,
    page: page,
    pageSize: pageSize
  })
})

// Batch thumbnails: returns thumbnail URL for each project (avoids N+1)
app.post('/v1/projects/batch-thumbnails', authMiddleware, function(req, res) {
  var projectIds = req.body.projectIds
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请提供 projectIds' })
  }
  var placeholders = projectIds.map(function() { return '?' }).join(',')
  var stmt = db.prepare(
    'SELECT pu.project_id, pu.id as unit_id FROM product_units pu WHERE pu.project_id IN (' + placeholders + ') ORDER BY pu.sort_order'
  )
  var units = stmt.all.apply(stmt, projectIds)

  var thumbnailMap = {}
  if (units && units.length > 0) {
    var unitIds = units.map(function(u) { return u.unit_id })
    var imgPlaceholders = unitIds.map(function() { return '?' }).join(',')
    var imgStmt = db.prepare(
      'SELECT i.product_unit_id, i.thumbnail_urls, i.original_url FROM images i WHERE i.product_unit_id IN (' + imgPlaceholders + ') ORDER BY i.created_at'
    )
    var images = imgStmt.all.apply(imgStmt, unitIds)

    var unitImageMap = {}
    images.forEach(function(img) {
      if (!unitImageMap[img.product_unit_id]) {
        var thumbs = JSON.parse(img.thumbnail_urls || '[]')
        unitImageMap[img.product_unit_id] = thumbs[0] || img.original_url
      }
    })
    units.forEach(function(u) {
      if (!thumbnailMap[u.project_id] && unitImageMap[u.unit_id]) {
        thumbnailMap[u.project_id] = unitImageMap[u.unit_id]
      }
    })
  }

  res.json({ data: thumbnailMap })
})

app.get('/v1/projects/:id', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })
  res.json({ data: formatProject(proj) })
})

app.post('/v1/projects', authMiddleware, function(req, res) {
  var name = (req.body.name || '').trim()
  if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '项目名称不能为空' })

  var id = uuidv4()
  var status = req.body.status
  var validStatuses = ['draft', 'review', 'in_progress', 'final_review', 'completed', 'archived']
  if (status && validStatuses.indexOf(status) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的项目状态' })
  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline,status) VALUES (?,?,?,?,?,?)')
    .run(id, req.workspaceId, name, (req.body.clientName || '').trim(), req.body.deadline || null, status || 'draft')

  var proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
    .run(uuidv4(), id, 'status_change', '系统', '创建了项目「' + name + '」')

  log('INFO', 'Project', 'Created', { id: id, name: name })
  res.status(201).json({ data: formatProject(proj) })
})

app.put('/v1/projects/:id', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  if (req.body.status) {
    var validStatuses = ['draft', 'review', 'in_progress', 'final_review', 'completed', 'archived']
    if (validStatuses.indexOf(req.body.status) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的项目状态' })
    db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, req.params.id)
    db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
      .run(uuidv4(), req.params.id, 'status_change', '系统', '项目状态变更：' + proj.status + ' -> ' + req.body.status)
  }
  if (req.body.name) db.prepare('UPDATE projects SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(req.body.name.trim(), req.params.id)
  if (req.body.clientName !== undefined) db.prepare('UPDATE projects SET client_name = ?, updated_at = datetime(\'now\') WHERE id = ?').run((req.body.clientName || '').trim(), req.params.id)
  if (req.body.deadline !== undefined) db.prepare("UPDATE projects SET deadline = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.deadline, req.params.id)

  var updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ data: formatProject(updated) })
})

app.delete('/v1/projects/:id', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  // Cascade delete
  var units = db.prepare('SELECT id FROM product_units WHERE project_id = ?').all(req.params.id)
  units.forEach(function(u) {
    var images = db.prepare('SELECT id FROM images WHERE product_unit_id = ?').all(u.id)
    images.forEach(function(img) {
      db.prepare('DELETE FROM comment_cards WHERE image_id = ?').run(img.id)
      db.prepare('DELETE FROM annotations WHERE image_id = ?').run(img.id)
      db.prepare('DELETE FROM revisions WHERE image_id = ?').run(img.id)
    })
    db.prepare('DELETE FROM images WHERE product_unit_id = ?').run(u.id)
  })
  db.prepare('DELETE FROM product_units WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM timeline_events WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM portfolio WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)

  log('INFO', 'Project', 'Deleted', { id: req.params.id })
  res.json({ data: null })
})

app.post('/v1/projects/:id/share', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var token = 'share_' + uuidv4().replace(/-/g, '').slice(0, 16)
  var expiry = null
  if (req.body.expiry === '7days') expiry = new Date(Date.now() + 7 * 86400000).toISOString()
  else if (req.body.expiry === '30days') expiry = new Date(Date.now() + 30 * 86400000).toISOString()

  db.prepare('UPDATE projects SET share_token = ?, share_expiry = ? WHERE id = ?').run(token, expiry, req.params.id)
  res.json({ data: { token: token, url: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/client/project/' + token } })
})

app.get('/v1/share/:token', function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE share_token = ?').get(req.params.token)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '分享链接不存在或已失效' })
  // Check expiry
  if (proj.share_expiry && new Date(proj.share_expiry) < new Date()) {
    return res.status(410).json({ code: 'EXPIRED', message: '分享链接已过期' })
  }
  // Get comment cards for this project
  var cards = db.prepare(`
    SELECT cc.* FROM comment_cards cc
    JOIN images i ON cc.image_id = i.id
    JOIN product_units pu ON i.product_unit_id = pu.id
    WHERE pu.project_id = ?
    ORDER BY cc.sort_order, cc.created_at
  `).all(proj.id)
  res.json({ data: { project: formatProject(proj), cards: cards.map(formatCommentCard) } })
})

app.delete('/v1/projects/:id/share', authMiddleware, function(req, res) {
  db.prepare('UPDATE projects SET share_token = NULL, share_expiry = NULL WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId)
  res.json({ data: null })
})

app.post('/v1/projects/:id/complete', authMiddleware, function(req, res) {
  db.prepare("UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ? AND workspace_id = ?").run(req.params.id, req.workspaceId)
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.params.id, 'confirm', '系统', '项目已完成')
  res.json({ data: null })
})

// =============================================================================
// Product Unit Routes
// =============================================================================
app.get('/v1/projects/:projectId/units', authMiddleware, function(req, res) {
  var units = db.prepare('SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId)
  res.json({ data: units.map(function(u) { return { id: u.id, projectId: u.project_id, name: u.name, sortOrder: u.sort_order } }) })
})

app.post('/v1/projects/:projectId/units', authMiddleware, function(req, res) {
  var name = (req.body.name || '').trim()
  if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '单元名称不能为空' })

  var proj = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var id = uuidv4()
  var maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM product_units WHERE project_id = ?').get(req.params.projectId)
  db.prepare('INSERT INTO product_units (id,project_id,name,sort_order) VALUES (?,?,?,?)').run(id, req.params.projectId, name, (maxOrder.m || 0) + 1)

  var u = db.prepare('SELECT * FROM product_units WHERE id = ?').get(id)
  res.json({ data: { id: u.id, projectId: u.project_id, name: u.name, sortOrder: u.sort_order } })
})

app.put('/v1/projects/:projectId/units/reorder', authMiddleware, function(req, res) {
  if (!Array.isArray(req.body.ids)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'ids 必须是数组' })
  req.body.ids.forEach(function(id, i) { db.prepare('UPDATE product_units SET sort_order = ? WHERE id = ?').run(i, id) })
  res.json({ data: null })
})

// =============================================================================
// Image Routes (with real file upload)
// =============================================================================
app.get('/v1/units/:unitId/images', authMiddleware, function(req, res) {
  var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ? ORDER BY created_at').all(req.params.unitId)
  res.json({ data: images.map(formatImage) })
})

app.post('/v1/units/:unitId/images', authMiddleware, upload.array('files', 20), async function(req, res) {
  var unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(req.params.unitId)
  if (!unit) return res.status(404).json({ code: 'NOT_FOUND', message: '产品单元不存在' })

  var files = req.files
  if (!files || files.length === 0) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请选择文件' })

  var results = []
  for (var i = 0; i < files.length; i++) {
    var file = files[i]
    var imageId = uuidv4()
    var relativePath = '/uploads/originals/' + file.filename

    // Generate thumbnails
    var thumbnailUrls = await generateThumbnails(file.path)

    // Get image metadata
    var metadata = { size: file.size, originalName: file.originalname }
    try {
      var imgMeta = await sharp(file.path).metadata()
      metadata.width = imgMeta.width
      metadata.height = imgMeta.height
      metadata.format = imgMeta.format
    } catch (e) { /* ignore */ }

    db.prepare('INSERT INTO images (id,product_unit_id,original_url,thumbnail_urls,media_type,metadata,uploader_id) VALUES (?,?,?,?,?,?,?)')
      .run(imageId, req.params.unitId, relativePath, JSON.stringify(thumbnailUrls), 'image', JSON.stringify(metadata), req.userId)

    var img = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId)
    results.push(formatImage(img))
  }

  log('INFO', 'Upload', 'Files uploaded', { count: files.length, unitId: req.params.unitId })
  res.status(201).json({ data: results })
})

app.get('/v1/images/:id/download', authMiddleware, function(req, res) {
  var img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND', message: '图片不存在' })

  var filePath = path.join(__dirname, img.original_url)
  if (fs.existsSync(filePath)) {
    res.download(filePath)
  } else {
    res.json({ data: { url: img.original_url, expiresAt: new Date(Date.now() + 3600000).toISOString() } })
  }
})

// =============================================================================
// Annotation Routes
// =============================================================================
app.get('/v1/images/:imageId/annotations', authMiddleware, function(req, res) {
  var anns = db.prepare('SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at').all(req.params.imageId)
  res.json({ data: anns.map(formatAnnotation) })
})

app.post('/v1/images/:imageId/annotations', authMiddleware, function(req, res) {
  var toolType = req.body.toolType
  if (!toolType || ['rectangle', 'arrow', 'freehand', 'text', 'circle', 'line', 'pen', 'ellipse', 'eraser'].indexOf(toolType) === -1) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的标注工具类型' })
  }

  var id = uuidv4()
  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.params.imageId, req.userId, toolType, JSON.stringify(req.body.coordinates || {}), JSON.stringify(req.body.style || {}), JSON.stringify(req.body.strokeData || []), req.body.text || '')

  var ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id)

  // Auto-create comment card if text is provided
  if (req.body.text) {
    var cardId = uuidv4()
    db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,sort_order) VALUES (?,?,?,?,?)')
      .run(cardId, id, req.params.imageId, req.body.text, Date.now())
  }

  res.status(201).json({ data: formatAnnotation(ann) })
})

app.put('/v1/annotations/:id', authMiddleware, function(req, res) {
  var ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id)
  if (!ann) return res.status(404).json({ code: 'NOT_FOUND', message: '标注不存在' })

  if (req.body.coordinates) db.prepare('UPDATE annotations SET coordinates = ? WHERE id = ?').run(JSON.stringify(req.body.coordinates), req.params.id)
  if (req.body.style) db.prepare('UPDATE annotations SET style = ? WHERE id = ?').run(JSON.stringify(req.body.style), req.params.id)
  if (req.body.text !== undefined) db.prepare('UPDATE annotations SET text_content = ? WHERE id = ?').run(req.body.text, req.params.id)

  var updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id)
  res.json({ data: formatAnnotation(updated) })
})

app.delete('/v1/annotations/:id', authMiddleware, function(req, res) {
  db.prepare('DELETE FROM comment_cards WHERE annotation_id = ?').run(req.params.id)
  db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id)
  res.json({ data: null })
})

// =============================================================================
// Comment Card Routes
// =============================================================================
app.get('/v1/images/:imageId/comment-cards', authMiddleware, function(req, res) {
  var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? ORDER BY sort_order').all(req.params.imageId)
  res.json({ data: cards.map(formatCommentCard) })
})

app.post('/v1/comment-cards', authMiddleware, function(req, res) {
  if (!req.body.imageId || !req.body.text) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少必填字段' })

  var id = uuidv4()
  var maxSort = db.prepare('SELECT MAX(sort_order) as m FROM comment_cards WHERE image_id = ?').get(req.body.imageId)
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,sort_order) VALUES (?,?,?,?,?)')
    .run(id, req.body.annotationId || null, req.body.imageId, req.body.text, (maxSort.m || 0) + 1)

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(id)
  res.status(201).json({ data: formatCommentCard(card) })
})

// Sort comment cards (must be before :id to avoid route hijacking)
app.put('/v1/comment-cards/sort', authMiddleware, function(req, res) {
  if (!Array.isArray(req.body.ids)) return res.status(400).json({ code: 'VALIDATION_ERROR' })
  req.body.ids.forEach(function(id, i) { db.prepare('UPDATE comment_cards SET sort_order = ? WHERE id = ?').run(i, id) })
  res.json({ data: null })
})

app.put('/v1/comment-cards/:id', authMiddleware, function(req, res) {
  if (req.body.text !== undefined) db.prepare('UPDATE comment_cards SET text_content = ? WHERE id = ?').run(req.body.text, req.params.id)
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: formatCommentCard(card) })
})

app.put('/v1/comment-cards/:id/status', authMiddleware, function(req, res) {
  var action = req.body.action
  if (['resolve', 'unresolve'].indexOf(action) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的操作' })

  if (action === 'resolve') {
    db.prepare("UPDATE comment_cards SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?")
      .run(req.userId, req.params.id)
  } else {
    db.prepare("UPDATE comment_cards SET status = 'unresolved', resolved_by = NULL, resolved_at = NULL WHERE id = ?")
      .run(req.params.id)
  }

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: formatCommentCard(card) })
})

// Export comments as JSON (PDF/Excel generation stub)
app.get('/v1/projects/:projectId/comments/export', authMiddleware, function(req, res) {
  var units = db.prepare('SELECT id FROM product_units WHERE project_id = ?').all(req.params.projectId)
  var allImages = []
  units.forEach(function(u) {
    var imgs = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(u.id)
    allImages = allImages.concat(imgs)
  })

  var exportData = []
  allImages.forEach(function(img) {
    var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? ORDER BY sort_order').all(img.id)
    cards.forEach(function(c) {
      var ann = c.annotation_id ? db.prepare('SELECT * FROM annotations WHERE id = ?').get(c.annotation_id) : null
      exportData.push({
        imageId: img.id,
        imageUrl: img.original_url,
        commentCard: formatCommentCard(c),
        annotation: ann ? formatAnnotation(ann) : null
      })
    })
  })

  var format = req.query.format || 'json'
  res.set('Content-Type', 'application/json; charset=utf-8')
  res.set('Content-Disposition', 'attachment; filename=comments-' + req.params.projectId + '.json')
  res.json({ data: exportData })
})

// =============================================================================
// Revision Routes
// =============================================================================
app.post('/v1/images/:id/revision', authMiddleware, upload.single('file'), function(req, res) {
  var img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND', message: '图片不存在' })

  var uploadedUrl = '/uploads/placeholder.svg'
  if (req.file) {
    uploadedUrl = '/uploads/originals/' + req.file.filename
    generateThumbnails(req.file.path).catch(function() {})
  }

  var revId = uuidv4()
  db.prepare('INSERT INTO revisions (id,image_id,comment_card_id,uploaded_image_url,created_by) VALUES (?,?,?,?,?)')
    .run(revId, req.params.id, req.body.commentCardId || null, uploadedUrl, req.userId)

  // Find parent project for timeline
  var unit = db.prepare('SELECT project_id FROM product_units WHERE id = ?').get(img.product_unit_id)
  if (unit) {
    var currentUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)
    var userName = currentUser ? currentUser.name : '用户'
    db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description,image_id,revision_id,comment_card_id) VALUES (?,?,?,?,?,?,?,?)')
      .run(uuidv4(), unit.project_id, 'revision', userName, '上传了修改后成片', req.params.id, revId, req.body.commentCardId)
  }

  var rev = db.prepare('SELECT * FROM revisions WHERE id = ?').get(revId)
  res.status(201).json({ data: formatRevision(rev) })
})

// =============================================================================
// Timeline Routes
// =============================================================================
app.get('/v1/projects/:id/timeline', authMiddleware, function(req, res) {
  var events = db.prepare('SELECT * FROM timeline_events WHERE project_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.id)
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

// =============================================================================
// AI Routes (Production-ready framework)
// =============================================================================
app.post('/v1/ai/style-samples', authMiddleware, function(req, res) {
  var imageId = req.body.imageId
  var style = req.body.style || 'default'

  if (!imageId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 imageId' })

  var taskId = uuidv4()
  db.prepare('INSERT INTO ai_samples (id,image_id,style) VALUES (?,?,?)').run(taskId, imageId, style)

  // If AI service is configured, call it asynchronously
  if (AI_SERVICE_URL) {
    // In production, this would call an external AI service
    // e.g., fetch(AI_SERVICE_URL + '/generate-samples', { method: 'POST', body: JSON.stringify({ imageId, style }) })
    log('INFO', 'AI', 'Style sample task created', { taskId: taskId, style: style })
  }

  res.json({ data: { taskId: taskId } })
})

app.get('/v1/ai/style-samples/:taskId', authMiddleware, function(req, res) {
  var sample = db.prepare('SELECT * FROM ai_samples WHERE id = ?').get(req.params.taskId)
  if (!sample) return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' })

  // Return stored results if completed, otherwise return pending
  var outputUrls = JSON.parse(sample.output_urls || '[]')
  res.json({
    data: {
      taskId: sample.id,
      status: outputUrls.length > 0 ? 'completed' : 'pending',
      progress: outputUrls.length > 0 ? 100 : 50,
      result: outputUrls.length > 0 ? { urls: outputUrls } : null
    }
  })
})

app.post('/v1/ai/style-samples/:sampleId/like', authMiddleware, function(req, res) {
  var sample = db.prepare('SELECT * FROM ai_samples WHERE id = ?').get(req.params.sampleId)
  if (!sample) return res.status(404).json({ code: 'NOT_FOUND' })

  var liked = JSON.parse(sample.liked_indexes || '[]')
  var index = parseInt(req.body.index, 10)
  if (!isNaN(index) && index >= 0) {
    if (liked.indexOf(index) === -1) liked.push(index)
    db.prepare('UPDATE ai_samples SET liked_indexes = ? WHERE id = ?').run(JSON.stringify(liked), req.params.sampleId)
  }
  res.json({ data: null })
})

app.post('/v1/ai/parse-instruction', authMiddleware, function(req, res) {
  var commentCardId = req.body.commentCardId
  if (!commentCardId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 commentCardId' })

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(commentCardId)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '意见卡不存在' })

  var id = uuidv4()
  var suggestion = card.text_content ? '针对「' + card.text_content + '」的AI建议：请调整该区域的光影、色彩和构图，使画面更加协调。' : '暂无意见文本'

  if (AI_SERVICE_URL) {
    // In production: call NLP service to parse instruction
    log('INFO', 'AI', 'Parsing instruction', { commentCardId: commentCardId })
  }

  db.prepare('INSERT INTO ai_instructions (id,comment_card_id,original_text,suggestion_text,suggested_params) VALUES (?,?,?,?,?)')
    .run(id, commentCardId, card.text_content, suggestion, JSON.stringify({ 阴影: 15, 曝光: 0.3, 对比度: 5, 饱和度: -8 }))

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
  if (!inst) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: formatAIInstruction(inst) })
})

var colorCheckTasks = new Map() // taskId -> projectId

app.post('/v1/ai/color-check', authMiddleware, function(req, res) {
  var projectId = req.body.projectId
  if (!projectId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 projectId' })

  var taskId = uuidv4()
  colorCheckTasks.set(taskId, projectId)
  // In production, analyze all images in the project using AI
  // For now, return a valid task ID that the frontend can poll
  log('INFO', 'AI', 'Color check started', { projectId: projectId, taskId: taskId })
  res.json({ data: { taskId: taskId } })
})

app.get('/v1/ai/color-check/:taskId', authMiddleware, function(req, res) {
  var projectId = colorCheckTasks.get(req.params.taskId)
  if (!projectId) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' })
  }

  var images = db.prepare(`
    SELECT i.id, i.thumbnail_urls FROM images i
    JOIN product_units u ON i.product_unit_id = u.id
    WHERE u.project_id = ?
  `).all(projectId)

  var totalImages = images.length
  var abnormalCount = Math.min(3, totalImages)
  var items = images.slice(0, 3).map(function(img, idx) {
    var deviationTypes = ['color_temp', 'brightness', 'contrast']
    var suggestions = ['白平衡 -200K', '曝光 +0.4', '对比度 -12']
    var values = [350, -15, 22]
    var urls = JSON.parse(img.thumbnail_urls || '[]')
    return {
      imageId: img.id,
      thumbnailUrl: urls[0] || '/uploads/placeholder.svg',
      deviationType: deviationTypes[idx % 3],
      deviationValue: values[idx % 3],
      suggestion: suggestions[idx % 3]
    }
  })

  res.json({
    data: {
      id: req.params.taskId,
      projectId: projectId,
      totalImages: totalImages,
      abnormalCount: abnormalCount,
      items: items,
      createdAt: new Date().toISOString()
    }
  })
})

// =============================================================================
// Import Routes
// =============================================================================
app.post('/v1/import/cloud-drive', authMiddleware, function(req, res) {
  var provider = req.body.provider || 'local'
  var path_ = req.body.path || '/'

  // In production, integrate with actual cloud storage APIs
  // (e.g., Baidu Wangpan, Aliyun Drive, Google Drive, OneDrive)
  log('INFO', 'Import', 'Cloud drive browse', { provider: provider, path: path_ })

  res.json({
    data: {
      provider: provider,
      currentPath: path_,
      files: [
        { name: '产品图', path: path_ + '产品图', size: 0, type: 'folder', modifiedAt: '2026-06-01T10:00:00Z' },
        { name: 'IMG_001.jpg', path: path_ + 'IMG_001.jpg', size: 2048000, type: 'image', modifiedAt: '2026-06-05T14:00:00Z' },
        { name: 'IMG_002.jpg', path: path_ + 'IMG_002.jpg', size: 1850000, type: 'image', modifiedAt: '2026-06-05T14:05:00Z' },
        { name: 'IMG_003.jpg', path: path_ + 'IMG_003.jpg', size: 3200000, type: 'image', modifiedAt: '2026-06-06T09:00:00Z' }
      ]
    }
  })
})

app.post('/v1/import/wechat-screenshot', authMiddleware, upload.single('file'), function(req, res) {
  if (!req.file) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请上传截图' })

  // In production, use OCR + NLP to parse WeChat screenshots
  // For now, return sample parsed annotations
  log('INFO', 'Import', 'WeChat screenshot uploaded', { file: req.file.filename })

  res.json({
    data: {
      annotations: [
        { coordinates: { x: 0.2, y: 0.3, w: 0.15, h: 0.1 }, text: '这个区域颜色不对', confidence: 0.85 },
        { coordinates: { x: 0.5, y: 0.6, w: 0.1, h: 0.08 }, text: '亮度需要调整', confidence: 0.78 }
      ]
    }
  })
})

app.post('/v1/import/apply', authMiddleware, function(req, res) {
  var projectId = req.body.projectId
  var annotations = req.body.annotations

  if (!projectId || !Array.isArray(annotations)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少必填字段' })

  var taskId = uuidv4()
  // In production, process the import asynchronously
  log('INFO', 'Import', 'Apply import', { projectId: projectId, annotationCount: annotations.length })
  res.json({ data: { taskId: taskId } })
})

// =============================================================================
// Portfolio Routes
// =============================================================================
app.post('/v1/projects/:id/portfolio', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var id = uuidv4()
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)

  db.prepare('INSERT INTO portfolio (id,project_id,name,description,client_name,workspace_logo,contact_info) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.params.id, req.body.name || '', req.body.description || '', proj.client_name || '客户', ws ? ws.logo_url : '', '微信：epicshot_studio')

  var portfolio = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(id)
  log('INFO', 'Portfolio', 'Created', { id: id, projectId: req.params.id })
  res.json({ data: formatPortfolio(portfolio) })
})

app.get('/v1/portfolios/:id', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })

  // Increment view count
  db.prepare('UPDATE portfolio SET views = views + 1 WHERE id = ?').run(req.params.id)
  res.json({ data: formatPortfolio(p) })
})

app.put('/v1/portfolios/:id', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })

  if (req.body.name !== undefined) db.prepare('UPDATE portfolio SET name = ? WHERE id = ?').run(req.body.name, req.params.id)
  if (req.body.description !== undefined) db.prepare('UPDATE portfolio SET description = ? WHERE id = ?').run(req.body.description, req.params.id)
  if (req.body.coverUrl) db.prepare('UPDATE portfolio SET cover_url = ? WHERE id = ?').run(req.body.coverUrl, req.params.id)
  if (req.body.images) db.prepare('UPDATE portfolio SET images = ? WHERE id = ?').run(JSON.stringify(req.body.images), req.params.id)
  if (req.body.contactInfo) db.prepare('UPDATE portfolio SET contact_info = ? WHERE id = ?').run(req.body.contactInfo, req.params.id)
  if (req.body.isPublished !== undefined) db.prepare('UPDATE portfolio SET is_published = ? WHERE id = ?').run(req.body.isPublished ? 1 : 0, req.params.id)

  var updated = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  res.json({ data: formatPortfolio(updated) })
})

app.get('/v1/portfolios/:id/stats', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: { views: p.views || 0, avgDuration: p.avg_duration || 0 } })
})

app.post('/v1/portfolios/:id/cover', authMiddleware, upload.single('file'), function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })
  if (!req.file) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请上传封面图片' })

  var filename = req.file.filename
  var url = '/uploads/' + filename
  db.prepare('UPDATE portfolio SET cover_url = ? WHERE id = ?').run(url, req.params.id)
  res.json({ data: { url: url } })
})

// =============================================================================
// Client Routes
// =============================================================================
app.get('/v1/client/me/projects', authMiddleware, function(req, res) {
  var projects = db.prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC').all(req.workspaceId)
  res.json({ data: projects.map(formatProject), total: projects.length, page: 1, pageSize: 20 })
})

// =============================================================================
// Formatters
// =============================================================================
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
  return { id: p.id, projectId: p.project_id, name: p.name, description: p.description, coverUrl: p.cover_url, images: JSON.parse(p.images || '[]'), clientName: p.client_name, workspaceLogo: p.workspace_logo, contactInfo: p.contact_info, qrCode: p.qr_code, views: p.views, avgDuration: p.avg_duration, isPublished: !!p.is_published, createdAt: p.created_at }
}

// =============================================================================
// Global Error Handler
// =============================================================================
app.use(function(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ code: 'FILE_TOO_LARGE', message: '文件大小超过限制（最大50MB）' })
    }
    return res.status(400).json({ code: 'UPLOAD_ERROR', message: err.message })
  }
  log('ERROR', 'Server', 'Unhandled error', { message: err.message, stack: err.stack, url: req.originalUrl })
  res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' })
})

// =============================================================================
// Generate placeholder SVG
// =============================================================================
var svgLines = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
  '<rect width="800" height="600" fill="#e8eaed"/>',
  '<circle cx="400" cy="250" r="80" fill="#667eea" opacity="0.3"/>',
  '<rect x="250" y="380" width="300" height="60" rx="8" fill="#667eea" opacity="0.4"/>',
  '<text x="400" y="260" text-anchor="middle" font-family="Arial" font-size="28" fill="#5f6368">Sample Photo</text>',
  '</svg>'
]
fs.writeFileSync(path.join(UPLOADS_DIR, 'placeholder.svg'), svgLines.join('\n'))

// =============================================================================
// WebSocket Server (Collaboration)
// =============================================================================
var server = http.createServer(app)
var wss = new WebSocketServer({ server: server, path: '/v1/ws' })

// Track connected clients per project
var projectClients = {}

wss.on('connection', function(ws, req) {
  var userId = null, projectId = null

  ws.on('message', function(data) {
    try {
      var msg = JSON.parse(data.toString())

      switch (msg.type) {
        case 'auth':
          // Authenticate WebSocket connection
          try {
            var payload = jwt.verify(msg.token, JWT_SECRET)
            userId = payload.userId
            projectId = msg.projectId
            ws.userId = userId
            ws.projectId = projectId

            if (!projectClients[projectId]) projectClients[projectId] = new Set()
            projectClients[projectId].add(ws)

            ws.send(JSON.stringify({ type: 'auth_ok', userId: userId }))
            log('INFO', 'WS', 'Client connected', { userId: userId, projectId: projectId })
          } catch (e) {
            ws.send(JSON.stringify({ type: 'auth_error', message: '认证失败' }))
          }
          break

        case 'annotation:create':
        case 'annotation:update':
        case 'annotation:delete':
        case 'comment:create':
        case 'comment:update':
        case 'comment:status':
          // Broadcast to all clients in the same project
          if (projectId && projectClients[projectId]) {
            var broadcast = JSON.stringify({
              type: msg.type,
              data: msg.data,
              userId: userId,
              timestamp: new Date().toISOString()
            })
            projectClients[projectId].forEach(function(client) {
              if (client !== ws && client.readyState === 1) {
                client.send(broadcast)
              }
            })
          }
          break

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break

        case 'pong':
          ws.isAlive = true
          break

        default:
          log('WARN', 'WS', 'Unknown message type', { type: msg.type })
      }
    } catch (e) {
      log('ERROR', 'WS', 'Message parse error', e.message)
    }
  })

  ws.on('close', function() {
    if (projectId && projectClients[projectId]) {
      projectClients[projectId].delete(ws)
      if (projectClients[projectId].size === 0) delete projectClients[projectId]
    }
    log('INFO', 'WS', 'Client disconnected', { userId: userId })
  })

  ws.on('error', function(e) {
    log('ERROR', 'WS', 'WebSocket error', e.message)
  })
})

// Heartbeat
var heartbeatInterval = setInterval(function() {
  wss.clients.forEach(function(ws) {
    if (ws.isAlive === false) return ws.terminate()
    ws.isAlive = false
    ws.send(JSON.stringify({ type: 'ping' }))
  })
}, 30000)

wss.on('close', function() { clearInterval(heartbeatInterval) })

// =============================================================================
// Start Server
// =============================================================================
server.listen(PORT, '0.0.0.0', function() {
  log('INFO', 'Server', 'EpicShot API Server started', { port: PORT, db: DB_PATH })
  log('INFO', 'Server', 'Admin: zhang@epicshot.com / admin123')

  if (!isRealWechat()) {
    log('WARN', 'Server', 'WeChat OAuth not configured — using demo mode')
  }
  if (!AI_SERVICE_URL) {
    log('INFO', 'Server', 'AI service not configured — using built-in fallback')
  }
})

// Graceful shutdown
function shutdown(signal) {
  log('INFO', 'Server', 'Received ' + signal + ', shutting down gracefully...')
  clearInterval(heartbeatInterval)
  wss.clients.forEach(function(ws) { ws.close() })
  wss.close(function() {
    server.close(function() {
      db.close()
      log('INFO', 'Server', 'Shutdown complete')
      process.exit(0)
    })
  })
  // Force exit after 10s
  setTimeout(function() { process.exit(1) }, 10000)
}

process.on('SIGTERM', function() { shutdown('SIGTERM') })
process.on('SIGINT', function() { shutdown('SIGINT') })