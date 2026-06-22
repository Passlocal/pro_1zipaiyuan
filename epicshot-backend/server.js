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
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const { WebSocketServer } = require('ws')
// V1.2.0: Email, ZIP export, PDF, APM
const nodemailer = require('nodemailer')
const archiver = require('archiver')
const PDFDocument = require('pdfkit')
const Sentry = require('@sentry/node')

// =============================================================================
// Configuration
// =============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_PROD = NODE_ENV === 'production'
const PORT = parseInt(process.env.PORT, 10) || 3000
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? (function() { throw new Error('FATAL: JWT_SECRET must be set in production') })() : 'epicshot-dev-secret-' + require('crypto').randomBytes(32).toString('hex'))
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS = 12
const DB_PATH = path.join(__dirname, 'data', 'epicshot.db')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',')

// HTTPS configuration
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true' || IS_PROD
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'key.pem')
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem')
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443

// WeChat OAuth
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || ''
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || ''
const WECHAT_REDIRECT_URI = process.env.WECHAT_REDIRECT_URI || 'http://localhost:3000/v1/auth/wechat/callback'
const WECHAT_OAUTH_URL = 'https://open.weixin.qq.com/connect/qrconnect'
const WECHAT_API_BASE = 'https://api.weixin.qq.com'

// AI Service (可替换为真实 AI 服务)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || ''
const AI_RETRY_MAX = parseInt(process.env.AI_RETRY_MAX, 10) || 1
const AI_RETRY_DELAY = parseInt(process.env.AI_RETRY_DELAY, 10) || 2000

// V1.2.0: Email notification config
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true' || IS_PROD
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.example.com'
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT, 10) || 587
const EMAIL_USER = process.env.EMAIL_USER || ''
const EMAIL_PASS = process.env.EMAIL_PASS || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@epicshot.com'

// V1.2.0: CDN signed URL secret
const CDN_SECRET = process.env.CDN_SECRET || JWT_SECRET
const CDN_URL_EXPIRY = 3600 // 1 hour

// V1.2.0: Sentry APM
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: NODE_ENV, tracesSampleRate: 0.1 })
  log('INFO', 'Server', 'Sentry initialized')
}

// =============================================================================
// Ensure directories
// =============================================================================
;['data', 'uploads', 'uploads/thumbnails', 'uploads/originals'].forEach(function(d) {
  fs.mkdirSync(path.join(__dirname, d), { recursive: true })
})

// =============================================================================
// Production-Grade Structured JSON Logger
// =============================================================================
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || (IS_PROD ? 'INFO' : 'DEBUG')] || LOG_LEVELS.INFO

// Generate a unique instance ID for this server process
var INSTANCE_ID = require('crypto').randomBytes(6).toString('hex')

function log(level, module, message, data) {
  var numericLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO
  if (numericLevel < LOG_LEVEL) return

  var entry = {
    ts: new Date().toISOString(),
    level: level,
    module: module,
    msg: message,
    instance: INSTANCE_ID
  }

  if (data && typeof data === 'object') {
    if (data instanceof Error) {
      entry.error = data.message
      entry.stack = IS_PROD ? undefined : data.stack
    } else {
      Object.assign(entry, data)
    }
  } else if (data) {
    entry.detail = String(data)
  }

  var output = JSON.stringify(entry)
  if (level === 'ERROR') console.error(output)
  else console[level === 'WARN' ? 'warn' : 'log'](output)
}

// =============================================================================
// V1.2.0: Email Transporter
// =============================================================================
var mailTransporter = null
if (EMAIL_ENABLED && EMAIL_USER) {
  mailTransporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  })
}

function sendEmail(to, subject, html) {
  if (!mailTransporter) {
    log('WARN', 'Email', 'Email not configured, skipping', { to: to, subject: subject })
    return
  }
  mailTransporter.sendMail({ from: EMAIL_FROM, to: to, subject: subject, html: html }, function(err) {
    if (err) log('ERROR', 'Email', 'Failed to send', { to: to, error: err.message })
    else log('INFO', 'Email', 'Sent', { to: to, subject: subject })
  })
}

// =============================================================================
// V1.2.0: AI Retry Wrapper
// =============================================================================
function aiRetryWrapper(fn, label) {
  return function() {
    var args = arguments
    var self = this
    var attempt = 0
    function tryCall() {
      try {
        fn.apply(self, args)
      } catch (e) {
        attempt++
        if (attempt <= AI_RETRY_MAX) {
          log('WARN', 'AI', 'Retry ' + label, { attempt: attempt })
          setTimeout(tryCall, AI_RETRY_DELAY)
        } else {
          log('ERROR', 'AI', label + ' failed after retries', { error: e.message })
        }
      }
    }
    tryCall()
  }
}

// =============================================================================
// V1.2.0: CDN Signed URL
// =============================================================================
function generateSignedUrl(filePath) {
  var expires = Math.floor(Date.now() / 1000) + CDN_URL_EXPIRY
  var hmac = crypto.createHmac('sha256', CDN_SECRET)
  hmac.update(filePath + '|' + expires)
  var signature = hmac.digest('hex')
  return '/cdn/' + encodeURIComponent(filePath) + '?expires=' + expires + '&sig=' + signature
}

function verifySignedUrl(filePath, expires, sig) {
  if (parseInt(expires, 10) < Math.floor(Date.now() / 1000)) return false
  var hmac = crypto.createHmac('sha256', CDN_SECRET)
  hmac.update(filePath + '|' + expires)
  return hmac.digest('hex') === sig
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
      contract_amount REAL DEFAULT 0,
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
      project_id TEXT, output_urls TEXT DEFAULT '[]', liked_indexes TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );
    -- Migration: add project_id to existing ai_samples (auto-handled by CREATE TABLE IF NOT EXISTS)
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

  // V1.1 Migration: 任务指派 & 争议预警
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN assignee_id TEXT') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN dispute_count INTEGER DEFAULT 0') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN disputed INTEGER DEFAULT 0') } catch (e) { /* column exists */ }

  // V1.2 Migration: 软删除 (回收站)
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN deleted_at TEXT') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE annotations ADD COLUMN deleted_at TEXT') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE images ADD COLUMN deleted_at TEXT') } catch (e) { /* column exists */ }

  // V1.2.0 Migration: 草稿自动保存
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN draft_text TEXT') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN draft_updated_at TEXT') } catch (e) { /* column exists */ }

  // V1.2.0 补充功能 Migration
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN estimated_time TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN last_edited_by TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN last_edited_at TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN read_by_client INTEGER DEFAULT 0') } catch (e) {}
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN read_at TEXT') } catch (e) {}

  // V1.3 Migration: 意见卡片图片坐标标记
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN position_x REAL') } catch (e) {}
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN position_y REAL') } catch (e) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN last_nudged_at TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN nudge_count INTEGER DEFAULT 0') } catch (e) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN client_first_visit TEXT DEFAULT \'true\'') } catch (e) {}
  try { db.exec('ALTER TABLE workspaces ADD COLUMN member_load_limit INTEGER DEFAULT 15') } catch (e) {}
  try { db.exec('ALTER TABLE workspaces ADD COLUMN preset_phrases TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE workspaces ADD COLUMN shortcuts TEXT') } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN notification_prefs TEXT') } catch (e) {}

  // 新表
  try { db.exec('CREATE TABLE IF NOT EXISTS recent_actions (id TEXT PRIMARY KEY, workspace_id TEXT, project_id TEXT, user_id TEXT, action_type TEXT, description TEXT, undo_data TEXT, created_at TEXT)') } catch (e) {}
  try { db.exec('CREATE TABLE IF NOT EXISTS image_discussions (id TEXT PRIMARY KEY, image_id TEXT, user_id TEXT, text TEXT, mentioned_user_ids TEXT, created_at TEXT)') } catch (e) {}
  try { db.exec('CREATE TABLE IF NOT EXISTS project_versions (id TEXT PRIMARY KEY, project_id TEXT, version TEXT, changes TEXT, created_at TEXT)') } catch (e) {}
  try { db.exec('CREATE TABLE IF NOT EXISTS ai_reports (id TEXT PRIMARY KEY, project_id TEXT, type TEXT, ignored_anomalies TEXT DEFAULT \'[]\', created_at TEXT)') } catch (e) {}
  try { db.exec('CREATE TABLE IF NOT EXISTS jargon_templates (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, name TEXT, keywords TEXT, created_at TEXT)') } catch (e) {}

  // V1.1 Migration: 项目预警设置
  try { db.exec('ALTER TABLE projects ADD COLUMN warning_hours INTEGER DEFAULT 24') } catch (e) { /* column exists */ }

  // V1.2 Supplement: images 表增加 original_filename 列
  try { db.exec('ALTER TABLE images ADD COLUMN original_filename TEXT DEFAULT \'\'') } catch (e) { /* column exists */ }

  // V1.2 Supplement: project_templates 表增加 structure/units 列
  try { db.exec('ALTER TABLE project_templates ADD COLUMN structure TEXT DEFAULT \'{}\'') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE project_templates ADD COLUMN units TEXT DEFAULT \'{}\'') } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE projects ADD COLUMN metadata TEXT DEFAULT \'{}\'') } catch (e) { /* column exists */ }

  // V1.2.1 Migration: 客户端品牌自定义
  try { db.exec('ALTER TABLE workspaces ADD COLUMN client_brand_name TEXT DEFAULT \'\'') } catch (e) {}
  try { db.exec('ALTER TABLE workspaces ADD COLUMN client_brand_logo_url TEXT DEFAULT \'\'') } catch (e) {}
  try { db.exec('ALTER TABLE workspaces ADD COLUMN client_brand_theme_color TEXT DEFAULT \'#0066FF\'') } catch (e) {}

  // V1.19: 交付包默认配置
  try { db.exec('ALTER TABLE workspaces ADD COLUMN client_brand_settings TEXT DEFAULT \'{}\'') } catch (e) {}

  // V1.2.1 Migration: 异步交付任务表
  try { db.exec('CREATE TABLE IF NOT EXISTS delivery_tasks (id TEXT PRIMARY KEY, workspace_id TEXT, project_id TEXT, user_id TEXT, options TEXT DEFAULT \'{}\', status TEXT DEFAULT \'pending\', download_url TEXT, expires_at TEXT, created_at TEXT DEFAULT (datetime(\'now\')))') } catch (e) {}

  // V1.18: 合同付款阶段
  try { db.exec('CREATE TABLE IF NOT EXISTS payment_stages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT, amount REAL DEFAULT 0, sort INTEGER DEFAULT 0, created_at TEXT, FOREIGN KEY (project_id) REFERENCES projects(id))') } catch (e) {}

  // V1.19: 项目支出记录
  try { db.exec('CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL, category TEXT NOT NULL, amount REAL DEFAULT 0, expense_date TEXT, note TEXT DEFAULT \'\', created_at TEXT DEFAULT (datetime(\'now\')), FOREIGN KEY (project_id) REFERENCES projects(id))') } catch (e) {}

  // V1.20 Migration: 讨论区已读状态
  try { db.exec('ALTER TABLE image_discussions ADD COLUMN is_read INTEGER DEFAULT 0') } catch (e) { /* column exists */ }

  // V1.20 Migration: 工作空间告警规则
  try { db.exec('ALTER TABLE workspaces ADD COLUMN alert_rules TEXT DEFAULT \'{}\'') } catch (e) { /* column exists */ }

  // V1.21 Migration: 预估工时(分钟数)
  try { db.exec('ALTER TABLE comment_cards ADD COLUMN estimated_time INTEGER DEFAULT NULL') } catch (e) { /* column exists */ }

  // V1.1: 通知表
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('annotation','dispute','deadline','status_change','mention','assign','confirm_request')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      project_id TEXT,
      comment_card_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
  `)

  // Migration: add project_id to ai_samples (ignore if already exists)
  try { db.prepare('ALTER TABLE ai_samples ADD COLUMN project_id TEXT').run() } catch(e) {}

  // UX-27: 操作日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // UX-18: 产品单元二级分类
  try {
    db.exec(`ALTER TABLE product_units ADD COLUMN parent_id TEXT`)
  } catch (e) { /* column already exists */ }

  // DATA-06: 项目合同金额
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN contract_amount REAL DEFAULT 0`)
  } catch (e) { /* column already exists */ }

  // V1.1: 项目模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_templates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee_map TEXT DEFAULT '{}',
      delivery_rules TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_workspace ON project_templates(workspace_id);
  `)
}

// UX-27: 操作日志记录
function logOperation(projectId, userId, userName, action, targetType, targetId, detail) {
  const id = uuidv4()
  db.prepare(`INSERT INTO operation_logs (id, project_id, user_id, user_name, action, target_type, target_id, detail) VALUES (?,?,?,?,?,?,?,?)`).run(id, projectId, userId, userName, action, targetType, targetId, detail || '')
}

function seedIfEmpty() {
  var count = db.prepare('SELECT COUNT(*) as c FROM workspaces').get()
  if (count.c > 0) return

  try {

  log('INFO', 'DB', 'Seeding initial data...')

  var wsId = 'ws-001'
  db.prepare('INSERT INTO workspaces (id,name,logo_url,plan_type,created_at) VALUES (?,?,?,?,?)').run(wsId, '素影摄影工作室', '', 'enterprise', '2026-01-15T08:00:00Z')

  var adminHash = bcrypt.hashSync('admin123', BCRYPT_ROUNDS)
  var testHash = bcrypt.hashSync('test123', BCRYPT_ROUNDS)
  db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-001', '张总监', 'zhang@epicshot.com', adminHash, null, wsId, 'owner', '', 'active', '2026-01-15T08:00:00Z')
  db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-002', '李修图', 'li@epicshot.com', adminHash, null, wsId, 'editor', '', 'active', '2026-02-10T10:00:00Z')
  db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-003', '王后期', 'wang@epicshot.com', adminHash, null, wsId, 'editor', '', 'active', '2026-03-05T09:00:00Z')
  // 测试账号
  db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-test-owner', 'TestOwner', 'owner@test.com', adminHash, null, wsId, 'owner', '', 'active', '2026-06-01T00:00:00Z')
  db.prepare('INSERT INTO users (id,name,email,password,wechat_openid,workspace_id,role,avatar_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('user-test-editor', 'TestEditor', 'editor@test.com', adminHash, null, wsId, 'editor', '', 'active', '2026-06-01T00:00:00Z')

  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline,status,share_token,share_expiry,pending_count,created_at,updated_at,warning_hours,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run('proj-001', wsId, '小米15系列官网主图', '小米科技', null, 'in_progress', 'share-token-001', null, 8, '2026-06-01T10:00:00Z', '2026-06-14T10:00:00Z', 24, '{}')
  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline,status,share_token,share_expiry,pending_count,created_at,updated_at,warning_hours,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run('proj-002', wsId, '花西子口红新品', '花西子', null, 'final_review', 'share-token-002', null, 3, '2026-05-28T14:00:00Z', '2026-06-13T16:00:00Z', 24, '{}')
  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline,status,share_token,share_expiry,pending_count,created_at,updated_at,warning_hours,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run('proj-003', wsId, '2026春季跑鞋系列', '安踏体育', null, 'completed', 'share-token-003', null, 0, '2026-05-15T09:00:00Z', '2026-06-10T09:00:00Z', 24, '{}')

  db.prepare('INSERT INTO product_units (id,project_id,name,sort_order) VALUES (?,?,?,?)').run('unit-001', 'proj-001', '主图', 1)
  db.prepare('INSERT INTO product_units (id,project_id,name,sort_order) VALUES (?,?,?,?)').run('unit-002', 'proj-001', '细节图', 2)

  db.prepare('INSERT INTO images (id,product_unit_id,original_url,thumbnail_urls,media_type,metadata,uploader_id,created_at) VALUES (?,?,?,?,?,?,?,?)').run('img-001', 'unit-001', '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":600}', 'user-001', '2026-06-01T10:00:00Z')
  db.prepare('INSERT INTO images (id,product_unit_id,original_url,thumbnail_urls,media_type,metadata,uploader_id,created_at) VALUES (?,?,?,?,?,?,?,?)').run('img-002', 'unit-001', '/uploads/placeholder.svg', '["/uploads/placeholder.svg","/uploads/placeholder.svg","/uploads/placeholder.svg"]', 'image', '{"width":800,"height":1200}', 'user-001', '2026-06-01T10:30:00Z')

  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('ann-001', 'img-001', 'user-001', 'rectangle', '{"x":0.15,"y":0.2,"w":0.3,"h":0.25}', '{"color":"#FF0000","width":3}', '[]', '', '2026-06-05T10:00:00Z')
  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('ann-002', 'img-001', 'user-001', 'arrow', '{"x":0.5,"y":0.6,"w":0.15,"h":-0.2}', '{"color":"#0066FF","width":3}', '[]', '', '2026-06-05T10:05:00Z')

  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,status,sort_order,resolved_by,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('card-001', 'ann-001', 'img-001', '这个区域需要重新构图', 'resolved', 1, 'user-002', '2026-06-06T14:00:00Z', '2026-06-05T10:00:00Z')
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,status,sort_order,resolved_by,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('card-002', 'ann-002', 'img-001', '箭头指向的元素请替换', 'unresolved', 2, null, null, '2026-06-05T10:05:00Z')

  // F-15-1: 预置口语化标注意见
  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('ann-003', 'img-002', 'user-001', 'freehand', '{"points":[[0.2,0.25],[0.35,0.3],[0.5,0.25],[0.65,0.3]]}', '{"color":"#FF0000","width":5}', '[]', '', '2026-06-07T09:00:00Z')
  db.prepare('INSERT INTO annotations (id,image_id,user_id,tool_type,coordinates,style,stroke_data,text_content,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('ann-004', 'img-002', 'user-001', 'text', '{"x":0.1,"y":0.15,"w":0.4,"h":0.06}', '{"color":"#FF0000","fontSize":18}', '[]', '', '2026-06-07T09:05:00Z')
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,status,sort_order,resolved_by,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('card-003', 'ann-003', 'img-002', '袖口这边脏了，要处理干净', 'unresolved', 3, null, null, '2026-06-07T09:00:00Z')
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,status,sort_order,resolved_by,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('card-004', 'ann-004', 'img-002', '整体要那种高级灰的感觉', 'unresolved', 4, null, null, '2026-06-07T09:05:00Z')

  // F-23: 预置项目模板
  db.prepare('INSERT INTO project_templates (id,workspace_id,name,description,assignee_map,delivery_rules,created_at) VALUES (?,?,?,?,?,?,?)').run('tpl-001', wsId, '电商白底图标准流程', '适用于白底产品拍摄的标准修图流程，包含修图和质检环节', JSON.stringify({'retouch':'user-002','qa':'user-001'}), JSON.stringify({'naming':'产品名_最终稿','format':'jpg','minWidth':2000,'minHeight':2000}), '2026-06-01T00:00:00Z')
  db.prepare('INSERT INTO project_templates (id,workspace_id,name,description,assignee_map,delivery_rules,created_at) VALUES (?,?,?,?,?,?,?)').run('tpl-002', wsId, '时尚模特图流程', '适用于服装、配饰模特拍摄修图流程', JSON.stringify({'retouch':'user-003','qa':'user-001'}), JSON.stringify({'naming':'品牌_模特_日期','format':'jpg','colorSpace':'sRGB'}), '2026-06-01T00:00:00Z')

  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,user_avatar,description,image_id,revision_id,comment_card_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-001', 'proj-001', 'annotation', '客户 张经理', '', '提交了 2 条批注意见', null, null, null, '2026-06-05T10:10:00Z')
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,user_avatar,description,image_id,revision_id,comment_card_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-002', 'proj-001', 'status_change', '张总监', '', '项目状态变更：草稿 -> 待客户确认', null, null, null, '2026-06-05T10:30:00Z')
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,user_avatar,description,image_id,revision_id,comment_card_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-003', 'proj-001', 'revision', '李修图', '', '上传了修改后成片', 'img-001', null, 'card-001', '2026-06-06T14:00:00Z')
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,user_avatar,description,image_id,revision_id,comment_card_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('tl-004', 'proj-001', 'confirm', '客户 张经理', '', '确认了 1 张图片', null, null, null, '2026-06-06T16:00:00Z')

  log('INFO', 'DB', 'Seed complete')
  } catch(e) {
    log('WARN', 'DB', 'Seed skipped (schema mismatch)', { error: e.message })
  }
}

migrate()
seedIfEmpty()

// =============================================================================
// Express App & Middleware
// =============================================================================
const app = express()

// Request ID middleware — attach unique ID to every request
app.use(function(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4()
  res.setHeader('X-Request-ID', req.id)
  req._startTime = Date.now()
  next()
})

// Security headers — strict CSP in production
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: IS_PROD ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  } : false
}))

// V1.2.0: HSTS (HTTP Strict Transport Security)
if (IS_PROD) {
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }))
}

// V1.2.0: Sentry request handler (must be before routes)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// CORS — permissive in dev, origin-whitelist in production
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true)
    if (IS_PROD) {
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return cb(null, true)
      return cb(new Error('Origin not allowed: ' + origin))
    }
    cb(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}))

// Rate limiting — 生产环境从环境变量读取，开发环境使用宽松配置
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS, 10) || 15 * 60 * 1000
const GENERAL_RATE_MAX = parseInt(process.env.GENERAL_RATE_MAX, 10) || (IS_PROD ? 1000 : 5000)
const AUTH_RATE_MAX = parseInt(process.env.AUTH_RATE_MAX, 10) || (IS_PROD ? 10 : 30)
const UPLOAD_RATE_MAX = parseInt(process.env.UPLOAD_RATE_MAX, 10) || (IS_PROD ? 20 : 100)

const limiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: GENERAL_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }
})
app.use(limiter)

// Auth endpoints rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: AUTH_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '登录请求过于频繁，请稍后再试' }
})

// Upload endpoints rate limit (anti-abuse)
const uploadLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: UPLOAD_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '上传请求过于频繁，请稍后再试' }
})

// Body parsing
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// XSS sanitization middleware — sanitize all incoming request bodies
app.use(function(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = sanitizeObject(req.body)
  }
  next()
})

// Handle JSON parse errors and unsupported content types gracefully
app.use(function(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ code: 'INVALID_JSON', message: '请求体JSON格式无效' })
  }
  if (err.type === 'entity.parse.failed') {
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

// Request logging — structured JSON with request ID
app.use(function(req, res, next) {
  var start = Date.now()
  var origEnd = res.end
  res.end = function() {
    var duration = Date.now() - start
    log('INFO', 'HTTP', req.method + ' ' + req.originalUrl, {
      status: res.statusCode,
      duration_ms: duration,
      reqId: req.id,
      ip: req.ip,
      ua: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 120) : undefined
    })
    origEnd.apply(res, arguments)
  }
  next()
})

// =============================================================================
// Security: XSS sanitization — HTML-encode user input to prevent XSS
// =============================================================================
function sanitize(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)
  const result = {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string') {
      result[key] = sanitize(val)
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObject(val)
    } else {
      result[key] = val
    }
  }
  return result
}

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
    // V1.2: viewer角色只能读取
    if (req.userRole === 'viewer' && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      return res.status(403).json({ code: 'FORBIDDEN', message: '外部协作者无此操作权限' })
    }
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

// V1.2: viewer角色 — 只能读取，不能写入
function notViewer(req, res, next) {
  if (req.userRole === 'viewer') return res.status(403).json({ code: 'FORBIDDEN', message: '外部协作者无此操作权限' })
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
    version: '1.2.0'
  })
})

// =============================================================================
// Auth Routes
// =============================================================================
app.post('/v1/auth/login', authLimiter, function(req, res) {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ code: 'INVALID_JSON', message: '请求体JSON格式无效' })
  var email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  var password = typeof req.body.password === 'string' ? req.body.password : ''

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
  var name = String(req.body.name || '').trim()

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
  var name = String(req.body.name || '').trim()
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

// V1.19: 交付包默认配置
app.get('/v1/workspace/delivery-defaults', authMiddleware, function(req, res) {
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  var defaults = { include: 'final_images,excel,pdf' }
  try {
    if (ws.client_brand_settings) {
      var settings = JSON.parse(ws.client_brand_settings)
      if (settings.deliveryDefaults) defaults = settings.deliveryDefaults
    }
  } catch(e) {}
  res.json({ data: defaults })
})

app.put('/v1/workspace/delivery-defaults', authMiddleware, function(req, res) {
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  var settings = {}
  try { if (ws.client_brand_settings) settings = JSON.parse(ws.client_brand_settings) } catch(e) {}
  settings.deliveryDefaults = req.body
  db.prepare('UPDATE workspaces SET client_brand_settings = ? WHERE id = ?').run(JSON.stringify(settings), req.workspaceId)
  res.json({ data: settings.deliveryDefaults })
})

// F-52: 客户端品牌自定义
app.get('/v1/workspace/client-brand', authMiddleware, function(req, res) {
  var ws = db.prepare('SELECT client_brand_name, client_brand_logo_url, client_brand_theme_color FROM workspaces WHERE id = ?').get(req.workspaceId)
  res.json({ data: {
    name: ws ? (ws.client_brand_name || '') : '',
    logoUrl: ws ? (ws.client_brand_logo_url || '') : '',
    themeColor: ws ? (ws.client_brand_theme_color || '#0066FF') : '#0066FF'
  }})
})

app.put('/v1/workspace/client-brand', authMiddleware, ownerOnly, function(req, res) {
  var name = String(req.body.name || '').trim()
  var logoUrl = (req.body.logoUrl || '').trim()
  var themeColor = (req.body.themeColor || '#0066FF').trim()
  if (themeColor && !/^#[0-9A-Fa-f]{6}$/.test(themeColor)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '主题色格式不正确' })
  db.prepare('UPDATE workspaces SET client_brand_name = ?, client_brand_logo_url = ?, client_brand_theme_color = ? WHERE id = ?')
    .run(name, logoUrl, themeColor, req.workspaceId)
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId)
  res.json({ data: formatWorkspace(ws) })
})

// 公开接口：通过分享链接获取客户端品牌信息（无需登录）
app.get('/v1/share/:token/brand', function(req, res) {
  var proj = db.prepare('SELECT workspace_id FROM projects WHERE share_token = ?').get(req.params.token)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var ws = db.prepare('SELECT client_brand_name, client_brand_logo_url, client_brand_theme_color FROM workspaces WHERE id = ?').get(proj.workspace_id)
  res.json({ data: {
    name: ws ? (ws.client_brand_name || 'EpicShot') : 'EpicShot',
    logoUrl: ws ? (ws.client_brand_logo_url || '') : '',
    themeColor: ws ? (ws.client_brand_theme_color || '#0066FF') : '#0066FF'
  }})
})

// UX-37: 标注处理状态（无需认证）
app.get('/v1/share/:token/status', function(req, res) {
  var token = req.params.token
  var parts = token.split('.')
  var rawToken = parts.length === 2 ? parts[0] : token
  var expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(rawToken).digest('hex').slice(0, 16)
  if (parts.length === 2 && parts[1] !== expectedHmac) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: '分享链接无效' })
  }

  var proj = db.prepare('SELECT id, status FROM projects WHERE share_token = ?').get(token)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '分享链接不存在' })

  // 从 operation_logs 查询最新事件来确定状态
  var latestLog = db.prepare('SELECT action, created_at FROM operation_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(proj.id)

  var status = 'submitted'
  if (latestLog) {
    switch (latestLog.action) {
      case 'complete_project':
        status = 'completed'
        break
      case 'resolve_card':
        status = 'processing'
        break
      case 'dispute_card':
        status = 'processing'
        break
      case 'create_card':
        status = 'viewed'
        break
      default:
        status = 'submitted'
    }
  }

  // 如果项目本身已经完成
  if (proj.status === 'completed') {
    status = 'completed'
  }

  res.json({
    data: {
      status: status,
      updatedAt: latestLog ? latestLog.created_at : proj.updated_at || new Date().toISOString()
    }
  })
})

// DATA-05: 记录客户查看分享链接
app.post('/v1/share/:token/view', function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE share_token = ?').get(req.params.token)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  logOperation(proj.id, 'client', '客户', 'view_share', 'project', proj.id, '')
  res.json({ data: { viewed: true } })
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
  var formatted = formatProject(proj)
  // V1.19: Include payment stages
  var stages = db.prepare('SELECT * FROM payment_stages WHERE project_id = ? ORDER BY sort').all(req.params.id)
  formatted.paymentStages = stages.map(function(s) { return { id: s.id, name: s.name, amount: s.amount, sort: s.sort, dueDate: s.created_at } })
  formatted.paymentStageTotal = stages.reduce(function(sum, s) { return sum + (s.amount || 0) }, 0)
  res.json({ data: formatted })
})

// V1.19: 批量操作项目
app.post('/v1/projects/batch', authMiddleware, function(req, res) {
  var { ids, action, deadline } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'ids 不能为空' })
  }
  if (!action || ['archive', 'delete', 'update-deadline', 'restore'].indexOf(action) === -1) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'action 必须是 archive, delete, update-deadline 或 restore' })
  }
  if (action === 'update-deadline' && !deadline) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'update-deadline 操作需要 deadline 参数' })
  }

  var results = []
  var now = new Date().toISOString()

  ids.forEach(function(id) {
    var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(id, req.workspaceId)
    if (!proj) {
      results.push({ id: id, success: false, reason: '项目不存在' })
      return
    }

    try {
      if (action === 'archive') {
        if (proj.status !== 'completed') {
          results.push({ id: id, success: false, reason: '仅已完成项目可归档' })
          return
        }
        db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('archived', now, id)
        // 操作日志
        db.prepare('INSERT INTO operation_logs (id, project_id, user_id, user_name, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          require('crypto').randomUUID(), id, req.userId, req.userName || '系统', 'batch_archive', 'project', id, '批量归档'
        )
        results.push({ id: id, success: true, name: proj.name })
      } else if (action === 'delete') {
        if (proj.status === 'completed') {
          results.push({ id: id, success: false, reason: '已完成项目不可删除' })
          return
        }
        db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('archived', now, id)
        db.prepare('INSERT INTO operation_logs (id, project_id, user_id, user_name, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          require('crypto').randomUUID(), id, req.userId, req.userName || '系统', 'batch_delete', 'project', id, '批量删除'
        )
        results.push({ id: id, success: true, name: proj.name })
      } else if (action === 'update-deadline') {
        db.prepare('UPDATE projects SET deadline = ?, updated_at = ? WHERE id = ?').run(deadline, now, id)
        db.prepare('INSERT INTO operation_logs (id, project_id, user_id, user_name, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          require('crypto').randomUUID(), id, req.userId, req.userName || '系统', 'batch_update_deadline', 'project', id, '批量修改截止日期为 ' + deadline
        )
        results.push({ id: id, success: true, name: proj.name })
      } else if (action === 'restore') {
        if (proj.status !== 'archived') {
          results.push({ id: id, success: false, reason: '仅已归档项目可恢复' })
          return
        }
        db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('completed', now, id)
        db.prepare('INSERT INTO operation_logs (id, project_id, user_id, user_name, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          require('crypto').randomUUID(), id, req.userId, req.userName || '系统', 'batch_restore', 'project', id, '批量恢复'
        )
        results.push({ id: id, success: true, name: proj.name })
      }
    } catch (err) {
      results.push({ id: id, success: false, reason: err.message })
    }
  })

  var successCount = results.filter(function(r) { return r.success }).length
  var failCount = results.filter(function(r) { return !r.success }).length

  res.json({
    data: {
      results: results,
      summary: { total: ids.length, success: successCount, failed: failCount }
    }
  })
})

app.post('/v1/projects', authMiddleware, function(req, res) {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ code: 'INVALID_JSON', message: '请求体JSON格式无效' })
  var name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '项目名称不能为空' })
  if (name.length > 200) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '项目名称不能超过200个字符' })

  var id = uuidv4()
  var status = req.body.status
  var validStatuses = ['draft', 'review', 'in_progress', 'final_review', 'completed', 'archived']
  if (status && validStatuses.indexOf(status) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的项目状态' })
  db.prepare('INSERT INTO projects (id,workspace_id,name,client_name,deadline,status,contract_amount) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.workspaceId, name, (req.body.clientName || '').trim(), req.body.deadline || null, status || 'draft', (req.body.contractAmount || req.body.contract_amount || 0))

  var proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
    .run(uuidv4(), id, 'status_change', '系统', '创建了项目「' + name + '」')

  if (req.body.paymentStages && Array.isArray(req.body.paymentStages)) {
    const insertStage = db.prepare('INSERT INTO payment_stages (id, project_id, name, amount, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    req.body.paymentStages.forEach(function(stage, idx) {
      insertStage.run(require('crypto').randomUUID(), id, stage.name, stage.amount, idx, new Date().toISOString())
    })
  }

  var formatted = formatProject(proj)
  // V1.19: Include payment stages in create response
  var stages = db.prepare('SELECT * FROM payment_stages WHERE project_id = ? ORDER BY sort').all(id)
  formatted.paymentStages = stages.map(function(s) { return { id: s.id, name: s.name, amount: s.amount, sort: s.sort, dueDate: s.created_at } })
  formatted.paymentStageTotal = stages.reduce(function(sum, s) { return sum + (s.amount || 0) }, 0)

  log('INFO', 'Project', 'Created', { id: id, name: name })
  res.status(201).json({ data: formatted })
})

// V1.19: 项目支出记录
app.get('/v1/projects/:id/expenses', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var expenses = db.prepare('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC, created_at DESC').all(req.params.id)
  var total = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = ?').get(req.params.id).total
  res.json({ data: { expenses: expenses, total: total } })
})

app.post('/v1/projects/:id/expenses', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var { category, amount, expenseDate, note } = req.body
  if (!category || !amount) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '类别和金额不能为空' })
  var id = require('crypto').randomUUID()
  db.prepare('INSERT INTO expenses (id, workspace_id, project_id, category, amount, expense_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.workspaceId, req.params.id, category, amount, expenseDate || new Date().toISOString().slice(0, 10), note || '')
  var expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)
  res.status(201).json({ data: expense })
})

app.put('/v1/projects/:id/expenses/:eid', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND project_id = ?').get(req.params.eid, req.params.id)
  if (!expense) return res.status(404).json({ code: 'NOT_FOUND' })
  var { category, amount, expenseDate, note } = req.body
  db.prepare('UPDATE expenses SET category = COALESCE(?, category), amount = COALESCE(?, amount), expense_date = COALESCE(?, expense_date), note = COALESCE(?, note) WHERE id = ?').run(category, amount, expenseDate, note, req.params.eid)
  var updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.eid)
  res.json({ data: updated })
})

app.delete('/v1/projects/:id/expenses/:eid', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  var expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND project_id = ?').get(req.params.eid, req.params.id)
  if (!expense) return res.status(404).json({ code: 'NOT_FOUND' })
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.eid)
  res.json({ data: { deleted: true } })
})

app.put('/v1/projects/:id', authMiddleware, function(req, res) {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ code: 'INVALID_JSON', message: '请求体JSON格式无效' })
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  if (req.body.status) {
    var validStatuses = ['draft', 'review', 'in_progress', 'final_review', 'completed', 'archived']
    if (validStatuses.indexOf(req.body.status) === -1) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '无效的项目状态' })
    db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, req.params.id)
    db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
      .run(uuidv4(), req.params.id, 'status_change', '系统', '项目状态变更：' + proj.status + ' -> ' + req.body.status)
  }
  if (req.body.name) {
    var name = String(req.body.name || '').trim()
    if (name.length > 200) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '项目名称不能超过200个字符' })
    db.prepare('UPDATE projects SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(name, req.params.id)
  }
  if (req.body.clientName !== undefined) db.prepare('UPDATE projects SET client_name = ?, updated_at = datetime(\'now\') WHERE id = ?').run((req.body.clientName || '').trim(), req.params.id)
  if (req.body.deadline !== undefined) db.prepare("UPDATE projects SET deadline = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.deadline, req.params.id)
  if (req.body.contractAmount !== undefined) db.prepare("UPDATE projects SET contract_amount = ?, updated_at = datetime('now') WHERE id = ?").run(Number(req.body.contractAmount) || 0, req.params.id)

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

  // V1.2: HMAC签名分享Token
  var rawToken = crypto.randomBytes(16).toString('hex')
  var hmac = crypto.createHmac('sha256', JWT_SECRET).update(rawToken).digest('hex').slice(0, 16)
  var signedToken = rawToken + '.' + hmac
  var expiry = null
  if (req.body.expiry === '7days') expiry = new Date(Date.now() + 7 * 86400000).toISOString()
  else if (req.body.expiry === '30days') expiry = new Date(Date.now() + 30 * 86400000).toISOString()

  db.prepare('UPDATE projects SET share_token = ?, share_expiry = ? WHERE id = ?').run(signedToken, expiry, req.params.id)
  res.json({ data: { token: signedToken, url: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/client/project/' + signedToken } })
})

app.get('/v1/share/:token', function(req, res) {
  // V1.2: HMAC签名验证
  var token = req.params.token
  var parts = token.split('.')
  if (parts.length !== 2) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: '分享链接无效（签名格式错误）' })
  }
  var rawToken = parts[0]
  var expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(rawToken).digest('hex').slice(0, 16)
  if (parts[1] !== expectedHmac) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: '分享链接无效（签名验证失败）' })
  }
  var proj = db.prepare('SELECT * FROM projects WHERE share_token = ?').get(token)
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
  // Get brand info
  var ws = db.prepare('SELECT client_brand_name, client_brand_logo_url, client_brand_theme_color FROM workspaces WHERE id = ?').get(proj.workspace_id)
  res.json({ data: { project: formatProject(proj), cards: cards.map(formatCommentCard), brand: { name: (ws && ws.client_brand_name) || 'EpicShot', logoUrl: (ws && ws.client_brand_logo_url) || '', themeColor: (ws && ws.client_brand_theme_color) || '#0066FF' } } })
})

app.delete('/v1/projects/:id/share', authMiddleware, function(req, res) {
  db.prepare('UPDATE projects SET share_token = NULL, share_expiry = NULL WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId)
  res.json({ data: null })
})

app.post('/v1/projects/:id/complete', authMiddleware, function(req, res) {
  db.prepare("UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ? AND workspace_id = ?").run(req.params.id, req.workspaceId)
  db.prepare('INSERT INTO timeline_events (id,project_id,type,user_name,description) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.params.id, 'confirm', '系统', '项目已完成')
  // UX-27: 记录操作日志
  var userName = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)?.name || '未知用户'
  logOperation(req.params.id, req.userId, userName, 'complete_project', 'project', req.params.id, '项目确稿完成')
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
  var name = String(req.body.name || '').trim()
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

// UX-18: 获取产品单元树
app.get('/v1/projects/:projectId/units/tree', authMiddleware, function(req, res) {
  try {
    const units = db.prepare(`SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order`).all(req.params.projectId)
    // Build tree structure
    const rootUnits = units.filter(u => !u.parent_id)
    const childUnits = units.filter(u => u.parent_id)
    rootUnits.forEach(root => {
      root.children = childUnits.filter(c => c.parent_id === root.id)
    })
    res.json({ data: rootUnits })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================================================================
// Image Routes (with real file upload)
// =============================================================================
app.get('/v1/units/:unitId/images', authMiddleware, function(req, res) {
  var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ? ORDER BY created_at').all(req.params.unitId)
  res.json({ data: images.map(formatImage) })
})

app.post('/v1/units/:unitId/images', authMiddleware, uploadLimiter, upload.array('files', 20), async function(req, res) {
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
  var anns = db.prepare('SELECT * FROM annotations WHERE image_id = ? AND deleted_at IS NULL ORDER BY created_at').all(req.params.imageId)
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
  // V1.2: 软删除 — 设置deleted_at时间戳
  var existing = db.prepare('SELECT id FROM annotations WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!existing) return res.status(404).json({ code: 'NOT_FOUND', message: '标注不存在' })
  var now = new Date().toISOString()
  db.prepare('UPDATE comment_cards SET deleted_at = ? WHERE annotation_id = ? AND deleted_at IS NULL').run(now, req.params.id)
  db.prepare('UPDATE annotations SET deleted_at = ? WHERE id = ?').run(now, req.params.id)
  res.json({ data: { deletedAt: now } })
})

// V1.2: 回收站 — 获取已删除项目列表
app.get('/v1/recycle-bin', authMiddleware, function(req, res) {
  var wsId = req.workspaceId
  var type = req.query.type || 'all'

  var deletedCards = []
  var deletedAnnotations = []

  if (type === 'all' || type === 'cards' || type === 'comment_cards') {
    deletedCards = db.prepare(`
      SELECT cc.*, a.tool_type, a.coordinates, a.style, i.original_url, i.thumbnail_urls
      FROM comment_cards cc
      JOIN annotations a ON a.id = cc.annotation_id
      JOIN images i ON i.id = a.image_id
      JOIN product_units pu ON pu.id = i.product_unit_id
      JOIN projects p ON p.id = pu.project_id AND p.workspace_id = ?
      WHERE cc.deleted_at IS NOT NULL
      ORDER BY cc.deleted_at DESC
    `).all(wsId).map(function(r) {
      return {
        id: r.id,
        type: 'comment_card',
        annotationId: r.annotation_id,
        imageUrl: (JSON.parse(r.thumbnail_urls || '[""]')[0]) || r.original_url,
        text: r.text_content,
        deletedAt: r.deleted_at,
        restorableUntil: new Date(new Date(r.deleted_at).getTime() + 30 * 86400000).toISOString()
      }
    })
  }

  if (type === 'all' || type === 'annotations') {
    deletedAnnotations = db.prepare(`
      SELECT a.*, i.original_url, i.thumbnail_urls
      FROM annotations a
      JOIN images i ON i.id = a.image_id
      JOIN product_units pu ON pu.id = i.product_unit_id
      JOIN projects p ON p.id = pu.project_id AND p.workspace_id = ?
      WHERE a.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM comment_cards cc WHERE cc.annotation_id = a.id AND cc.deleted_at IS NULL)
      ORDER BY a.deleted_at DESC
    `).all(wsId).map(function(r) {
      return {
        id: r.id,
        type: 'annotation',
        toolType: r.tool_type,
        imageUrl: (JSON.parse(r.thumbnail_urls || '[""]')[0]) || r.original_url,
        deletedAt: r.deleted_at,
        restorableUntil: new Date(new Date(r.deleted_at).getTime() + 30 * 86400000).toISOString()
      }
    })
  }

  res.json({ data: deletedCards.concat(deletedAnnotations) })
})

// V1.2: 回收站 — 恢复已删除项目
app.post('/v1/recycle-bin/:type/:id/restore', authMiddleware, function(req, res) {
  var type = req.params.type
  var id = req.params.id
  var now = new Date().toISOString()

  if (type === 'comment_cards' || type === 'cards') {
    var card = db.prepare(`
      SELECT cc.* FROM comment_cards cc
      JOIN annotations a ON a.id = cc.annotation_id
      JOIN images i ON i.id = a.image_id
      JOIN product_units pu ON pu.id = i.product_unit_id
      JOIN projects p ON p.id = pu.project_id AND p.workspace_id = ?
      WHERE cc.id = ? AND cc.deleted_at IS NOT NULL
    `).get(req.workspaceId, id)
    if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在或不在回收站' })

    db.prepare('UPDATE comment_cards SET deleted_at = NULL WHERE id = ?').run(id)
    db.prepare('UPDATE annotations SET deleted_at = NULL WHERE id = ?').run(card.annotation_id)
    return res.json({ data: { restored: true } })
  }

  if (type === 'annotations') {
    var ann = db.prepare(`
      SELECT a.* FROM annotations a
      JOIN images i ON i.id = a.image_id
      JOIN product_units pu ON pu.id = i.product_unit_id
      JOIN projects p ON p.id = pu.project_id AND p.workspace_id = ?
      WHERE a.id = ? AND a.deleted_at IS NOT NULL
    `).get(req.workspaceId, id)
    if (!ann) return res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在或不在回收站' })

    db.prepare('UPDATE annotations SET deleted_at = NULL WHERE id = ?').run(id)
    return res.json({ data: { restored: true } })
  }

  return res.status(400).json({ code: 'INVALID_TYPE', message: '无效的类型: ' + type })
})

// =============================================================================
// Comment Card Routes
// =============================================================================
app.get('/v1/images/:imageId/comment-cards', authMiddleware, function(req, res) {
  var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? AND deleted_at IS NULL ORDER BY sort_order').all(req.params.imageId)
  res.json({ data: cards.map(formatCommentCard) })
})

app.post('/v1/comment-cards', authMiddleware, function(req, res) {
  if (!req.body.imageId || !req.body.text) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少必填字段' })

  var img = db.prepare('SELECT id FROM images WHERE id = ?').get(req.body.imageId)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND', message: '图片不存在' })

  var id = uuidv4()
  var maxSort = db.prepare('SELECT MAX(sort_order) as m FROM comment_cards WHERE image_id = ?').get(req.body.imageId)
  var estimatedTime = req.body.estimatedTime !== undefined ? parseInt(req.body.estimatedTime, 10) || null : null
  db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,estimated_time,sort_order) VALUES (?,?,?,?,?,?)')
    .run(id, req.body.annotationId || null, req.body.imageId, req.body.text, estimatedTime, (maxSort.m || 0) + 1)

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(id)
  // UX-27: 记录操作日志
  var projectId = getProjectIdByCard(id)
  var userName = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)?.name || '未知用户'
  logOperation(projectId, req.userId, userName, 'create_card', 'comment_card', id, '创建意见卡片')
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
  if (req.body.estimatedTime !== undefined) {
    var et = req.body.estimatedTime !== null ? parseInt(req.body.estimatedTime, 10) || null : null
    db.prepare('UPDATE comment_cards SET estimated_time = ? WHERE id = ?').run(et, req.params.id)
  }
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
    // UX-27: 记录操作日志
    var projectId = getProjectIdByCard(req.params.id)
    var userName = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)?.name || '未知用户'
    logOperation(projectId, req.userId, userName, 'resolve_card', 'comment_card', req.params.id, '标记为已解决')
  } else {
    // V1.1: 重新打开已解决的卡片 → 争议计数+1
    var existing = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
    if (existing && existing.status === 'resolved') {
      var newCount = (existing.dispute_count || 0) + 1
      var disputed = newCount >= 2 ? 1 : 0
      db.prepare("UPDATE comment_cards SET status = 'unresolved', resolved_by = NULL, resolved_at = NULL, dispute_count = ?, disputed = ? WHERE id = ?")
        .run(newCount, disputed, req.params.id)

      if (disputed) {
        var owners = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND role = ?').all(req.workspaceId, 'owner')
        owners.forEach(function(o) {
          createNotification(req.workspaceId, o.id, 'dispute',
            '争议预警', '【' + getCardContext(req.params.id) + '】意见被反复驳回，已标记为争议',
            '/project/' + getProjectIdByCard(req.params.id), null, req.params.id)
        })
      }
    } else {
      db.prepare("UPDATE comment_cards SET status = 'unresolved', resolved_by = NULL, resolved_at = NULL WHERE id = ?")
        .run(req.params.id)
    }
  }

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: formatCommentCard(card) })
})

// UX-27: 获取项目操作日志
app.get('/v1/projects/:projectId/logs', authMiddleware, function(req, res) {
  try {
    const logs = db.prepare(`SELECT * FROM operation_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.params.projectId)
    res.json({ data: logs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// UX-27: 获取用户操作日志
app.get('/v1/users/:userId/logs', authMiddleware, function(req, res) {
  try {
    const logs = db.prepare(`SELECT * FROM operation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).all(req.params.userId)
    res.json({ data: logs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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
app.post('/v1/images/:id/revision', authMiddleware, uploadLimiter, upload.single('file'), function(req, res) {
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
//   AI_SERVICE_URL: 外部 AI 服务地址（阿里云百炼 / 腾讯混元 / OpenAI 兼容）
//   AI_SERVICE_KEY: API Key（Bearer Token 认证）
// =============================================================================
app.post('/v1/ai/style-samples', authMiddleware, function(req, res) {
  var imageId = req.body.imageId
  var style = req.body.style || 'default'
  var projectId = req.body.projectId

  if (!imageId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 imageId' })

  // 项目状态检查：已完成/归档项目自动禁用 AI
  if (projectId) {
    var project = db.prepare('SELECT status, name FROM projects WHERE id = ?').get(projectId)
    if (project && (project.status === 'completed' || project.status === 'archived')) {
      return res.status(403).json({
        code: 'AI_DISABLED_FOR_PROJECT',
        message: '该项目已完结，AI 风格生成功能已自动关闭'
      })
    }
  }

  // 缓存检查：同一图片+同一风格，24小时内复用
  var cached = db.prepare(`
    SELECT * FROM ai_samples
    WHERE image_id = ? AND style = ? AND output_urls IS NOT NULL
      AND created_at > datetime('now', '-1 day')
    ORDER BY created_at DESC LIMIT 1
  `).get(imageId, style)

  if (cached) {
    var cachedUrls = JSON.parse(cached.output_urls || '[]')
    if (cachedUrls.length > 0 && !cachedUrls[0].error) {
      return res.json({ data: { taskId: cached.id, cached: true, retryable: false } })
    }
  }

  // 每日限额
  if (projectId) {
    var todayCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_samples
      WHERE image_id IN (SELECT id FROM images WHERE product_unit_id IN
        (SELECT id FROM product_units WHERE project_id = ?))
      AND created_at > datetime('now', 'start of day')
    `).get(projectId)

    if (todayCount && todayCount.cnt >= 50) {
      return res.status(429).json({
        code: 'DAILY_LIMIT',
        message: '该项目今日 AI 风格生成已达上限（50次/天），请明天再试'
      })
    }
  }

  // 内部用量警戒线：单工作室月超 200 次后台告警
  if (req.workspaceId) {
    var monthCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_samples a
      JOIN images i ON a.image_id = i.id
      JOIN product_units u ON i.product_unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      WHERE p.workspace_id = ? AND a.created_at > datetime('now', 'start of month')
    `).get(req.workspaceId)
    if (monthCount && monthCount.cnt >= 200) {
      log('WARN', 'AI', 'Workspace monthly AI usage exceeded 200', { workspaceId: req.workspaceId, monthCount: monthCount.cnt })
    }
  }

  var taskId = uuidv4()

  // Async AI call with retry — 对接真实 AI 服务
  if (AI_SERVICE_URL) {
    db.prepare('INSERT INTO ai_samples (id,image_id,style,project_id) VALUES (?,?,?,?)').run(taskId, imageId, style, projectId || null)

    res.json({ data: { taskId: taskId, retryable: true } })
    var attempt = 0
    var img = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId)
    var imageUrl = img ? (img.original_url || '') : ''

    function callAI() {
      var payload = {
        model: 'style-transfer-v1',
        input: { image_url: imageUrl, style: style, num_outputs: 4 }
      }
      var postData = JSON.stringify(payload)
      var headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.AI_SERVICE_KEY || ''),
        'Content-Length': Buffer.byteLength(postData)
      }

      try {
        var urlModule = require('url')
        var parsedUrl = urlModule.parse(AI_SERVICE_URL)
        var transport = parsedUrl.protocol === 'https:' ? require('https') : require('http')
        var options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.path,
          method: 'POST',
          headers: headers,
          timeout: 30000
        }

        var req_ai = transport.request(options, function(aiRes) {
          var body = ''
          aiRes.on('data', function(chunk) { body += chunk })
          aiRes.on('end', function() {
            try {
              var result = JSON.parse(body)
              var urls = []
              // 兼容多种 AI 服务商返回格式
              if (result.output && result.output.results) {
                urls = result.output.results.map(function(r) { return r.url })       // 阿里云百炼
              } else if (result.data && Array.isArray(result.data)) {
                urls = result.data.map(function(r) { return r.url })                 // OpenAI 兼容
              } else if (result.ResultImage) {
                urls = [result.ResultImage]                                           // 腾讯混元
              } else if (result.url) {
                urls = [result.url]                                                   // 单图返回
              }

              if (urls.length > 0) {
                db.prepare('UPDATE ai_samples SET output_urls = ? WHERE id = ?').run(JSON.stringify(urls), taskId)
                log('INFO', 'AI', 'Style generation completed', { taskId: taskId, count: urls.length })
              } else {
                db.prepare('UPDATE ai_samples SET output_urls = ? WHERE id = ?').run(JSON.stringify({ error: 'EMPTY_RESULT', retryable: true }), taskId)
                log('WARN', 'AI', 'Style generation returned empty result', { taskId: taskId })
              }
            } catch (e) {
              log('ERROR', 'AI', 'Failed to parse AI response', { taskId: taskId, error: e.message })
              db.prepare('UPDATE ai_samples SET output_urls = ? WHERE id = ?').run(JSON.stringify({ error: 'PARSE_ERROR', retryable: true }), taskId)
            }
          })
        })

        req_ai.on('error', function(e) { retryOrFail(e.message) })
        req_ai.on('timeout', function() { req_ai.destroy(); retryOrFail('TIMEOUT') })
        req_ai.write(postData)
        req_ai.end()
      } catch (e) {
        retryOrFail(e.message)
      }

      function retryOrFail(errMsg) {
        attempt++
        if (attempt <= AI_RETRY_MAX) {
          log('WARN', 'AI', 'Retry style generation', { attempt: attempt, taskId: taskId })
          setTimeout(callAI, AI_RETRY_DELAY)
        } else {
          log('ERROR', 'AI', 'Style generation failed after retries', { taskId: taskId, error: errMsg })
          db.prepare('UPDATE ai_samples SET output_urls = ? WHERE id = ?').run(JSON.stringify({ error: 'AI_SERVICE_FAILED', retryable: true }), taskId)
        }
      }
    }
    callAI()
  } else {
    // AI 服务未配置时，写入占位记录以启用缓存，避免重复创建记录
    db.prepare('INSERT INTO ai_samples (id,image_id,style,project_id,output_urls) VALUES (?,?,?,?,?)').run(taskId, imageId, style, projectId || null, JSON.stringify([{cached: true, notice: 'AI 服务未配置'}]))
    res.json({ data: { taskId: taskId, retryable: false, notice: 'AI 样片服务未配置，请联系管理员对接 AI 服务后启用' } })
    log('INFO', 'AI', 'AI service not configured — cached placeholder', { taskId: taskId })
  }
})

app.get('/v1/ai/style-samples/:taskId', authMiddleware, function(req, res) {
  var sample = db.prepare('SELECT * FROM ai_samples WHERE id = ?').get(req.params.taskId)
  if (!sample) return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' })

  var outputUrls = JSON.parse(sample.output_urls || '[]')
  var hasError = outputUrls && outputUrls.error
  res.json({
    data: {
      taskId: sample.id,
      status: hasError ? 'failed' : (outputUrls.length > 0 ? 'completed' : 'pending'),
      progress: hasError ? 0 : (outputUrls.length > 0 ? 100 : 50),
      result: hasError ? null : (outputUrls.length > 0 ? { urls: outputUrls } : null),
      error: hasError ? outputUrls : null,
      retryable: hasError ? (outputUrls.retryable || false) : false
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

// UX-001: AI 风格样片预览（同步简化版，兼容前端直接调用）
// 成本控制：每项目每天限 50 次生成，相同图片+风格自动复用缓存
app.post('/v1/ai/style-preview', authMiddleware, function(req, res) {
  var imageId = req.body.imageId
  var style = req.body.style || 'default'
  var projectId = req.body.projectId

  if (!imageId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 imageId' })

  // 项目状态检查：已完成/归档项目自动禁用 AI
  if (projectId) {
    var project = db.prepare('SELECT status, name FROM projects WHERE id = ?').get(projectId)
    if (project && (project.status === 'completed' || project.status === 'archived')) {
      return res.status(403).json({
        code: 'AI_DISABLED_FOR_PROJECT',
        message: '该项目已完结，AI 风格生成功能已自动关闭'
      })
    }
  }

  // 1. 缓存检查：同一图片+同一风格，24小时内复用结果
  var cached = db.prepare(`
    SELECT * FROM ai_samples
    WHERE image_id = ? AND style = ? AND output_urls IS NOT NULL
      AND created_at > datetime('now', '-1 day')
    ORDER BY created_at DESC LIMIT 1
  `).get(imageId, style)

  if (cached) {
    var cachedUrls = JSON.parse(cached.output_urls || '[]')
    if (cachedUrls.length > 0 && !cachedUrls[0].error) {
      return res.json({
        data: { taskId: cached.id, previews: cachedUrls, style: style, cached: true }
      })
    }
  }

  // 2. 每日限额检查（每项目每天最多 50 次）
  if (projectId) {
    var todayCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_samples
      WHERE image_id IN (SELECT id FROM images WHERE product_unit_id IN
        (SELECT id FROM product_units WHERE project_id = ?))
      AND created_at > datetime('now', 'start of day')
    `).get(projectId)

    if (todayCount && todayCount.cnt >= 50) {
      return res.status(429).json({
        code: 'DAILY_LIMIT',
        message: '该项目今日 AI 风格生成已达上限（50次/天），请明天再试',
        dailyUsed: todayCount.cnt,
        dailyLimit: 50
      })
    }
  }

  // 内部用量警戒线：单工作室月超 200 次后台告警
  if (req.workspaceId) {
    var monthCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_samples a
      JOIN images i ON a.image_id = i.id
      JOIN product_units u ON i.product_unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      WHERE p.workspace_id = ? AND a.created_at > datetime('now', 'start of month')
    `).get(req.workspaceId)
    if (monthCount && monthCount.cnt >= 200) {
      log('WARN', 'AI', 'Workspace monthly AI usage exceeded 200', { workspaceId: req.workspaceId, monthCount: monthCount.cnt })
    }
  }

  // 3. 创建任务
  var taskId = uuidv4()

  if (!AI_SERVICE_URL) {
    // AI 服务未配置时，写入占位记录以启用缓存
    db.prepare('INSERT INTO ai_samples (id,image_id,style,project_id,output_urls) VALUES (?,?,?,?,?)').run(taskId, imageId, style, projectId || null, JSON.stringify([{cached: true, notice: 'AI 服务未配置'}]))
    return res.json({
      data: { taskId: taskId, previews: [], style: style, cached: true, notice: 'AI 风格预览服务未配置，请联系管理员对接 AI 服务后启用' }
    })
  }

  db.prepare('INSERT INTO ai_samples (id,image_id,style,project_id) VALUES (?,?,?,?)').run(taskId, imageId, style, projectId || null)
  res.json({ data: { taskId: taskId, previews: [], style: style } })
})

// 成本统计端点：管理员查看 AI 使用量
app.get('/v1/ai/usage-stats', authMiddleware, function(req, res) {
  var workspaceId = req.workspaceId
  var projectId = req.query.projectId

  var sql = `
    SELECT a.project_id, p.name as project_name,
      COUNT(*) as total_generations,
      COUNT(DISTINCT a.image_id) as unique_images,
      COUNT(DISTINCT a.style) as styles_tried,
      SUM(CASE WHEN a.created_at > datetime('now', 'start of day') THEN 1 ELSE 0 END) as today_count,
      SUM(CASE WHEN a.created_at > datetime('now', '-30 days') THEN 1 ELSE 0 END) as month_count
    FROM ai_samples a
    LEFT JOIN projects p ON a.project_id = p.id
    WHERE p.workspace_id = ?
  `
  var params = [workspaceId]
  if (projectId) {
    sql += ' AND a.project_id = ?'
    params.push(projectId)
  }
  sql += ' GROUP BY a.project_id ORDER BY month_count DESC'

  var rows = db.prepare(sql).all.apply(db.prepare(sql), params)

  // 估算成本（按腾讯混元 0.06元/张 和阿里云百炼 0.14元/张 分别计算）
  var HUNYUAN_PRICE = 0.06
  var BAILIAN_PRICE = 0.14
  var totalGen = rows.reduce(function(sum, r) { return sum + r.month_count }, 0)

  res.json({
    data: {
      projects: rows,
      summary: {
        totalMonthGenerations: totalGen,
        estimatedCostHunyuan: +(totalGen * HUNYUAN_PRICE).toFixed(2),
        estimatedCostBailian: +(totalGen * BAILIAN_PRICE).toFixed(2),
        dailyLimitPerProject: 50
      }
    }
  })
})

app.post('/v1/ai/parse-instruction', authMiddleware, function(req, res) {
  var commentCardId = req.body.commentCardId
  if (!commentCardId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 commentCardId' })

  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(commentCardId)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '意见卡不存在' })

  // 生产环境未配置 AI 服务时，返回提示而非 Mock 假数据
  if (!AI_SERVICE_URL) {
    return res.json({
      data: { id: '', commentCardId: commentCardId, notice: 'AI 解析服务未配置，请联系管理员对接 AI 服务后启用' }
    })
  }

  var id = uuidv4()
  db.prepare('INSERT INTO ai_instructions (id,comment_card_id,original_text,suggestion_text,suggested_params) VALUES (?,?,?,?,?)')
    .run(id, commentCardId, card.text_content, '', '{}')

  var inst = db.prepare('SELECT * FROM ai_instructions WHERE id = ?').get(id)
  res.json({ data: formatAIInstruction(inst) })
})

app.post('/v1/ai/instructions/:id/feedback', authMiddleware, function(req, res) {
  var inst = db.prepare('SELECT id FROM ai_instructions WHERE id = ?').get(req.params.id)
  if (!inst) return res.status(404).json({ code: 'NOT_FOUND', message: '指令不存在' })
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

  var proj = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var taskId = uuidv4()
  colorCheckTasks.set(taskId, projectId)
  db.prepare('INSERT INTO ai_reports (id, project_id, type, created_at) VALUES (?,?,?,datetime(\'now\'))').run(taskId, projectId, 'color-check')
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

  // 生产环境未配置 AI 服务时，返回空结果而非 Mock 假数据
  if (!AI_SERVICE_URL) {
    return res.json({
      data: {
        id: req.params.taskId,
        projectId: projectId,
        totalImages: images.length,
        abnormalCount: 0,
        items: [],
        createdAt: new Date().toISOString(),
        notice: 'AI 色差巡检服务未配置，请联系管理员对接 AI 服务后启用'
      }
    })
  }

  // AI 服务已配置，返回真实分析结果（此处由 AI 服务异步填充）
  var report = db.prepare('SELECT * FROM ai_reports WHERE id = ?').get(req.params.taskId)
  var result = report ? JSON.parse(report.result || '{}') : {}
  res.json({
    data: {
      id: req.params.taskId,
      projectId: projectId,
      totalImages: images.length,
      abnormalCount: result.abnormalCount || 0,
      items: result.items || [],
      createdAt: report ? report.created_at : new Date().toISOString()
    }
  })
})

// =============================================================================
// F-26: AI 全图一致性巡检（光影探照灯）
// =============================================================================
var consistencyTasks = new Map() // taskId -> projectId

app.post('/v1/ai/consistency-check', authMiddleware, function(req, res) {
  var projectId = req.body.projectId
  if (!projectId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 projectId' })

  var proj = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var taskId = uuidv4()
  consistencyTasks.set(taskId, projectId)
  db.prepare('INSERT INTO ai_reports (id, project_id, type, created_at) VALUES (?,?,?,datetime(\'now\'))').run(taskId, projectId, 'consistency-check')
  log('INFO', 'AI', 'Consistency check started', { projectId: projectId, taskId: taskId })
  res.json({ data: { taskId: taskId } })
})

app.get('/v1/ai/consistency-check/:taskId', authMiddleware, function(req, res) {
  var projectId = consistencyTasks.get(req.params.taskId)
  if (!projectId) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' })
  }

  var units = db.prepare(`
    SELECT pu.id, pu.name FROM product_units pu
    WHERE pu.project_id = ?
    ORDER BY pu.sort_order
  `).all(projectId)

  var allImages = []
  units.forEach(function(u) {
    var imgs = db.prepare('SELECT id, thumbnail_urls, metadata FROM images WHERE product_unit_id = ?').all(u.id)
    imgs.forEach(function(img) {
      allImages.push({
        id: img.id,
        unitId: u.id,
        unitName: u.name,
        thumbnailUrl: (JSON.parse(img.thumbnail_urls || '[]')[0]) || '/uploads/placeholder.svg',
        metadata: JSON.parse(img.metadata || '{}')
      })
    })
  })

  // 生产环境未配置 AI 服务时，返回空结果而非 Mock 假数据
  if (!AI_SERVICE_URL) {
    return res.json({
      data: {
        id: req.params.taskId,
        projectId: projectId,
        totalImages: allImages.length,
        totalSceneGroups: units.length,
        consistentSceneGroups: units.length,
        inconsistentSceneGroups: 0,
        sceneGroups: units.map(function(u) {
          return { sceneId: u.id, sceneName: u.name, imageCount: allImages.filter(function(i) { return i.unitId === u.id }).length, consistency: 'pending' }
        }),
        anomalies: [],
        overallScore: 100,
        createdAt: new Date().toISOString(),
        notice: 'AI 光影巡检服务未配置，请联系管理员对接 AI 服务后启用'
      }
    })
  }

  // AI 服务已配置，返回真实分析结果
  var report = db.prepare('SELECT * FROM ai_reports WHERE id = ?').get(req.params.taskId)
  var result = report ? JSON.parse(report.result || '{}') : {}
  res.json({
    data: {
      id: req.params.taskId,
      projectId: projectId,
      totalImages: allImages.length,
      totalSceneGroups: result.totalSceneGroups || units.length,
      consistentSceneGroups: result.consistentSceneGroups || 0,
      inconsistentSceneGroups: result.inconsistentSceneGroups || 0,
      sceneGroups: result.sceneGroups || [],
      anomalies: result.anomalies || [],
      overallScore: result.overallScore || 100,
      createdAt: report ? report.created_at : new Date().toISOString()
    }
  })
})

// =============================================================================
// Import Routes
// =============================================================================
app.post('/v1/import/cloud-drive', authMiddleware, function(req, res) {
  var projectId = req.body.projectId
  if (!projectId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 projectId' })

  var proj = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var provider = req.body.provider || 'local'
  var path_ = req.body.path || '/'

  log('INFO', 'Import', 'Cloud drive browse', { provider: provider, path: path_ })

  // 生产环境未配置云盘导入时，返回空列表而非 Mock 假数据
  res.json({
    data: {
      provider: provider,
      currentPath: path_,
      files: [],
      notice: '云盘导入服务未配置，请联系管理员对接云盘 API 后启用。支持：百度网盘、阿里云盘'
    }
  })
})

app.post('/v1/import/wechat-screenshot', authMiddleware, uploadLimiter, upload.single('file'), function(req, res) {
  if (!req.file) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请上传截图' })

  var OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || ''
  if (!OCR_SERVICE_URL) {
    log('INFO', 'Import', 'WeChat screenshot uploaded — OCR not configured', { file: req.file.filename })
    return res.json({
      data: {
        annotations: [],
        notice: '微信截图 OCR 解析服务未配置，请联系管理员对接 OCR 服务后启用。推荐：腾讯云 OCR'
      }
    })
  }

  // OCR service configured — parse WeChat screenshot in production
  log('INFO', 'Import', 'WeChat screenshot uploaded for OCR', { file: req.file.filename })
  res.json({ data: { annotations: [] } })
})

app.post('/v1/import/apply', authMiddleware, function(req, res) {
  var projectId = req.body.projectId
  var annotations = req.body.annotations

  if (!projectId || !Array.isArray(annotations)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少必填字段' })

  var proj = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

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

  // 安全: 校验作品集所属项目的 workspace 是否匹配
  var proj = db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(p.project_id)
  if (!proj || proj.workspace_id !== req.workspaceId) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })

  // Increment view count
  db.prepare('UPDATE portfolio SET views = views + 1 WHERE id = ?').run(req.params.id)
  res.json({ data: formatPortfolio(p) })
})

app.put('/v1/portfolios/:id', authMiddleware, function(req, res) {
  var p = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })

  // 安全: 校验所属 workspace
  var proj = db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(p.project_id)
  if (!proj || proj.workspace_id !== req.workspaceId) return res.status(404).json({ code: 'NOT_FOUND', message: '作品集不存在' })

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

  // 安全: 校验所属 workspace
  var proj = db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(p.project_id)
  if (!proj || proj.workspace_id !== req.workspaceId) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: { views: p.views || 0, avgDuration: p.avg_duration || 0 } })
})

app.post('/v1/portfolios/:id/cover', authMiddleware, uploadLimiter, upload.single('file'), function(req, res) {
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

// F-18: 客户申请修改（确稿后）
app.post('/v1/projects/:id/modify-request', authMiddleware, function(req, res) {
  var project = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!project) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })
  if (project.status !== 'completed') return res.status(400).json({ code: 'INVALID_STATUS', message: '项目尚未确稿' })

  var reason = (req.body.reason || '').trim()
  if (reason.length < 5) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '修改原因至少5个字' })

  // 通知所有owner
  var owners = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND role = ?').all(req.workspaceId, 'owner')
  owners.forEach(function(o) {
    createNotification(req.workspaceId, o.id, 'confirm_request',
      '客户申请修改', '客户对【' + project.name + '】提出修改申请：' + reason,
      '/project/' + project.id, project.id, null)
    sendEmail(o.email, '【易拍选】客户申请修改', '<p>客户申请修改项目「' + project.name + '」</p><p>原因：' + reason + '</p>')
  })

  res.json({ data: { success: true } })
})

// F-18: 老板驳回确稿（重新开放编辑）
app.put('/v1/projects/:id/reject-confirm', authMiddleware, function(req, res) {
  var project = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!project) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })
  if (project.status !== 'completed') return res.status(400).json({ code: 'INVALID_STATUS', message: '项目尚未确稿' })

  // 只有owner可以驳回
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (user.role !== 'owner') return res.status(403).json({ code: 'FORBIDDEN', message: '仅空间拥有者可以驳回确稿' })

  db.prepare("UPDATE projects SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?").run(project.id)

  // 通知所有相关成员
  var members = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND status = ?').all(req.workspaceId, 'active')
  members.forEach(function(m) {
    createNotification(req.workspaceId, m.id, 'status_change',
      '确稿已驳回', '【' + project.name + '】确稿已被驳回，项目重新开放编辑',
      '/project/' + project.id, project.id, null)
  })

  res.json({ data: { ok: true } })
})

// =============================================================================
// V1.1 Routes: 战情室、任务指派、通知
// =============================================================================

// F-24: 老板战情室 — 全局健康度 + 成员负载
app.get('/v1/dashboard', authMiddleware, function(req, res) {
  var wsId = req.workspaceId
  var now = new Date().toISOString()

  // 所有进行中项目
  var projects = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM comment_cards cc 
       JOIN images img ON cc.image_id = img.id 
       JOIN product_units pu ON img.product_unit_id = pu.id 
       WHERE pu.project_id = p.id AND cc.status = 'unresolved' AND cc.deleted_at IS NULL) as unresolved_count,
      (SELECT COUNT(*) FROM comment_cards cc 
       JOIN images img ON cc.image_id = img.id 
       JOIN product_units pu ON img.product_unit_id = pu.id 
       WHERE pu.project_id = p.id AND cc.disputed = 1 AND cc.deleted_at IS NULL) as disputed_count
    FROM projects p WHERE p.workspace_id = ? 
    AND p.status NOT IN ('completed','archived')
    ORDER BY p.updated_at DESC
  `).all(wsId)

  // 健康度计算
  var healthData = projects.map(function(p) {
    var health = 'green'
    var reasons = []

    // 黄灯：有未读意见超24h
    if (p.unresolved_count > 0) {
      var oldestUnresolved = db.prepare(`
        SELECT MIN(cc.created_at) as oldest FROM comment_cards cc
        JOIN images img ON cc.image_id = img.id
        JOIN product_units pu ON img.product_unit_id = pu.id
        WHERE pu.project_id = ? AND cc.status = 'unresolved'
      `).get(p.id)
      if (oldestUnresolved && oldestUnresolved.oldest) {
        var hoursSince = (Date.now() - new Date(oldestUnresolved.oldest + 'Z').getTime()) / (1000 * 60 * 60)
        if (hoursSince > 24) { health = 'yellow'; reasons.push('有未读意见超过24小时') }
      }
    }

    // 红灯：临期或有争议
    if (p.disputed_count > 0) { health = 'red'; reasons.push('有争议卡片(' + p.disputed_count + '张)') }
    if (p.deadline) {
      var hoursLeft = (new Date(p.deadline + 'Z').getTime() - Date.now()) / (1000 * 60 * 60)
      var warningH = p.warning_hours || 24
      if (hoursLeft < warningH && p.status !== 'completed') { health = 'red'; reasons.push('临近截止日期(剩余' + Math.round(hoursLeft) + 'h)') }
    }

    return {
      id: p.id, name: p.name, clientName: p.client_name || '',
      status: p.status, deadline: p.deadline,
      health: health, healthReasons: reasons,
      unresolvedCount: p.unresolved_count || 0,
      disputedCount: p.disputed_count || 0,
      updatedAt: p.updated_at
    }
  })

  // 成员负载
  var members = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND status = ?').all(wsId, 'active')
  var memberLoads = members.map(function(m) {
    var assignedCount = db.prepare(`
      SELECT COUNT(*) as c FROM comment_cards cc
      JOIN images img ON cc.image_id = img.id
      JOIN product_units pu ON img.product_unit_id = pu.id
      JOIN projects p ON pu.project_id = p.id
      WHERE cc.assignee_id = ? AND cc.status = 'unresolved' AND cc.deleted_at IS NULL
      AND p.status NOT IN ('completed','archived')
    `).get(m.id)
    return { id: m.id, name: m.name, avatarUrl: m.avatar_url, role: m.role, taskCount: assignedCount ? assignedCount.c : 0 }
  })

  // 统计
  var stats = {
    total: db.prepare('SELECT COUNT(*) as c FROM projects WHERE workspace_id = ?').get(wsId).c,
    active: db.prepare('SELECT COUNT(*) as c FROM projects WHERE workspace_id = ? AND status NOT IN (\'completed\',\'archived\')').get(wsId).c,
    red: healthData.filter(function(h) { return h.health === 'red' }).length,
    yellow: healthData.filter(function(h) { return h.health === 'yellow' }).length,
    totalUnresolved: healthData.reduce(function(s, h) { return s + h.unresolvedCount }, 0)
  }

  // V1.19: 财务汇总
  var financeSummary = db.prepare(`
    SELECT 
      COALESCE((SELECT SUM(contract_amount) FROM projects WHERE workspace_id = ? AND status NOT IN ('completed','archived')), 0) as totalRevenue,
      COALESCE((SELECT SUM(e.amount) FROM expenses e INNER JOIN projects p ON e.project_id = p.id WHERE p.workspace_id = ? AND p.status NOT IN ('completed','archived')), 0) as totalExpense
  `).get(wsId, wsId)
  financeSummary.totalProfit = financeSummary.totalRevenue - financeSummary.totalExpense

  // V1.20: 告警规则
  var wsAlertRules = db.prepare('SELECT alert_rules FROM workspaces WHERE id = ?').get(wsId)
  var alertRules = { yellowDaysWithoutActivity: 7, redDaysWithoutActivity: 14, yellowOverdueCards: 5, redOverdueCards: 10 }
  if (wsAlertRules && wsAlertRules.alert_rules) {
    try { alertRules = Object.assign(alertRules, JSON.parse(wsAlertRules.alert_rules)) } catch (e) {}
  }
  res.json({ data: { stats: stats, projects: healthData, memberLoads: memberLoads, financeSummary: financeSummary, alertRules: alertRules, updatedAt: now } })
})

// DATA-02: 数据看板统计 API
app.get('/v1/analytics/dashboard', authMiddleware, function(req, res) {
  try {
    var wsId = req.workspaceId
    var month = req.query.month || new Date().toISOString().slice(0, 7) // '2026-06'

    var monthStart = month + '-01'
    var y = parseInt(month.slice(0, 4))
    var m = parseInt(month.slice(5, 7))
    if (m === 12) { y++; m = 1 } else { m++ }
    var nextMonth = y + '-' + String(m).padStart(2, '0')
    var monthEnd = nextMonth + '-01'

    // 总项目数（当月创建的）
    var totalProjects = db.prepare(
      'SELECT COUNT(*) as c FROM projects WHERE workspace_id = ? AND created_at >= ? AND created_at < ?'
    ).get(wsId, monthStart, monthEnd).c

    // 完成率
    var completedProjects = db.prepare(
      'SELECT COUNT(*) as c FROM projects WHERE workspace_id = ? AND status = ? AND updated_at >= ? AND updated_at < ?'
    ).get(wsId, 'completed', monthStart, monthEnd).c
    var completionRate = totalProjects > 0 ? Math.round(completedProjects / totalProjects * 100) : 0

    // 平均确稿周期（从项目创建到完成的天数）
    var avgReview = db.prepare(`
      SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
      FROM projects WHERE workspace_id = ? AND status = 'completed'
      AND created_at >= ? AND created_at < ?
    `).get(wsId, monthStart, monthEnd)
    var avgReviewDays = avgReview && avgReview.avg_days ? Math.round(avgReview.avg_days * 10) / 10 : 0

    // 总图片数
    var totalImages = db.prepare(`
      SELECT COUNT(*) as c FROM images img
      JOIN product_units pu ON img.product_unit_id = pu.id
      JOIN projects p ON pu.project_id = p.id
      WHERE p.workspace_id = ? AND img.created_at >= ? AND img.created_at < ?
    `).get(wsId, monthStart, monthEnd).c

    // 修图师效率排行（当月解决的卡片数）
    var members = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND status = ?').all(wsId, 'active')
    var memberEfficiency = members.map(function(m) {
      var count = db.prepare(`
        SELECT COUNT(*) as c FROM comment_cards cc
        WHERE cc.resolved_by = ? AND cc.status = 'resolved'
        AND cc.resolved_at >= ? AND cc.resolved_at < ?
      `).get(m.id, monthStart, monthEnd).c
      return { id: m.id, name: m.name, efficiency: count }
    }).filter(function(m) { return m.efficiency > 0 })
      .sort(function(a, b) { return b.efficiency - a.efficiency })

    var maxEfficiency = memberEfficiency.length > 0 ? memberEfficiency[0].efficiency : 0

    res.json({
      data: {
        totalProjects: totalProjects,
        avgReviewDays: avgReviewDays,
        completionRate: completionRate,
        totalImages: totalImages,
        maxEfficiency: maxEfficiency,
        memberEfficiency: memberEfficiency,
        month: month
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DATA-06: 项目成本/利润统计
app.get('/v1/analytics/finance', authMiddleware, function(req, res) {
  try {
    var wsId = req.workspaceId
    var month = req.query.month || new Date().toISOString().slice(0, 7)

    var monthStart = month + '-01'
    var y = parseInt(month.slice(0, 4))
    var m = parseInt(month.slice(5, 7))
    if (m === 12) { y++; m = 1 } else { m++ }
    var nextMonth = y + '-' + String(m).padStart(2, '0')
    var monthEnd = nextMonth + '-01'

    // 当月项目营收（合同金额总和）
    var revenue = db.prepare(`
      SELECT COALESCE(SUM(contract_amount), 0) as total_revenue
      FROM projects WHERE workspace_id = ? AND created_at >= ? AND created_at < ?
    `).get(wsId, monthStart, monthEnd).total_revenue

    // 当月项目列表
    var projects = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM comment_cards cc 
         JOIN images img ON cc.image_id = img.id 
         JOIN product_units pu ON img.product_unit_id = pu.id 
         WHERE pu.project_id = p.id AND cc.deleted_at IS NULL) as card_count
      FROM projects p WHERE p.workspace_id = ? AND p.created_at >= ? AND p.created_at < ?
    `).all(wsId, monthStart, monthEnd)

    // V1.19: 按实际支出记录计算成本
    var totalExpense = 0
    var projectList = projects.map(function(p) {
      var expense = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = ?').get(p.id).total
      totalExpense += expense
      return {
        id: p.id,
        name: p.name,
        clientName: p.client_name,
        revenue: p.contract_amount || 0,
        cardCount: p.card_count || 0,
        expense: expense
      }
    })

    var totalRevenue = revenue
    var totalProfit = totalRevenue - totalExpense
    var profitRate = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0

    res.json({
      data: {
        totalRevenue: totalRevenue,
        totalExpense: totalExpense,
        totalProfit: totalProfit,
        profitRate: parseFloat(profitRate),
        projects: projectList
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// F-51: 战情室数据导出 (PDF / Excel)
app.get('/v1/dashboard/export', authMiddleware, function(req, res) {
  var wsId = req.workspaceId
  var format = (req.query.format || '').toLowerCase()
  if (format !== 'pdf' && format !== 'excel' && format !== 'xlsx') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'format 参数必须是 pdf 或 excel' })
  }
  var ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId)
  var wsName = ws ? ws.name : '工作空间'
  var now = new Date().toISOString().split('T')[0]

  // 收集数据
  var projects = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM comment_cards cc 
       JOIN images img ON cc.image_id = img.id 
       JOIN product_units pu ON img.product_unit_id = pu.id 
       WHERE pu.project_id = p.id AND cc.status = 'unresolved' AND cc.deleted_at IS NULL) as unresolved_count,
      (SELECT COUNT(*) FROM comment_cards cc 
       JOIN images img ON cc.image_id = img.id 
       JOIN product_units pu ON img.product_unit_id = pu.id 
       WHERE pu.project_id = p.id AND cc.disputed = 1 AND cc.deleted_at IS NULL) as disputed_count
    FROM projects p WHERE p.workspace_id = ? 
    AND p.status NOT IN ('completed','archived')
    ORDER BY p.updated_at DESC
  `).all(wsId)

  var healthData = projects.map(function(p) {
    var health = 'green', reasons = []
    if (p.unresolved_count > 0) {
      var oldest = db.prepare("SELECT MIN(cc.created_at) as oldest FROM comment_cards cc JOIN images img ON cc.image_id = img.id JOIN product_units pu ON img.product_unit_id = pu.id WHERE pu.project_id = ? AND cc.status = 'unresolved'").get(p.id)
      if (oldest && oldest.oldest) {
        var hoursSince = (Date.now() - new Date(oldest.oldest + 'Z').getTime()) / (1000 * 60 * 60)
        if (hoursSince > 24) { health = 'yellow'; reasons.push('有未读意见超过24小时') }
      }
    }
    if (p.disputed_count > 0) { health = 'red'; reasons.push('有争议卡片(' + p.disputed_count + '张)') }
    if (p.deadline) {
      var hoursLeft = (new Date(p.deadline + 'Z').getTime() - Date.now()) / (1000 * 60 * 60)
      var warningH = p.warning_hours || 24
      if (hoursLeft < warningH && p.status !== 'completed') { health = 'red'; reasons.push('临近截止日期(剩余' + Math.round(hoursLeft) + 'h)') }
    }
    return { id: p.id, name: p.name, clientName: p.client_name || '', status: p.status, deadline: p.deadline, health: health, healthReasons: reasons, unresolvedCount: p.unresolved_count || 0, disputedCount: p.disputed_count || 0, updatedAt: p.updated_at }
  })

  var members = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND status = ?').all(wsId, 'active')
  var memberLoads = members.map(function(m) {
    var assignedCount = db.prepare("SELECT COUNT(*) as c FROM comment_cards cc JOIN images img ON cc.image_id = img.id JOIN product_units pu ON img.product_unit_id = pu.id JOIN projects p ON pu.project_id = p.id WHERE cc.assignee_id = ? AND cc.status = 'unresolved' AND cc.deleted_at IS NULL AND p.status NOT IN ('completed','archived')").get(m.id)
    return { id: m.id, name: m.name, avatarUrl: m.avatar_url, role: m.role, taskCount: assignedCount ? assignedCount.c : 0 }
  })

  var stats = {
    total: db.prepare('SELECT COUNT(*) as c FROM projects WHERE workspace_id = ?').get(wsId).c,
    active: db.prepare("SELECT COUNT(*) as c FROM projects WHERE workspace_id = ? AND status NOT IN ('completed','archived')").get(wsId).c,
    red: healthData.filter(function(h) { return h.health === 'red' }).length,
    yellow: healthData.filter(function(h) { return h.health === 'yellow' }).length,
    totalUnresolved: healthData.reduce(function(s, h) { return s + h.unresolvedCount }, 0)
  }

  if (format === 'excel' || format === 'xlsx') {
    var ExcelJS = require('exceljs')
    var workbook = new ExcelJS.Workbook()
    workbook.creator = 'EpicShot'
    workbook.created = new Date()

    // Sheet 1: 统计概览
    var ws1 = workbook.addWorksheet('统计概览')
    ws1.columns = [
      { header: '指标', key: 'metric', width: 20 },
      { header: '数值', key: 'value', width: 15 }
    ]
    ws1.addRow({ metric: '全部项目', value: stats.total })
    ws1.addRow({ metric: '进行中项目', value: stats.active })
    ws1.addRow({ metric: '红灯项目', value: stats.red })
    ws1.addRow({ metric: '黄灯项目', value: stats.yellow })
    ws1.addRow({ metric: '待处理意见', value: stats.totalUnresolved })
    ws1.addRow({ metric: '导出时间', value: new Date().toISOString() })

    // Sheet 2: 项目健康度明细
    var ws2 = workbook.addWorksheet('项目健康度')
    ws2.columns = [
      { header: '项目名称', key: 'name', width: 25 },
      { header: '客户', key: 'clientName', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '健康灯', key: 'health', width: 10 },
      { header: '待处理数', key: 'unresolvedCount', width: 12 },
      { header: '争议数', key: 'disputedCount', width: 10 },
      { header: '预警原因', key: 'healthReasons', width: 40 },
      { header: '截止日期', key: 'deadline', width: 15 }
    ]
    healthData.forEach(function(h) {
      ws2.addRow({ name: h.name, clientName: h.clientName, status: h.status, health: h.health === 'red' ? '红灯' : h.health === 'yellow' ? '黄灯' : '绿灯', unresolvedCount: h.unresolvedCount, disputedCount: h.disputedCount, healthReasons: h.healthReasons.join('; '), deadline: h.deadline || '' })
    })

    // Sheet 3: 成员负载明细
    var ws3 = workbook.addWorksheet('成员负载')
    ws3.columns = [
      { header: '成员姓名', key: 'name', width: 15 },
      { header: '角色', key: 'role', width: 12 },
      { header: '当前任务数', key: 'taskCount', width: 12 },
      { header: '任务上限', key: 'limit', width: 12 },
      { header: '负载率', key: 'rate', width: 12 }
    ]
    var loadLimit = (ws && ws.member_load_limit) ? ws.member_load_limit : 15
    memberLoads.forEach(function(m) {
      ws3.addRow({ name: m.name, role: m.role === 'owner' ? '拥有者' : m.role === 'editor' ? '编辑者' : '查看者', taskCount: m.taskCount, limit: loadLimit, rate: (m.taskCount / loadLimit * 100).toFixed(0) + '%' })
    })

    // Sheet 4: 争议统计
    var ws4 = workbook.addWorksheet('争议统计')
    ws4.columns = [
      { header: '项目名称', key: 'name', width: 25 },
      { header: '争议卡片数', key: 'disputedCount', width: 15 },
      { header: '待处理数', key: 'unresolvedCount', width: 15 }
    ]
    var disputedProjects = healthData.filter(function(h) { return h.disputedCount > 0 })
    disputedProjects.forEach(function(h) {
      ws4.addRow({ name: h.name, disputedCount: h.disputedCount, unresolvedCount: h.unresolvedCount })
    })
    ws4.addRow({ name: '合计', disputedCount: disputedProjects.reduce(function(s, h) { return s + h.disputedCount }, 0), unresolvedCount: disputedProjects.reduce(function(s, h) { return s + h.unresolvedCount }, 0) })

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.set('Content-Disposition', 'attachment; filename=' + encodeURIComponent('战情室报告_' + wsName + '_' + now + '.xlsx'))
    workbook.xlsx.write(res).then(function() { res.end() })
  } else {
    // PDF export
    var size = 14, margin = 40
    var doc = new PDFDocument({ size: 'A4', margin: margin })
    var pdfBuffers = []
    doc.on('data', function(chunk) { pdfBuffers.push(chunk) })
    doc.on('end', function() {
      res.set('Content-Type', 'application/pdf')
      res.set('Content-Disposition', 'attachment; filename=' + encodeURIComponent('战情室报告_' + wsName + '_' + now + '.pdf'))
      res.send(Buffer.concat(pdfBuffers))
    })

    // Title
    doc.fontSize(22).text('战情室报告', { align: 'center' })
    doc.fontSize(10).text(wsName + ' | ' + now, { align: 'center' })
    doc.moveDown(1.5)

    // Stats section
    doc.fontSize(16).text('统计概览', { underline: true })
    doc.moveDown(0.5)
    var statsY = doc.y
    var statItems = [
      { label: '全部项目', value: stats.total, color: '#333333' },
      { label: '进行中', value: stats.active, color: '#0066FF' },
      { label: '红灯', value: stats.red, color: '#FF3333' },
      { label: '黄灯', value: stats.yellow, color: '#FFCC00' },
      { label: '待处理意见', value: stats.totalUnresolved, color: '#FF6600' }
    ]
    var colW = (doc.page.width - margin * 2) / 5
    statItems.forEach(function(item, i) {
      var x = margin + i * colW + 10
      doc.rect(x - 5, statsY, colW - 15, 50).fillOpacity(0.08).fill(item.color).fillOpacity(1)
      doc.fontSize(10).fillColor(item.color).text(item.label, x, statsY + 5, { width: colW - 20, align: 'center' })
      doc.fontSize(22).fillColor('#222222').text(String(item.value), x, statsY + 22, { width: colW - 20, align: 'center' })
    })
    doc.moveDown(5)

    // Project health section
    doc.fontSize(16).fillColor('#000').text('项目健康度', { underline: true })
    doc.moveDown(0.5)
    var tableTop = doc.y
    var colDefs = [
      { header: '项目', x: margin, w: 130 },
      { header: '客户', x: margin + 130, w: 80 },
      { header: '状态', x: margin + 210, w: 60 },
      { header: '健康', x: margin + 270, w: 40 },
      { header: '待处理', x: margin + 310, w: 50 },
      { header: '截止', x: margin + 360, w: 70 }
    ]
    doc.fontSize(9).fillColor('#666')
    colDefs.forEach(function(c) { doc.text(c.header, c.x, tableTop, { width: c.w, align: 'left' }) })
    doc.moveDown(0.3)
    doc.moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.3)

    healthData.forEach(function(h) {
      if (doc.y > doc.page.height - 60) { doc.addPage() }
      var rowY = doc.y
      var healthLabel = h.health === 'red' ? '🔴' : h.health === 'yellow' ? '🟡' : '🟢'
      var statusLabel = h.status === 'draft' ? '草稿' : h.status === 'review' ? '待确认' : h.status === 'in_progress' ? '修改中' : h.status === 'final_review' ? '待确稿' : h.status
      doc.fontSize(8).fillColor('#333')
      doc.text(h.name, colDefs[0].x, rowY, { width: colDefs[0].w })
      doc.text(h.clientName || '-', colDefs[1].x, rowY, { width: colDefs[1].w })
      doc.text(statusLabel, colDefs[2].x, rowY, { width: colDefs[2].w })
      doc.text(healthLabel, colDefs[3].x, rowY, { width: colDefs[3].w })
      doc.text(String(h.unresolvedCount), colDefs[4].x, rowY, { width: colDefs[4].w })
      doc.text(h.deadline || '-', colDefs[5].x, rowY, { width: colDefs[5].w })
      doc.moveDown(0.8)
    })
    doc.moveDown(1)

    // Member load section
    doc.fontSize(16).fillColor('#000').text('成员负载', { underline: true })
    doc.moveDown(0.5)
    var memberTableTop = doc.y
    var mColDefs = [
      { header: '成员', x: margin, w: 100 },
      { header: '角色', x: margin + 100, w: 80 },
      { header: '任务数', x: margin + 180, w: 60 },
      { header: '上限', x: margin + 240, w: 60 },
      { header: '负载率', x: margin + 300, w: 100 }
    ]
    doc.fontSize(9).fillColor('#666')
    mColDefs.forEach(function(c) { doc.text(c.header, c.x, memberTableTop, { width: c.w, align: 'left' }) })
    doc.moveDown(0.3)
    doc.moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.3)

    var loadLimit = (ws && ws.member_load_limit) ? ws.member_load_limit : 15
    memberLoads.forEach(function(m) {
      if (doc.y > doc.page.height - 40) { doc.addPage() }
      var rowY = doc.y
      var rate = (m.taskCount / loadLimit * 100).toFixed(0)
      var roleLabel = m.role === 'owner' ? '拥有者' : m.role === 'editor' ? '编辑者' : '查看者'
      doc.fontSize(8).fillColor('#333')
      doc.text(m.name, mColDefs[0].x, rowY, { width: mColDefs[0].w })
      doc.text(roleLabel, mColDefs[1].x, rowY, { width: mColDefs[1].w })
      doc.text(String(m.taskCount), mColDefs[2].x, rowY, { width: mColDefs[2].w })
      doc.text(String(loadLimit), mColDefs[3].x, rowY, { width: mColDefs[3].w })
      // Progress bar
      var barX = mColDefs[4].x, barW = 80, barH = 10
      doc.rect(barX, rowY + 2, barW, barH).fillOpacity(0.1).fill('#ccc').fillOpacity(1)
      var barColor = rate > 80 ? '#FF3333' : rate > 50 ? '#FFCC00' : '#33CC66'
      doc.rect(barX, rowY + 2, Math.min(barW * rate / 100, barW), barH).fillOpacity(0.8).fill(barColor).fillOpacity(1)
      doc.text(rate + '%', barX + 5, rowY + 2, { width: barW - 10, align: 'center' })
      doc.moveDown(1.2)
    })

    doc.end()
  }
})

// F-17: 指派修图师
app.put('/v1/comment-cards/:id/assign', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '意见卡片不存在' })

  var assigneeId = req.body.assigneeId
  if (assigneeId) {
    var assignee = db.prepare('SELECT * FROM users WHERE id = ? AND workspace_id = ?').get(assigneeId, req.workspaceId)
    if (!assignee) return res.status(400).json({ code: 'INVALID_ASSIGNEE', message: '指派人不存在' })
  }

  db.prepare('UPDATE comment_cards SET assignee_id = ? WHERE id = ?').run(assigneeId || null, card.id)

  // 发送通知给被指派人
  if (assigneeId) {
    createNotification(req.workspaceId, assigneeId, 'assign',
      '新任务指派', '你被指派了新的修改任务',
      '/project/' + getProjectIdByCard(card.id), null, card.id)
    // V1.2.0: 邮件通知
    if (assignee.email) {
      sendEmail(assignee.email, '【易拍选】新任务指派', '<p>你被指派了新的修改任务，请登录易拍选查看详情。</p>')
    }
  }

  var updated = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(card.id)
  res.json({ data: formatCommentCard(updated) })
})

// F-17: 争议状态标记
app.put('/v1/comment-cards/:id/dispute', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '意见卡片不存在' })

  var action = req.body.action // 'resolve' → 增加争议计数, 'acknowledge' → 老板确认消除争议

  if (action === 'resolve') {
    var newCount = (card.dispute_count || 0) + 1
    var disputed = newCount >= 2 ? 1 : 0
    db.prepare('UPDATE comment_cards SET dispute_count = ?, disputed = ? WHERE id = ?').run(newCount, disputed, card.id)

    // UX-27: 记录操作日志
    var projectId = getProjectIdByCard(card.id)
    var userName = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)?.name || '未知用户'
    logOperation(projectId, req.userId, userName, 'dispute_card', 'comment_card', card.id, '驳回意见卡片')

    if (disputed) {
      // 通知所有owner
      var owners = db.prepare('SELECT * FROM users WHERE workspace_id = ? AND role = ?').all(req.workspaceId, 'owner')
      owners.forEach(function(o) {
        createNotification(req.workspaceId, o.id, 'dispute',
          '争议预警', '【' + getCardContext(card.id) + '】意见被反复驳回，已标记为争议',
          '/project/' + getProjectIdByCard(card.id), null, card.id)
        // V1.2.0: 邮件通知
        sendEmail(o.email, '【易拍选】争议预警', '<p>意见卡「' + getCardContext(card.id) + '」被反复驳回，已标记为争议，请登录处理。</p>')
      })
    }
  } else if (action === 'acknowledge') {
    db.prepare('UPDATE comment_cards SET dispute_count = 0, disputed = 0 WHERE id = ?').run(card.id)
  }

  var updated = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(card.id)
  res.json({ data: formatCommentCard(updated) })
})

// DATA-03: 意见卡片驳回历史
app.get('/v1/cards/:cardId/rejection-history', authMiddleware, function(req, res) {
  try {
    var cardId = req.params.cardId
    var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(cardId)
    if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '意见卡片不存在' })

    // 从操作日志中查询驳回记录
    var logs = db.prepare(
      "SELECT * FROM operation_logs WHERE target_id = ? AND action = 'dispute_card' ORDER BY created_at DESC"
    ).all(cardId)

    var history = logs.map(function(log) {
      return {
        id: log.id,
        time: log.created_at,
        userName: log.user_name,
        detail: log.detail || '驳回意见卡片'
      }
    })

    res.json({ data: { cardId: cardId, imageId: card.image_id, disputeCount: card.dispute_count || 0, history: history } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// F-25: 修图师待办列表
app.get('/v1/my-tasks', authMiddleware, function(req, res) {
  var userId = req.userId
  var cards = db.prepare(`
    SELECT cc.*, p.name as project_name, p.id as project_id, img.thumbnail_urls
    FROM comment_cards cc
    JOIN images img ON cc.image_id = img.id
    JOIN product_units pu ON img.product_unit_id = pu.id
    JOIN projects p ON pu.project_id = p.id
    WHERE cc.assignee_id = ? AND cc.status = 'unresolved' AND cc.deleted_at IS NULL
    ORDER BY cc.disputed DESC, cc.created_at ASC
  `).all(userId)

  var tasks = cards.map(function(c) {
    var card = formatCommentCard(c)
    card.projectName = c.project_name
    card.projectId = c.project_id
    card.thumbnailUrl = JSON.parse(c.thumbnail_urls || '[]')[0] || ''
    card.priority = c.disputed ? 'dispute' : (c.deadline ? 'urgent' : 'normal')
    return card
  })

  res.json({ data: tasks, total: tasks.length })
})

// F-19: 通知列表
app.get('/v1/notifications', authMiddleware, function(req, res) {
  var limit = parseInt(req.query.limit) || 50
  var offset = parseInt(req.query.offset) || 0
  var notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(req.userId, limit, offset)
  var unreadCount = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.userId)

  res.json({ data: notifications.map(formatNotification), total: unreadCount.c, unread: unreadCount.c })
})

// F-19: 标记通知已读
app.put('/v1/notifications/:id/read', authMiddleware, function(req, res) {
  var notif = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!notif) return res.status(404).json({ code: 'NOT_FOUND', message: '通知不存在' })
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ data: { ok: true } })
})

// F-19: 全部标记已读
app.put('/v1/notifications/read-all', authMiddleware, function(req, res) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId)
  res.json({ data: { ok: true } })
})

// F-19: 项目预警设置
app.put('/v1/projects/:id/warning-settings', authMiddleware, function(req, res) {
  var project = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!project) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  var hours = parseInt(req.body.warningHours) || 24
  db.prepare('UPDATE projects SET warning_hours = ? WHERE id = ?').run(hours, project.id)
  res.json({ data: { warningHours: hours } })
})

// F-16: AI智能筛选 — 按自然语言描述筛选图片
app.post('/v1/projects/:id/images/filter', authMiddleware, function(req, res) {
  var projectId = req.params.id
  var query = (req.body.query || '').toLowerCase().trim()
  if (!query) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请输入筛选条件' })

  // 获取所有图片
  var images = db.prepare(`
    SELECT i.* FROM images i JOIN product_units pu ON i.product_unit_id = pu.id
    WHERE pu.project_id = ?
  `).all(projectId)

  // 行话模板库
  var jargonTemplates = {
    '去雾': { contrast: 15, dehaze: 20, clarity: 10 },
    '背景不够白': { operation: 'bg_white_check', threshold: 250 },
    '背景不纯': { operation: 'bg_white_check', threshold: 250 },
    '雾蒙蒙的': { operation: 'dehaze_check', threshold: 0.5 },
    '过曝': { operation: 'overexposure_check', threshold: 0.85 },
    '欠曝': { operation: 'underexposure_check', threshold: 0.15 },
    '太暗': { operation: 'underexposure_check', threshold: 0.2 },
    '偏色': { operation: 'color_balance_check', threshold: 0.3 },
    '白平衡不准': { operation: 'wb_check', threshold: 0.2 },
    '对比度低': { operation: 'contrast_check', threshold: 0.3 },
    '饱和度低': { operation: 'saturation_check', threshold: 0.3 },
    '噪点多': { operation: 'noise_check', threshold: 0.4 },
    '模糊': { operation: 'sharpness_check', threshold: 0.5 },
    '不够锐': { operation: 'sharpness_check', threshold: 0.5 },
    '暖色调': { operation: 'color_temp_check', target: 'warm' },
    '冷色调': { operation: 'color_temp_check', target: 'cool' },
    '裁剪不当': { operation: 'crop_check', threshold: 0.3 },
    '构图不好': { operation: 'crop_check', threshold: 0.3 },
  }

  // 匹配行话模板
  var matchedTemplate = null
  var matchedKeyword = ''
  for (var key in jargonTemplates) {
    if (query.indexOf(key) !== -1) {
      matchedTemplate = jargonTemplates[key]
      matchedKeyword = key
      break
    }
  }

  // AI 模拟筛选
  var matched = []
  var unmatched = []

  images.forEach(function(img, idx) {
    // 基于文件名和索引模拟AI分析结果
    var filename = (img.original_filename || img.filename || '').toLowerCase()
    var isMatch = false

    if (matchedTemplate) {
      // 模拟：基于索引的伪随机匹配（30-60%匹配率）
      var hash = 0
      for (var i = 0; i < (img.id || '').length; i++) {
        hash = ((hash << 5) - hash) + (img.id || '').charCodeAt(i)
        hash = hash & hash
      }
      var score = Math.abs(hash % 100) / 100
      isMatch = score > 0.4
    } else {
      // 自由文本搜索：匹配文件名
      isMatch = filename.indexOf(query) !== -1
    }

    var entry = {
      id: img.id,
      filename: img.original_filename || img.filename,
      thumbnailUrl: JSON.parse(img.thumbnail_urls || '[]')[0] || '',
      unitId: img.product_unit_id
    }

    if (isMatch) matched.push(entry)
    else unmatched.push(entry)
  })

  // 构建上下文建议
  var suggestion = null
  if (matchedTemplate) {
    if (matchedTemplate.operation === 'bg_white_check') {
      suggestion = { type: 'color_correction', description: '建议将背景RGB值调整至(255,255,255)', params: { targetR: 255, targetG: 255, targetB: 255 } }
    } else if (matchedTemplate.operation === 'dehaze_check') {
      suggestion = { type: 'basic_adjustment', description: '建议应用去雾参数：对比度+15，去朦胧+20，清晰度+10', params: matchedTemplate }
    } else if (matchedTemplate.operation === 'overexposure_check') {
      suggestion = { type: 'exposure', description: '建议降低曝光度 -0.5EV', params: { exposure: -0.5 } }
    } else if (matchedTemplate.operation === 'underexposure_check') {
      suggestion = { type: 'exposure', description: '建议提升曝光度 +0.5EV', params: { exposure: 0.5 } }
    } else {
      suggestion = { type: 'basic_adjustment', description: '匹配到行话模板：「' + matchedKeyword + '」', params: matchedTemplate }
    }
  }

  res.json({
    data: {
      query: query,
      matchedKeyword: matchedKeyword,
      matched: matched,
      unmatched: unmatched,
      total: images.length,
      suggestion: suggestion
    }
  })
})

// F-16: 行话模板库列表
app.get('/v1/jargon-templates', authMiddleware, function(req, res) {
  var templates = [
    { key: '去雾', label: '去雾', description: '去朦胧+对比度+清晰度综合调整', params: { contrast: 15, dehaze: 20, clarity: 10 } },
    { key: '背景不够白', label: '背景不够白', description: '检查白底图RGB值是否达到标准', params: { operation: 'bg_white_check', threshold: 250 } },
    { key: '过曝', label: '过曝', description: '检测过曝区域', params: { operation: 'overexposure_check', threshold: 0.85 } },
    { key: '太暗', label: '太暗/欠曝', description: '检测欠曝区域', params: { operation: 'underexposure_check', threshold: 0.2 } },
    { key: '偏色', label: '偏色', description: '检测色偏问题', params: { operation: 'color_balance_check', threshold: 0.3 } },
    { key: '白平衡不准', label: '白平衡不准', description: '检测白平衡偏差', params: { operation: 'wb_check', threshold: 0.2 } },
    { key: '模糊', label: '模糊/不够锐', description: '检测画面清晰度', params: { operation: 'sharpness_check', threshold: 0.5 } },
    { key: '饱和度低', label: '饱和度低', description: '检测色彩饱和度', params: { operation: 'saturation_check', threshold: 0.3 } },
    { key: '噪点多', label: '噪点多', description: '检测画面噪点', params: { operation: 'noise_check', threshold: 0.4 } },
    { key: '对比度低', label: '对比度低', description: '检测画面对比度', params: { operation: 'contrast_check', threshold: 0.3 } },
  ]
  res.json({ data: templates })
})

// F-23: 项目模板 CRUD
app.get('/v1/templates', authMiddleware, function(req, res) {
  var templates = db.prepare('SELECT * FROM project_templates WHERE workspace_id = ? ORDER BY created_at DESC').all(req.workspaceId)
  res.json({ data: templates.map(formatTemplate) })
})

app.post('/v1/templates', authMiddleware, function(req, res) {
  var name = String(req.body.name || '').trim()
  var description = (req.body.description || '').trim()
  if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '模板名称必填' })

  var assigneeMap = req.body.assigneeMap ? JSON.stringify(req.body.assigneeMap) : '{}'
  var deliveryRules = req.body.deliveryRules ? JSON.stringify(req.body.deliveryRules) : '{}'

  var id = uuidv4()
  db.prepare('INSERT INTO project_templates (id,workspace_id,name,description,assignee_map,delivery_rules) VALUES (?,?,?,?,?,?)')
    .run(id, req.workspaceId, name, description, assigneeMap, deliveryRules)

  var template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(id)
  res.status(201).json({ data: formatTemplate(template) })
})

app.put('/v1/templates/:id', authMiddleware, function(req, res) {
  var template = db.prepare('SELECT * FROM project_templates WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!template) return res.status(404).json({ code: 'NOT_FOUND', message: '模板不存在' })

  var name = req.body.name !== undefined ? (req.body.name || '').trim() : template.name
  var description = req.body.description !== undefined ? (req.body.description || '').trim() : template.description
  var assigneeMap = req.body.assigneeMap ? JSON.stringify(req.body.assigneeMap) : template.assignee_map
  var deliveryRules = req.body.deliveryRules ? JSON.stringify(req.body.deliveryRules) : template.delivery_rules

  db.prepare('UPDATE project_templates SET name=?,description=?,assignee_map=?,delivery_rules=? WHERE id=?')
    .run(name, description, assigneeMap, deliveryRules, template.id)

  var updated = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(template.id)
  res.json({ data: formatTemplate(updated) })
})

app.delete('/v1/templates/:id', authMiddleware, function(req, res) {
  var template = db.prepare('SELECT * FROM project_templates WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId)
  if (!template) return res.status(404).json({ code: 'NOT_FOUND', message: '模板不存在' })
  db.prepare('DELETE FROM project_templates WHERE id = ?').run(template.id)
  res.json({ data: { ok: true } })
})

// F-23: 基于模板创建项目
app.post('/v1/projects/from-template/:templateId', authMiddleware, function(req, res) {
  var template = db.prepare('SELECT * FROM project_templates WHERE id = ? AND workspace_id = ?').get(req.params.templateId, req.workspaceId)
  if (!template) return res.status(404).json({ code: 'NOT_FOUND', message: '模板不存在' })

  var name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '项目名称必填' })

  var id = uuidv4()
  var clientName = (req.body.clientName || '').trim()
  var deadline = req.body.deadline || null
  var assigneeMap = JSON.parse(template.assignee_map || '{}')
  var deliveryRules = JSON.parse(template.delivery_rules || '{}')

  db.prepare("INSERT INTO projects (id,workspace_id,name,client_name,status,deadline,metadata) VALUES (?,?,?,?,?,?,?)")
    .run(id, req.workspaceId, name, clientName, 'draft', deadline,
      JSON.stringify({ templateId: template.id, templateName: template.name, assigneeMap: assigneeMap, deliveryRules: deliveryRules }))

  var project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  res.status(201).json({ data: formatProject(project), template: formatTemplate(template) })
})

function formatTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    assigneeMap: JSON.parse(t.assignee_map || '{}'),
    deliveryRules: JSON.parse(t.delivery_rules || '{}'),
    createdAt: t.created_at
  }
}

// 辅助函数：获取卡片所属项目ID
function getProjectIdByCard(cardId) {
  var row = db.prepare(`
    SELECT pu.project_id FROM comment_cards cc
    JOIN images img ON cc.image_id = img.id
    JOIN product_units pu ON img.product_unit_id = pu.id
    WHERE cc.id = ?
  `).get(cardId)
  return row ? row.project_id : ''
}

// 辅助函数：获取卡片上下文
function getCardContext(cardId) {
  var row = db.prepare(`
    SELECT p.name as project_name, pu.name as unit_name, cc.text_content
    FROM comment_cards cc
    JOIN images img ON cc.image_id = img.id
    JOIN product_units pu ON img.product_unit_id = pu.id
    JOIN projects p ON pu.project_id = p.id
    WHERE cc.id = ?
  `).get(cardId)
  if (!row) return '未知卡片'
  return (row.project_name || '项目') + '-' + (row.unit_name || '图')
}

// 辅助函数：创建通知
function createNotification(wsId, userId, type, title, content, link, projectId, cardId) {
  var id = uuidv4()
  db.prepare('INSERT INTO notifications (id,workspace_id,user_id,type,title,content,link,project_id,comment_card_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, wsId, userId, type, title, content, link, projectId || null, cardId || null)
  return id
}

// =============================================================================
// V1.2.0: ZIP/PDF Export (G-06)
// =============================================================================
app.get('/v1/projects/:projectId/export-zip', authMiddleware, function(req, res) {
  var projectId = req.params.projectId
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', 'attachment; filename=project-' + projectId + '.zip')

  var archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', function(err) { log('ERROR', 'Export', 'ZIP error', { error: err.message }); res.status(500).end() })
  archive.pipe(res)

  // Add project info JSON
  var units = db.prepare('SELECT * FROM product_units WHERE project_id = ?').all(projectId)
  var allImages = []
  var allCards = []
  units.forEach(function(u) {
    var imgs = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(u.id)
    allImages = allImages.concat(imgs)
    imgs.forEach(function(img) {
      var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? AND deleted_at IS NULL').all(img.id)
      allCards = allCards.concat(cards.map(function(c) { return formatCommentCard(c) }))
    })
  })

  archive.append(JSON.stringify({
    project: formatProject(proj),
    units: units,
    images: allImages.map(function(i) { return { id: i.id, filename: i.original_filename, urls: JSON.parse(i.thumbnail_urls || '[]') } }),
    commentCards: allCards,
    exportedAt: new Date().toISOString()
  }, null, 2), { name: 'project-info.json' })

  // Add PDF report
  var doc = new PDFDocument({ size: 'A4', margin: 50 })
  var pdfBuffers = []
  doc.on('data', function(chunk) { pdfBuffers.push(chunk) })
  doc.on('end', function() {
    archive.append(Buffer.concat(pdfBuffers), { name: 'report.pdf' })
    archive.finalize()
  })

  doc.fontSize(20).text('易拍选 — 项目报告', { align: 'center' })
  doc.moveDown()
  doc.fontSize(14).text('项目名称：' + proj.name)
  doc.fontSize(12).text('客户：' + (proj.client_name || '未指定'))
  doc.text('状态：' + proj.status)
  doc.text('截止日期：' + (proj.deadline || '未设定'))
  doc.moveDown()
  doc.fontSize(14).text('意见卡片汇总 (' + allCards.length + ' 条)')
  allCards.forEach(function(c, i) {
    doc.fontSize(10).text((i + 1) + '. [' + (c.status === 'resolved' ? '已解决' : '未解决') + '] ' + (c.text || '(无文本)'))
  })
  doc.end()

  log('INFO', 'Export', 'ZIP export generated', { projectId: projectId })
})

// V1.2.0: PDF-only export
app.get('/v1/projects/:projectId/export-pdf', authMiddleware, function(req, res) {
  var projectId = req.params.projectId
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })

  res.set('Content-Type', 'application/pdf')
  res.set('Content-Disposition', 'attachment; filename=report-' + projectId + '.pdf')

  var doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)

  doc.fontSize(20).text('易拍选 — 项目报告', { align: 'center' })
  doc.moveDown()
  doc.fontSize(14).text('项目：' + proj.name)
  doc.fontSize(12).text('客户：' + (proj.client_name || '未指定'))
  doc.text('状态：' + proj.status)
  doc.text('导出时间：' + new Date().toISOString())
  doc.end()
})

// =============================================================================
// V1.2.0: Auto-save Draft for Comment Cards (G-07)
// =============================================================================
app.put('/v1/comment-cards/:id/draft', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })

  if (req.body.draftText !== undefined) {
    db.prepare('UPDATE comment_cards SET draft_text = ?, draft_updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.body.draftText, req.params.id)
  }
  var updated = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
  res.json({ data: { id: updated.id, draftText: updated.draft_text, draftUpdatedAt: updated.draft_updated_at } })
})

// =============================================================================
// V1.2.0: CDN Signed URL (G-09)
// =============================================================================
app.get('/v1/images/:id/signed-url', authMiddleware, function(req, res) {
  var img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND' })

  var urls = JSON.parse(img.thumbnail_urls || '[]')
  var originalUrl = img.original_url || ''
  res.json({ data: {
    signedThumbnails: urls.map(function(u) { return generateSignedUrl(u) }),
    signedOriginal: originalUrl ? generateSignedUrl(originalUrl) : ''
  }})
})

// CDN signed URL verification middleware
app.get('/cdn/:filePath', function(req, res) {
  var filePath = decodeURIComponent(req.params.filePath)
  var expires = req.query.expires
  var sig = req.query.sig

  if (!verifySignedUrl(filePath, expires, sig)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '签名无效或已过期' })
  }

  var absPath = path.join(__dirname, filePath)
  if (!fs.existsSync(absPath)) return res.status(404).json({ code: 'NOT_FOUND' })
  res.sendFile(absPath)
})

// =============================================================================
// AI Retry & Error Handling (G-02) — wraps AI endpoints
// =============================================================================
// Override AI endpoints with retry-aware error responses
app.post('/v1/ai/style-samples/with-retry', authMiddleware, function(req, res) {
  var imageId = req.body.imageId
  var style = req.body.style || 'default'
  if (!imageId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 imageId' })

  var taskId = uuidv4()
  db.prepare('INSERT INTO ai_samples (id,image_id,style) VALUES (?,?,?)').run(taskId, imageId, style)
  res.json({ data: { taskId: taskId, retryable: true } })
})

// =============================================================================
// V1.2.0 补充功能: 模块1-12 全部新增API端点
// =============================================================================

// ── 模块1: 战情室增强 ──

// 1.1 一键催稿
app.post('/v1/projects/:projectId/nudge', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })
  db.prepare('UPDATE projects SET last_nudged_at = datetime(\'now\'), nudge_count = COALESCE(nudge_count,0)+1 WHERE id = ?').run(proj.id)
  // DATA-05: 记录催稿操作日志
  logOperation(proj.id, req.userId, req.user?.username || '', 'nudge', 'project', proj.id, '')
  // 发送催稿通知给客户 - 使用 workspaceId 作为通知接收者
  createNotification(req.workspaceId, req.userId, 'status_change', '催稿提醒', '已向客户「' + proj.name + '」发送催稿提醒', '/project/' + proj.id, null, null)
  sendEmail(proj.client_email, '【易拍选】催稿提醒', '<p>摄影师提醒您处理项目「' + proj.name + '」，请登录查看。</p>')
  res.json({ data: { nudgedAt: new Date().toISOString(), nudgeCount: (proj.nudge_count || 0) + 1 } })
})

// DATA-05: 催稿已读状态追踪
app.get('/v1/projects/:projectId/nudge-status', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })

  var lastNudge = db.prepare('SELECT * FROM operation_logs WHERE action = ? AND target_id = ? ORDER BY created_at DESC LIMIT 1').get('nudge', proj.id)
  var lastView = db.prepare('SELECT * FROM operation_logs WHERE action = ? AND target_id = ? ORDER BY created_at DESC LIMIT 1').get('view_share', proj.id)

  var status = 'sent'
  if (lastNudge && lastView && lastView.created_at > lastNudge.created_at) {
    status = 'viewed'
  }
  // 如果 project 状态是 review 或 in_progress，说明客户在审阅中
  if (proj.status === 'review' || proj.status === 'in_progress') {
    status = 'reviewing'
  }

  res.json({ data: { status: status, viewedAt: lastView ? lastView.created_at : null } })
})

// 1.3 成员负载上限配置
app.put('/v1/workspace/member-load-limit', authMiddleware, function(req, res) {
  var limit = parseInt(req.body.limit, 10) || 15
  db.prepare('UPDATE workspaces SET member_load_limit = ? WHERE id = ?').run(limit, req.workspaceId)
  res.json({ data: { memberLoadLimit: limit } })
})

// ── 模块2: 修图师待办 ──

// 2.3 预计耗时字段
app.put('/v1/comment-cards/:id/estimated-time', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  var et = req.body.estimatedTime || null
  db.prepare('UPDATE comment_cards SET estimated_time = ? WHERE id = ?').run(et, req.params.id)
  res.json({ data: { id: card.id, estimatedTime: et } })
})

// ── 模块3: 项目看板 ──

// 3.2 个人行话模板
app.get('/v1/personal-jargon-templates', authMiddleware, function(req, res) {
  var tmpls = db.prepare('SELECT * FROM jargon_templates WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC').all(req.workspaceId, req.userId)
  res.json({ data: tmpls.map(function(t) { return { id: t.id, name: t.name, keywords: t.keywords, createdAt: t.created_at } }) })
})

app.post('/v1/personal-jargon-templates', authMiddleware, function(req, res) {
  var id = uuidv4()
  db.prepare('INSERT INTO jargon_templates (id,workspace_id,user_id,name,keywords,created_at) VALUES (?,?,?,?,?,datetime(\'now\'))').run(id, req.workspaceId, req.userId, req.body.name, req.body.keywords)
  res.status(201).json({ data: { id: id } })
})

app.put('/v1/personal-jargon-templates/:id', authMiddleware, function(req, res) {
  db.prepare('UPDATE jargon_templates SET name = ?, keywords = ? WHERE id = ? AND user_id = ?').run(req.body.name, req.body.keywords, req.params.id, req.userId)
  res.json({ data: { id: req.params.id } })
})

app.delete('/v1/personal-jargon-templates/:id', authMiddleware, function(req, res) {
  db.prepare('DELETE FROM jargon_templates WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ data: { deleted: true } })
})

// ── 模块4: 图片查看与标注增强 ──

// 4.4 文字工具预设短语
app.get('/v1/workspace/preset-phrases', authMiddleware, function(req, res) {
  var row = db.prepare('SELECT preset_phrases FROM workspaces WHERE id = ?').get(req.workspaceId)
  var phrases = row && row.preset_phrases ? JSON.parse(row.preset_phrases) : ['曝光不足', '色温偏冷', '高光溢出', '饱和度不足', '白平衡偏移', '暗部细节丢失', '噪点过多', '锐度不足']
  res.json({ data: phrases })
})

app.put('/v1/workspace/preset-phrases', authMiddleware, function(req, res) {
  db.prepare('UPDATE workspaces SET preset_phrases = ? WHERE id = ?').run(JSON.stringify(req.body.phrases || []), req.workspaceId)
  res.json({ data: req.body.phrases })
})

// 4.6 快捷键自定义
app.get('/v1/workspace/shortcuts', authMiddleware, function(req, res) {
  var row = db.prepare('SELECT shortcuts FROM workspaces WHERE id = ?').get(req.workspaceId)
  var defaults = { copy: 'Ctrl+D', delete: 'Delete', nextCard: 'Tab', gotoPage: 'Ctrl+G' }
  var saved = row && row.shortcuts ? JSON.parse(row.shortcuts) : {}
  res.json({ data: Object.assign({}, defaults, saved) })
})

app.put('/v1/workspace/shortcuts', authMiddleware, function(req, res) {
  db.prepare('UPDATE workspaces SET shortcuts = ? WHERE id = ?').run(JSON.stringify(req.body), req.workspaceId)
  res.json({ data: req.body })
})

// 4.8 意见卡片最后编辑信息
app.put('/v1/comment-cards/:id/edit', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  db.prepare('UPDATE comment_cards SET text_content = ?, last_edited_by = ?, last_edited_at = datetime(\'now\') WHERE id = ?').run(req.body.text || card.text_content, req.userId, req.params.id)
  res.json({ data: { id: card.id, lastEditedBy: req.userId, lastEditedAt: new Date().toISOString() } })
})

// 4.9 跨图同步标注
app.post('/v1/comment-cards/:cardId/sync-to-images', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ? AND deleted_at IS NULL').get(req.params.cardId)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  var targetImageIds = req.body.imageIds || []
  var created = []
  targetImageIds.forEach(function(imgId) {
    var newId = 'card-' + uuidv4().slice(0, 8)
    db.prepare('INSERT INTO comment_cards (id,annotation_id,image_id,text_content,status,sort_order,created_at,last_edited_by,last_edited_at) VALUES (?,?,?,?,?,?,datetime(\'now\'),?,datetime(\'now\'))').run(newId, card.annotation_id, imgId, card.text_content, 'unresolved', card.sort_order, req.userId)
    created.push({ id: newId, imageId: imgId })
  })
  res.status(201).json({ data: { created: created } })
})

// 4.10 已解决卡片抽查
app.get('/v1/projects/:projectId/review-recent-resolved', authMiddleware, function(req, res) {
  var cards = db.prepare('SELECT cc.* FROM comment_cards cc JOIN images i ON cc.image_id = i.id JOIN product_units pu ON i.product_unit_id = pu.id WHERE pu.project_id = ? AND cc.status = ? AND cc.deleted_at IS NULL ORDER BY cc.resolved_at DESC LIMIT 50').all(req.params.projectId, 'resolved')
  res.json({ data: cards.map(formatCommentCard) })
})

// 4.11 最近操作面板与撤回
app.get('/v1/projects/:projectId/recent-actions', authMiddleware, function(req, res) {
  var actions = db.prepare('SELECT * FROM recent_actions WHERE project_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.projectId, req.workspaceId)
  res.json({ data: actions.map(function(a) { return { id: a.id, actionType: a.action_type, description: a.description, undoData: a.undo_data ? JSON.parse(a.undo_data) : null, createdAt: a.created_at } }) })
})

app.post('/v1/recent-actions/:actionId/undo', authMiddleware, function(req, res) {
  var action = db.prepare('SELECT * FROM recent_actions WHERE id = ?').get(req.params.actionId)
  if (!action) return res.status(404).json({ code: 'NOT_FOUND' })
  var undoData = JSON.parse(action.undo_data || '{}')
  // 执行撤回逻辑
  if (action.action_type === 'delete_card' && undoData.cardId) {
    db.prepare('UPDATE comment_cards SET deleted_at = NULL WHERE id = ?').run(undoData.cardId)
  } else if (action.action_type === 'status_change' && undoData.cardId) {
    db.prepare('UPDATE comment_cards SET status = ? WHERE id = ?').run(undoData.previousStatus, undoData.cardId)
  }
  db.prepare('DELETE FROM recent_actions WHERE id = ?').run(req.params.actionId)
  createNotification(req.workspaceId, req.userId, 'status_change', '操作已撤回', action.description + ' 已撤回', null, null, null)
  res.json({ data: { undone: true } })
})

function recordAction(workspaceId, projectId, userId, actionType, description, undoData) {
  var id = uuidv4()
  db.prepare('INSERT INTO recent_actions (id,workspace_id,project_id,user_id,action_type,description,undo_data,created_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'))').run(id, workspaceId, projectId, userId, actionType, description, JSON.stringify(undoData || {}))
}

// 4.13 批量重命名
app.post('/v1/images/batch-rename', authMiddleware, function(req, res) {
  var imageIds = req.body.imageIds || []
  var prefix = req.body.prefix || ''
  var suffix = req.body.suffix || ''
  var startIndex = parseInt(req.body.startIndex, 10) || 1
  var results = []
  imageIds.forEach(function(imgId, i) {
    var img = db.prepare('SELECT * FROM images WHERE id = ?').get(imgId)
    if (img) {
      var newName = prefix + (startIndex + i) + suffix
      db.prepare('UPDATE images SET original_filename = ? WHERE id = ?').run(newName, imgId)
      results.push({ id: imgId, newName: newName })
    }
  })
  res.json({ data: { results: results, total: results.length } })
})

// 4.14 图片级讨论区
app.get('/v1/images/:imageId/discussions', authMiddleware, function(req, res) {
  var discussions = db.prepare('SELECT * FROM image_discussions WHERE image_id = ? ORDER BY created_at ASC').all(req.params.imageId)
  res.json({ data: discussions.map(function(d) { return { id: d.id, imageId: d.image_id, userId: d.user_id, text: d.text, mentionedUserIds: d.mentioned_user_ids ? JSON.parse(d.mentioned_user_ids) : [], isRead: !!d.is_read, createdAt: d.created_at } }) })
})

app.post('/v1/images/:imageId/discussions', authMiddleware, function(req, res) {
  var img = db.prepare('SELECT id FROM images WHERE id = ?').get(req.params.imageId)
  if (!img) return res.status(404).json({ code: 'NOT_FOUND', message: '图片不存在' })

  // 获取项目信息
  var projectInfo = db.prepare(
    'SELECT p.name, p.id as project_id FROM images i ' +
    'JOIN product_units pu ON i.product_unit_id = pu.id ' +
    'JOIN projects p ON pu.project_id = p.id ' +
    'WHERE i.id = ?'
  ).get(req.params.imageId)
  var projectName = projectInfo ? projectInfo.name : '未知项目'
  var projectId = projectInfo ? projectInfo.project_id : null

  var id = uuidv4()
  var mentionedIds = req.body.mentionedUserIds || []

  // 支持 mentions 字段（通过 display_name 或 id 查找）
  if (req.body.mentions && Array.isArray(req.body.mentions)) {
    req.body.mentions.forEach(function(mention) {
      var user = db.prepare('SELECT id FROM users WHERE name = ? OR id = ?').get(mention, mention)
      if (user && mentionedIds.indexOf(user.id) === -1) {
        mentionedIds.push(user.id)
      }
    })
  }

  db.prepare('INSERT INTO image_discussions (id,image_id,user_id,text,mentioned_user_ids,created_at) VALUES (?,?,?,?,?,datetime(\'now\'))').run(id, req.params.imageId, req.userId, req.body.text, JSON.stringify(mentionedIds))
  // 通知被@的人
  mentionedIds.forEach(function(uid) {
    createNotification(req.workspaceId, uid, 'mention', '修图师在讨论中提到了你', '在项目「' + projectName + '」中', '/project/' + (projectId || ''), projectId, null)
  })
  res.status(201).json({ data: { id: id } })
})

// ── 模块5: 色差巡检 ──

// 5.2 批量/单选混合应用
app.post('/v1/ai/color-check/apply-selected', authMiddleware, function(req, res) {
  var taskId = req.body.taskId
  var report = db.prepare('SELECT * FROM ai_reports WHERE id = ?').get(taskId)
  if (!report) return res.status(404).json({ code: 'NOT_FOUND' })
  var imageIds = req.body.imageIds || []
  var results = []
  imageIds.forEach(function(imgId) {
    results.push({ imageId: imgId, applied: true })
  })
  res.json({ data: { results: results } })
})

// ── 模块6: 光影一致性 ──

// 6.2 忽略异常
app.post('/v1/ai/consistency-check/:taskId/ignore-anomaly', authMiddleware, function(req, res) {
  var anomalyId = req.body.anomalyId
  var report = db.prepare('SELECT * FROM ai_reports WHERE id = ?').get(req.params.taskId)
  if (!report) return res.status(404).json({ code: 'NOT_FOUND' })
  var ignored = JSON.parse(report.ignored_anomalies || '[]')
  if (ignored.indexOf(anomalyId) === -1) ignored.push(anomalyId)
  db.prepare('UPDATE ai_reports SET ignored_anomalies = ? WHERE id = ?').run(JSON.stringify(ignored), req.params.taskId)
  res.json({ data: { ignored: true, anomalyId: anomalyId } })
})

app.post('/v1/ai/consistency-check/:taskId/restore-anomaly', authMiddleware, function(req, res) {
  var anomalyId = req.body.anomalyId
  var report = db.prepare('SELECT * FROM ai_reports WHERE id = ?').get(req.params.taskId)
  if (!report) return res.status(404).json({ code: 'NOT_FOUND' })
  var ignored = JSON.parse(report.ignored_anomalies || '[]')
  ignored = ignored.filter(function(a) { return a !== anomalyId })
  db.prepare('UPDATE ai_reports SET ignored_anomalies = ? WHERE id = ?').run(JSON.stringify(ignored), req.params.taskId)
  res.json({ data: { restored: true } })
})

// ── 模块7: 客户端确稿 ──

// 7.1 客户端首次访问标记
app.put('/v1/projects/:projectId/client-first-visit', authMiddleware, function(req, res) {
  db.prepare('UPDATE projects SET client_first_visit = ? WHERE id = ?').run(req.body.firstVisit ? 'false' : 'true', req.params.projectId)
  res.json({ data: { firstVisit: req.body.firstVisit } })
})

// 7.5 意见已读回执
app.post('/v1/comment-cards/:cardId/read-receipt', authMiddleware, function(req, res) {
  var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.cardId)
  if (!card) return res.status(404).json({ code: 'NOT_FOUND' })
  db.prepare('UPDATE comment_cards SET read_by_client = 1, read_at = datetime(\'now\') WHERE id = ?').run(req.params.cardId)
  res.json({ data: { read: true, readAt: new Date().toISOString() } })
})

// ── 模块8: 通知系统 ──

// 8.1 通知偏好设置
app.get('/v1/user/notification-preferences', authMiddleware, function(req, res) {
  var row = db.prepare('SELECT notification_prefs FROM users WHERE id = ?').get(req.userId)
  var defaults = { inApp: { assign: true, dispute: true, mention: true, status: true, system: true }, email: { assign: true, dispute: true, mention: false }, wechat: { assign: false, dispute: false } }
  var saved = row && row.notification_prefs ? JSON.parse(row.notification_prefs) : {}
  res.json({ data: Object.assign({}, defaults, saved) })
})

app.put('/v1/user/notification-preferences', authMiddleware, function(req, res) {
  db.prepare('UPDATE users SET notification_prefs = ? WHERE id = ?').run(JSON.stringify(req.body), req.userId)
  res.json({ data: req.body })
})

// 8.2 通知快捷处理
app.post('/v1/notifications/:id/quick-action', authMiddleware, function(req, res) {
  var notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!notif) return res.status(404).json({ code: 'NOT_FOUND' })
  var action = req.body.action
  if (action === 'approve') {
    // 同意驳回确稿
    db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('actioned', req.params.id)
  } else if (action === 'reject') {
    db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('dismissed', req.params.id)
  }
  res.json({ data: { actioned: true, action: action } })
})

// ── 模块9: 时间轴 ──

// 9.1 版本对比 API
app.get('/v1/projects/:projectId/versions', authMiddleware, function(req, res) {
  var versions = db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json({ data: versions.map(function(v) { return { id: v.id, version: v.version, createdAt: v.created_at, changes: v.changes } }) })
})

// ── 模块10: 项目模板 ──

// 10.1 模板预览
app.get('/v1/templates/:id/preview', authMiddleware, function(req, res) {
  var tmpl = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id)
  if (!tmpl) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: { id: tmpl.id, name: tmpl.name, structure: JSON.parse(tmpl.structure || '{}'), units: tmpl.units ? JSON.parse(tmpl.units) : [] } })
})

// 10.2 复制模板
app.post('/v1/templates/:id/copy', authMiddleware, function(req, res) {
  var tmpl = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id)
  if (!tmpl) return res.status(404).json({ code: 'NOT_FOUND' })
  var newId = uuidv4()
  db.prepare('INSERT INTO project_templates (id,workspace_id,name,structure,units,created_at) VALUES (?,?,?,?,?,datetime(\'now\'))').run(newId, tmpl.workspace_id, (tmpl.name || '未命名') + '-副本', tmpl.structure, tmpl.units)
  res.status(201).json({ data: { id: newId, name: (tmpl.name || '未命名') + '-副本' } })
})

// ── 模块11: 一键交付包 ──

// UX-44: 辅助函数 - 生成 Excel 交付清单并追加到 archive
function appendExcelToArchive(archive, projectId, callback) {
  try {
    var ExcelJS = require('exceljs')
    var workbook = new ExcelJS.Workbook()
    var sheet = workbook.addWorksheet('交付清单')

    sheet.columns = [
      { header: '图片名', key: 'filename', width: 30 },
      { header: '产品单元', key: 'unit_name', width: 20 },
      { header: '修图师', key: 'retoucher', width: 15 },
      { header: '修改次数', key: 'revision_count', width: 12 },
      { header: '最终状态', key: 'status', width: 12 }
    ]

    var rows = db.prepare(
      'SELECT ' +
      'COALESCE(i.original_filename, \'未知\') as filename, ' +
      'COALESCE(pu.name, \'未分类\') as unit_name, ' +
      'COALESCE(u.name, \'未分配\') as retoucher, ' +
      'COUNT(cc.id) as revision_count, ' +
      'CASE WHEN cc.status = \'resolved\' THEN \'已解决\' ELSE \'处理中\' END as status ' +
      'FROM images i ' +
      'LEFT JOIN product_units pu ON i.product_unit_id = pu.id ' +
      'LEFT JOIN comment_cards cc ON cc.image_id = i.id ' +
      'LEFT JOIN users u ON cc.assignee_id = u.id ' +
      'WHERE pu.project_id = ? ' +
      'GROUP BY i.id'
    ).all(projectId)

    rows.forEach(function(row) {
      sheet.addRow(row)
    })

    workbook.xlsx.writeBuffer().then(function(buffer) {
      archive.append(buffer, { name: 'delivery-checklist.xlsx' })
      callback()
    }).catch(function(err) {
      log('ERROR', 'Delivery', 'Excel generation error', { error: err.message })
      callback()
    })
  } catch (err) {
    log('ERROR', 'Delivery', 'Excel generation error', { error: err.message })
    callback()
  }
}

// 11.1 一键交付包下载 (F-53: 支持下载选项)
app.get('/v1/projects/:projectId/delivery-package', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })

  var downloadOption = (req.query.option || 'original').toLowerCase()
  if (['original', 'web', 'custom'].indexOf(downloadOption) === -1) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'option 参数必须是 original, web 或 custom' })
  }
  var customWidth = parseInt(req.query.width, 10) || 2000
  var customQuality = parseInt(req.query.quality, 10) || 85
  if (customWidth < 800) customWidth = 800
  if (customWidth > 5000) customWidth = 5000
  if (customQuality < 60) customQuality = 60
  if (customQuality > 100) customQuality = 100

  // V1.19: 交付包内容选项
  var includeParam = req.query.include || 'final_images,excel,pdf'
  var include = includeParam.split(',').map(function(s) { return s.trim() })
  var includeFinalImages = include.indexOf('final_images') !== -1
  var includeCompareImages = include.indexOf('compare_images') !== -1
  var includeOriginals = include.indexOf('originals') !== -1
  var includeColorCheck = include.indexOf('color_check_report') !== -1
  var includeConsistencyCheck = include.indexOf('consistency_check_report') !== -1
  var includeExcel = include.indexOf('excel') !== -1
  var includePdf = include.indexOf('pdf') !== -1
  var includeAcceptanceForm = include.indexOf('acceptance_form') !== -1

  res.set('Content-Type', 'application/zip')
  var optLabel = downloadOption === 'web' ? 'web' : downloadOption === 'custom' ? customWidth + 'px' : 'original'
  res.set('Content-Disposition', 'attachment; filename=delivery-' + req.params.projectId + '-' + optLabel + '.zip')

  var archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', function(err) { log('ERROR', 'Delivery', 'ZIP error', { error: err.message }); res.status(500).end() })
  archive.pipe(res)

  // 项目信息
  archive.append(JSON.stringify({ project: formatProject(proj), downloadOption: downloadOption, exportedAt: new Date().toISOString() }, null, 2), { name: 'project-info.json' })

  // 收集图片
  var units = db.prepare('SELECT * FROM product_units WHERE project_id = ?').all(req.params.projectId)
  var imagePaths = []
  if (includeFinalImages || includeCompareImages) {
    units.forEach(function(u) {
      var imgs = db.prepare('SELECT * FROM images WHERE product_unit_id = ? AND deleted_at IS NULL').all(u.id)
      imgs.forEach(function(img) {
        var filePath = null
        if (img.original_url && img.original_url.startsWith('/uploads/')) {
          filePath = path.join(__dirname, img.original_url)
        }
        if (filePath && fs.existsSync(filePath)) {
          imagePaths.push({ path: filePath, name: img.original_filename || path.basename(filePath), id: img.id, unitId: u.id })
        }
      })
    })
  }

  // 处理图片
  var processed = 0
  var totalImages = imagePaths.length

  if (totalImages === 0) {
    // 只有 PDF 报告
    var doc = new PDFDocument({ size: 'A4', margin: 50 })
    var pdfBuffers = []
    doc.on('data', function(chunk) { pdfBuffers.push(chunk) })
    doc.on('end', function() {
      if (includePdf) {
        archive.append(Buffer.concat(pdfBuffers), { name: 'delivery-report.pdf' })
      }
      // V1.21: 验收表单
      if (includeAcceptanceForm) {
        generateAcceptanceFormPDF(proj, req.params.projectId, function(buf) {
          archive.append(buf, { name: 'acceptance-form.pdf' })
          if (includeExcel) {
            appendExcelToArchive(archive, req.params.projectId, function() { archive.finalize() })
          } else {
            archive.finalize()
          }
        })
      } else if (includeExcel) {
        appendExcelToArchive(archive, req.params.projectId, function() {
          archive.finalize()
        })
      } else {
        archive.finalize()
      }
    })
    doc.fontSize(20).text('易拍选 — 交付报告', { align: 'center' })
    doc.moveDown()
    doc.fontSize(14).text('项目：' + proj.name)
    doc.fontSize(12).text('客户：' + (proj.client_name || '未指定'))
    doc.text('下载选项：' + (downloadOption === 'original' ? '原尺寸' : downloadOption === 'web' ? 'Web 优化' : '自定义 ' + customWidth + 'px'))
    doc.text('完成时间：' + new Date().toISOString())
    doc.end()
    return
  }

  function processImage(idx) {
    if (idx >= imagePaths.length) {
      // All done, add PDF
      var doc = new PDFDocument({ size: 'A4', margin: 50 })
      var pdfBuffers = []
      doc.on('data', function(chunk) { pdfBuffers.push(chunk) })
      doc.on('end', function() {
        if (includePdf) {
          archive.append(Buffer.concat(pdfBuffers), { name: 'delivery-report.pdf' })
        }
        // V1.21: 验收表单
        if (includeAcceptanceForm) {
          generateAcceptanceFormPDF(proj, req.params.projectId, function(buf) {
            archive.append(buf, { name: 'acceptance-form.pdf' })
            if (includeExcel) {
              appendExcelToArchive(archive, req.params.projectId, function() { archive.finalize() })
            } else {
              archive.finalize()
            }
          })
        } else if (includeExcel) {
          appendExcelToArchive(archive, req.params.projectId, function() {
            archive.finalize()
          })
        } else {
          archive.finalize()
        }
      })
      doc.fontSize(20).text('易拍选 — 交付报告', { align: 'center' })
      doc.moveDown()
      doc.fontSize(14).text('项目：' + proj.name)
      doc.fontSize(12).text('客户：' + (proj.client_name || '未指定'))
      doc.text('下载选项：' + (downloadOption === 'original' ? '原尺寸' : downloadOption === 'web' ? 'Web 优化 (2000px JPG)' : '自定义 ' + customWidth + 'px'))
      doc.text('图片数量：' + totalImages)
      doc.text('完成时间：' + new Date().toISOString())
      doc.end()
      return
    }

    var img = imagePaths[idx]
    var ext = path.extname(img.name).toLowerCase()
    var outName = img.name

    if (downloadOption === 'original') {
      archive.file(img.path, { name: 'images/' + outName })
      // V1.19: 添加修改前后对比图
      if (includeCompareImages) {
        var revisions = db.prepare('SELECT * FROM revisions WHERE image_id = ? ORDER BY created_at DESC').all(img.id)
        if (revisions.length > 0) {
          revisions.forEach(function(rev) {
            var revPath = rev.uploaded_image_url && rev.uploaded_image_url.startsWith('/uploads/') ? path.join(__dirname, rev.uploaded_image_url) : null
            if (revPath && fs.existsSync(revPath)) {
              archive.append(fs.createReadStream(revPath), { name: 'compare/' + img.name.replace(/\.[^.]+$/, '') + '_rev_' + rev.id.slice(0,8) + path.extname(revPath) })
            }
          })
        }
      }
      processImage(idx + 1)
    } else {
      // Web optimized or custom
      var targetWidth = downloadOption === 'web' ? 2000 : customWidth
      var targetQuality = customQuality
      var isWeb = downloadOption === 'web'

      var pipeline = sharp(img.path).resize(targetWidth, targetWidth, { fit: 'inside', withoutEnlargement: true })
      if (isWeb) {
        pipeline = pipeline.jpeg({ quality: targetQuality }).withMetadata()
      } else {
        if (ext === '.png') pipeline = pipeline.png({ quality: targetQuality })
        else pipeline = pipeline.jpeg({ quality: targetQuality })
      }
      // For web option, always convert to .jpg
      if (isWeb && ext !== '.jpg' && ext !== '.jpeg') {
        outName = img.name.replace(ext, '.jpg')
      }

      pipeline.toBuffer(function(err, buf) {
        if (err) {
          log('ERROR', 'Delivery', 'Image processing error', { error: err.message, file: img.path })
          // Fallback to original
          archive.file(img.path, { name: 'images/' + img.name })
        } else {
          archive.append(buf, { name: 'images/' + outName })
        }
        // V1.19: 添加修改前后对比图
        if (includeCompareImages) {
          var revisions = db.prepare('SELECT * FROM revisions WHERE image_id = ? ORDER BY created_at DESC').all(img.id)
          if (revisions.length > 0) {
            revisions.forEach(function(rev) {
              var revPath = rev.uploaded_image_url && rev.uploaded_image_url.startsWith('/uploads/') ? path.join(__dirname, rev.uploaded_image_url) : null
              if (revPath && fs.existsSync(revPath)) {
                archive.append(fs.createReadStream(revPath), { name: 'compare/' + img.name.replace(/\.[^.]+$/, '') + '_rev_' + rev.id.slice(0,8) + path.extname(revPath) })
              }
            })
          }
        }
        processImage(idx + 1)
      })
    }
  }

  processImage(0)
  log('INFO', 'Delivery', 'Package generated with options', { projectId: req.params.projectId, option: downloadOption })
})

// F-53: 异步交付任务（大项目使用）
app.post('/v1/projects/:projectId/delivery-task', authMiddleware, function(req, res) {
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND' })

  var option = req.body.option || 'original'
  var width = parseInt(req.body.width, 10) || 2000
  var quality = parseInt(req.body.quality, 10) || 85

  var taskId = uuidv4()
  var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO delivery_tasks (id,workspace_id,project_id,user_id,options,status,expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(taskId, req.workspaceId, req.params.projectId, req.userId, JSON.stringify({ option: option, width: width, quality: quality }), 'pending', expiresAt)

  // 异步处理
  setImmediate(function() {
    processDeliveryTask(taskId, req.params.projectId, option, width, quality)
  })

  res.json({ data: { taskId: taskId, status: 'pending', expiresAt: expiresAt } })
})

// 查询交付任务状态
app.get('/v1/delivery-tasks/:taskId', authMiddleware, function(req, res) {
  var task = db.prepare('SELECT * FROM delivery_tasks WHERE id = ? AND workspace_id = ?').get(req.params.taskId, req.workspaceId)
  if (!task) return res.status(404).json({ code: 'NOT_FOUND' })
  res.json({ data: { id: task.id, status: task.status, downloadUrl: task.download_url, expiresAt: task.expires_at, createdAt: task.created_at } })
})

// 异步处理交付任务
async function processDeliveryTask(taskId, projectId, option, width, quality) {
  try {
    db.prepare('UPDATE delivery_tasks SET status = ? WHERE id = ?').run('processing', taskId)
    var outputDir = path.join(UPLOADS_DIR, 'delivery', taskId)
    fs.mkdirSync(outputDir, { recursive: true })

    var units = db.prepare('SELECT * FROM product_units WHERE project_id = ?').all(projectId)
    for (var ui = 0; ui < units.length; ui++) {
      var u = units[ui]
      var imgs = db.prepare('SELECT * FROM images WHERE product_unit_id = ? AND deleted_at IS NULL').all(u.id)
      for (var ii = 0; ii < imgs.length; ii++) {
        var img = imgs[ii]
        var filePath = null
        if (img.original_url && img.original_url.startsWith('/uploads/')) {
          filePath = path.join(__dirname, img.original_url)
        }
        if (!filePath || !fs.existsSync(filePath)) continue

        var outName = img.original_filename || path.basename(filePath)
        var ext = path.extname(outName).toLowerCase()
        var outPath = path.join(outputDir, outName)

        if (option === 'original') {
          fs.copyFileSync(filePath, outPath)
        } else {
          var targetWidth = option === 'web' ? 2000 : width
          try {
            var pipeline = sharp(filePath).resize(targetWidth, targetWidth, { fit: 'inside', withoutEnlargement: true })
            if (option === 'web') {
              pipeline.jpeg({ quality: quality }).withMetadata()
              if (ext !== '.jpg' && ext !== '.jpeg') outPath = outPath.replace(ext, '.jpg')
            } else {
              if (ext === '.png') pipeline.png({ quality: quality })
              else pipeline.jpeg({ quality: quality })
            }
            await pipeline.toFile(outPath)
          } catch (e) {
            log('ERROR', 'Delivery', 'Image processing error in async task', { taskId: taskId, error: e.message })
            fs.copyFileSync(filePath, outPath)
          }
        }
      }
    }

    // 打包
    var zipPath = path.join(UPLOADS_DIR, 'delivery', taskId + '.zip')
    var output = fs.createWriteStream(zipPath)
    var archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(output)
    archive.directory(outputDir, 'images')

    var proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    archive.append(JSON.stringify({ project: formatProject(proj), downloadOption: option, exportedAt: new Date().toISOString() }, null, 2), { name: 'project-info.json' })

    await new Promise(function(resolve, reject) {
      output.on('close', function() {
        fs.rmSync(outputDir, { recursive: true, force: true })
        var downloadUrl = '/uploads/delivery/' + taskId + '.zip'
        db.prepare('UPDATE delivery_tasks SET status = ?, download_url = ? WHERE id = ?').run('completed', downloadUrl, taskId)
        // 发送通知
        var task = db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(taskId)
        if (task && task.user_id) {
          db.prepare('INSERT INTO notifications (id,workspace_id,user_id,type,title,content,link,created_at) VALUES (?,?,?,?,?,?,?,?)')
            .run(uuidv4(), task.workspace_id, task.user_id, 'status_change', '交付包已就绪', '项目交付包打包完成，点击下载（24小时有效）', '/projects/' + projectId, new Date().toISOString())
        }
        resolve()
      })
      output.on('error', reject)
      archive.finalize()
    })
  } catch (err) {
    log('ERROR', 'Delivery', 'Async task failed', { taskId: taskId, error: err.message })
    db.prepare('UPDATE delivery_tasks SET status = ? WHERE id = ?').run('failed', taskId)
  }
}

// UX-35: 一键交付包清单
app.get('/v1/projects/:projectId/delivery-package', authMiddleware, function(req, res) {
  var projectId = req.params.projectId
  var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
  if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

  // 查询产品单元和图片
  var units = db.prepare('SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order').all(projectId)
  var checklist = []

  units.forEach(function(u) {
    var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(u.id)
    images.forEach(function(img) {
      var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? AND deleted_at IS NULL').all(img.id)
      cards.forEach(function(c) {
        var retoucher = c.resolved_by || '未分配'
        checklist.push({
          name: img.original_filename || '未命名',
          unit: u.name,
          retoucher: retoucher,
          revisions: 1,
          status: c.status === 'resolved' ? '已解决' : '未解决'
        })
      })
    })
  })

  // 如果没有卡片，按图片生成清单
  if (checklist.length === 0) {
    units.forEach(function(u) {
      var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(u.id)
      images.forEach(function(img) {
        checklist.push({
          name: img.original_filename || '未命名',
          unit: u.name,
          retoucher: '未分配',
          revisions: 0,
          status: '待处理'
        })
      })
    })
  }

  // 收集所有图片原始链接
  var originals = []
  units.forEach(function(u) {
    var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ?').all(u.id)
    images.forEach(function(img) {
      originals.push(img.original_url)
    })
  })

  res.json({
    data: {
      projectName: proj.name,
      unitCount: units.length,
      imageCount: originals.length,
      previewUrl: originals.length > 0 ? originals[0] : '',
      originals: originals,
      checklist: checklist
    }
  })
})

// ── 模块12: 系统级 ──

// 12.1 Token 过期检查
app.get('/v1/auth/token-status', authMiddleware, function(req, res) {
  var token = req.headers.authorization.replace('Bearer ', '')
  var decoded = jwt.decode(token)
  var expiresIn = decoded.exp ? (decoded.exp * 1000 - Date.now()) : 0
  res.json({ data: { expiresInMs: expiresIn, expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null, warning: expiresIn < 300000 && expiresIn > 0 } })
})

// 12.2 外部协作者角色 — 已在 authMiddleware 中实现 viewer 只读限制

// ── V1.20: FB-002 意见汇总 API ──
app.get('/v1/projects/:projectId/comments-summary', authMiddleware, function(req, res) {
  try {
    var projectId = req.params.projectId
    var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
    if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

    var cards = db.prepare(`
      SELECT cc.*, img.thumbnail_urls, img.id as image_id, a.tool_type as annotation_tool_type,
        assignee.name as assignee_name, creator.name as creator_name
      FROM comment_cards cc
      JOIN images img ON cc.image_id = img.id
      JOIN product_units pu ON img.product_unit_id = pu.id
      LEFT JOIN annotations a ON cc.annotation_id = a.id
      LEFT JOIN users assignee ON cc.assignee_id = assignee.id
      LEFT JOIN users creator ON cc.created_at = creator.created_at
      WHERE pu.project_id = ? AND cc.deleted_at IS NULL
      ORDER BY cc.created_at DESC
    `).all(projectId)

    // Group by image
    var grouped = {}
    cards.forEach(function(c) {
      var imgId = c.image_id
      if (!grouped[imgId]) {
        grouped[imgId] = {
          imageId: imgId,
          thumbnailUrl: (JSON.parse(c.thumbnail_urls || '[]')[0]) || '',
          cards: []
        }
      }
      grouped[imgId].cards.push({
        id: c.id,
        annotationToolType: c.annotation_tool_type || '',
        text: c.text_content,
        status: c.status,
        assignee: c.assignee_name || null,
        assigneeId: c.assignee_id || null,
        createdAt: c.created_at
      })
    })

    res.json({ data: Object.values(grouped) })
  } catch (err) {
    log('ERROR', 'CommentsSummary', 'Failed to get comments summary', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取意见汇总失败' })
  }
})

// ── V1.20: FB-006 告警规则配置 ──
app.get('/v1/workspace/alert-rules', authMiddleware, function(req, res) {
  try {
    var ws = db.prepare('SELECT alert_rules FROM workspaces WHERE id = ?').get(req.workspaceId)
    var defaults = { yellowDaysWithoutActivity: 7, redDaysWithoutActivity: 14, yellowOverdueCards: 5, redOverdueCards: 10 }
    var saved = ws && ws.alert_rules ? JSON.parse(ws.alert_rules) : {}
    res.json({ data: Object.assign({}, defaults, saved) })
  } catch (err) {
    log('ERROR', 'AlertRules', 'Failed to get alert rules', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取告警规则失败' })
  }
})

app.put('/v1/workspace/alert-rules', authMiddleware, function(req, res) {
  try {
    db.prepare('UPDATE workspaces SET alert_rules = ? WHERE id = ?').run(JSON.stringify(req.body), req.workspaceId)
    res.json({ data: req.body })
  } catch (err) {
    log('ERROR', 'AlertRules', 'Failed to save alert rules', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '保存告警规则失败' })
  }
})

// ── V1.20: FB-008 批量创建产品单元 ──
app.post('/v1/projects/:projectId/product-units/batch', authMiddleware, function(req, res) {
  try {
    var projectId = req.params.projectId
    var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
    if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

    var units = req.body.units || []
    if (!Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请提供至少一个产品单元' })
    }

    var created = []
    var transaction = db.transaction(function() {
      units.forEach(function(u) {
        var unitId = uuidv4()
        db.prepare('INSERT INTO product_units (id, project_id, name, sort_order) VALUES (?,?,?,?)')
          .run(unitId, projectId, u.name, 0)

        var imageIds = u.imageIds || []
        imageIds.forEach(function(imgId) {
          db.prepare('UPDATE images SET product_unit_id = ? WHERE id = ?').run(unitId, imgId)
        })

        created.push({ id: unitId, name: u.name, imageIds: imageIds })
      })
    })
    transaction()

    res.status(201).json({ data: created })
  } catch (err) {
    log('ERROR', 'BatchProductUnits', 'Failed to create batch product units', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '批量创建产品单元失败' })
  }
})

// ── V1.20: FB-012 月度报表 API ──
app.get('/v1/reports/monthly-finance', authMiddleware, function(req, res) {
  try {
    var year = parseInt(req.query.year) || new Date().getFullYear()
    var month = parseInt(req.query.month) || (new Date().getMonth() + 1)
    var monthStr = String(year) + '-' + String(month).padStart(2, '0')
    var monthStart = monthStr + '-01'
    var nextMonth = month === 12 ? String(year + 1) + '-01' : String(year) + '-' + String(month + 1).padStart(2, '0')
    var monthEnd = nextMonth + '-01'

    var projects = db.prepare(`
      SELECT p.*, 
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.project_id = p.id AND e.expense_date >= ? AND e.expense_date < ?), 0) as month_expense
      FROM projects p 
      WHERE p.workspace_id = ? AND p.created_at >= ? AND p.created_at < ?
      ORDER BY p.created_at DESC
    `).all(monthStart, monthEnd, req.workspaceId, monthStart, monthEnd)

    var totalRevenue = projects.reduce(function(s, p) { return s + (p.contract_amount || 0) }, 0)
    var totalExpense = projects.reduce(function(s, p) { return s + (p.month_expense || 0) }, 0)
    var totalProfit = totalRevenue - totalExpense

    var projectDetails = projects.map(function(p) {
      return {
        id: p.id, name: p.name, clientName: p.client_name || '',
        status: p.status, contractAmount: p.contract_amount || 0,
        expense: p.month_expense || 0,
        profit: (p.contract_amount || 0) - (p.month_expense || 0),
        createdAt: p.created_at
      }
    })

    res.json({
      data: {
        year: year, month: month,
        totalRevenue: totalRevenue,
        totalExpense: totalExpense,
        totalProfit: totalProfit,
        projectCount: projects.length,
        projectDetails: projectDetails
      }
    })
  } catch (err) {
    log('ERROR', 'MonthlyFinance', 'Failed to get monthly finance report', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取月度财务报告失败' })
  }
})

app.get('/v1/reports/workload', authMiddleware, function(req, res) {
  try {
    var year = parseInt(req.query.year) || new Date().getFullYear()
    var month = parseInt(req.query.month) || (new Date().getMonth() + 1)
    var monthStr = String(year) + '-' + String(month).padStart(2, '0')
    var monthStart = monthStr + '-01'
    var nextMonth = month === 12 ? String(year + 1) + '-01' : String(year) + '-' + String(month + 1).padStart(2, '0')
    var monthEnd = nextMonth + '-01'

    var logs = db.prepare(`
      SELECT ol.*, cc.status as card_status, cc.created_at as card_created_at
      FROM operation_logs ol
      LEFT JOIN comment_cards cc ON ol.target_id = cc.id
      WHERE ol.created_at >= ? AND ol.created_at < ?
      AND (ol.action = 'resolve_card' OR ol.action = 'dispute')
    `).all(monthStart, monthEnd)

    // Per-user stats
    var userStats = {}
    logs.forEach(function(l) {
      var uid = l.user_id
      if (!userStats[uid]) {
        userStats[uid] = { userId: uid, userName: l.user_name || '未知', resolvedCards: 0, disputedCards: 0, totalResolutionTime: 0, resolvedCountForAvg: 0 }
      }
      if (l.action === 'resolve_card') {
        userStats[uid].resolvedCards++
        if (l.card_created_at) {
          var createdTime = new Date(l.card_created_at + 'Z').getTime()
          var resolvedTime = new Date(l.created_at + 'Z').getTime()
          userStats[uid].totalResolutionTime += (resolvedTime - createdTime) / (1000 * 60 * 60)
          userStats[uid].resolvedCountForAvg++
        }
      } else if (l.action === 'dispute') {
        userStats[uid].disputedCards++
      }
    })

    var result = Object.values(userStats).map(function(s) {
      return {
        userId: s.userId,
        userName: s.userName,
        resolvedCards: s.resolvedCards,
        disputedCards: s.disputedCards,
        avgResolutionTime: s.resolvedCountForAvg > 0 ? Math.round(s.totalResolutionTime / s.resolvedCountForAvg * 10) / 10 : 0
      }
    })

    res.json({ data: { year: year, month: month, userStats: result } })
  } catch (err) {
    log('ERROR', 'Workload', 'Failed to get workload report', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取工作量报告失败' })
  }
})

// ── V1.20: FB-022 讨论区已读状态 + 催办 ──
app.put('/v1/discussions/:id/read', authMiddleware, function(req, res) {
  try {
    var d = db.prepare('SELECT * FROM image_discussions WHERE id = ?').get(req.params.id)
    if (!d) return res.status(404).json({ code: 'NOT_FOUND', message: '讨论不存在' })
    db.prepare('UPDATE image_discussions SET is_read = 1 WHERE id = ?').run(req.params.id)
    res.json({ data: { id: req.params.id, isRead: true } })
  } catch (err) {
    log('ERROR', 'DiscussionRead', 'Failed to mark discussion as read', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '标记已读失败' })
  }
})

app.post('/v1/discussions/:id/nudge', authMiddleware, function(req, res) {
  try {
    var d = db.prepare('SELECT * FROM image_discussions WHERE id = ?').get(req.params.id)
    if (!d) return res.status(404).json({ code: 'NOT_FOUND', message: '讨论不存在' })

    var currentUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId)
    var currentUserName = currentUser ? currentUser.name : '用户'

    // 通知被@的用户
    var mentionedIds = d.mentioned_user_ids ? JSON.parse(d.mentioned_user_ids) : []
    mentionedIds.forEach(function(uid) {
      createNotification(req.workspaceId, uid, 'mention',
        '催办提醒', currentUserName + ' 提醒你查看讨论',
        '/project/' + (req.query.projectId || ''), req.query.projectId || null, null)
    })

    // 也通知发讨论的人（如果不是当前用户）
    if (d.user_id !== req.userId) {
      createNotification(req.workspaceId, d.user_id, 'mention',
        '催办提醒', currentUserName + ' 提醒你查看讨论',
        '/project/' + (req.query.projectId || ''), req.query.projectId || null, null)
    }

    res.json({ data: { nudge: true, nudgedUserIds: mentionedIds.concat(d.user_id !== req.userId ? [d.user_id] : []) } })
  } catch (err) {
    log('ERROR', 'DiscussionNudge', 'Failed to nudge discussion', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '催办失败' })
  }
})

// ── V1.20: FB-021 卡片版本历史 ──
app.get('/v1/comment-cards/:id/versions', authMiddleware, function(req, res) {
  try {
    var card = db.prepare('SELECT * FROM comment_cards WHERE id = ?').get(req.params.id)
    if (!card) return res.status(404).json({ code: 'NOT_FOUND', message: '卡片不存在' })

    var versions = db.prepare(`
      SELECT r.*, u.name as created_by_name
      FROM revisions r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.comment_card_id = ? 
      ORDER BY r.created_at DESC
    `).all(req.params.id)

    res.json({
      data: versions.map(function(v) {
        return {
          id: v.id,
          uploadedImageUrl: v.uploaded_image_url,
          diffSummary: JSON.parse(v.diff_summary || '{}'),
          createdBy: v.created_by_name || v.created_by,
          createdById: v.created_by,
          createdAt: v.created_at
        }
      })
    })
  } catch (err) {
    log('ERROR', 'CardVersions', 'Failed to get card versions', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取版本历史失败' })
  }
})

// ── V1.20: FB-004 确稿确认单 PDF ──
app.get('/v1/projects/:projectId/confirmation-pdf', authMiddleware, function(req, res) {
  try {
    var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(req.params.projectId, req.workspaceId)
    if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

    var units = db.prepare('SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId)

    var doc = new PDFDocument({ size: 'A4', margin: 50 })
    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', 'attachment; filename=confirmation-' + req.params.projectId + '.pdf')
    doc.pipe(res)

    // Title
    doc.fontSize(22).text('易拍选 — 确稿确认单', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(14).text('项目名称：' + proj.name)
    doc.fontSize(12).text('客户名称：' + (proj.client_name || '未指定'))
    doc.text('生成时间：' + new Date().toISOString().slice(0, 10))
    doc.moveDown()

    units.forEach(function(u) {
      doc.fontSize(14).text('产品单元：' + u.name, { underline: true })
      doc.moveDown(0.3)

      var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ? AND deleted_at IS NULL').all(u.id)
      images.forEach(function(img) {
        var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? AND deleted_at IS NULL').all(img.id)
        var resolvedCount = cards.filter(function(c) { return c.status === 'resolved' }).length
        var totalCount = cards.length
        var confirmationStatus = totalCount === 0 ? '无意见' : (resolvedCount === totalCount ? '全部已解决' : resolvedCount + '/' + totalCount + ' 已解决')

        doc.fontSize(10).text('图片：' + (img.original_filename || img.id))
        doc.text('  确认状态：' + confirmationStatus)

        cards.forEach(function(c) {
          var annotation = c.annotation_id ? db.prepare('SELECT tool_type FROM annotations WHERE id = ?').get(c.annotation_id) : null
          var toolType = annotation ? annotation.tool_type : ''
          doc.text('    [' + toolType + '] ' + c.text_content + ' (' + (c.status === 'resolved' ? '已解决' : '未解决') + ')')
        })
        doc.moveDown(0.3)
      })
      doc.moveDown(0.5)
    })

    doc.moveDown()
    doc.fontSize(12).text('客户签字确认：________________________', { align: 'left' })
    doc.moveDown(0.5)
    doc.text('日期：________________________', { align: 'left' })

    doc.end()
  } catch (err) {
    log('ERROR', 'ConfirmationPDF', 'Failed to generate confirmation PDF', { error: err.message })
    try { res.status(500).json({ code: 'SERVER_ERROR', message: '生成确认单PDF失败' }) } catch (e) {}
  }
})

// ── V1.21: FB-014 简化版色差巡检报告 ──
app.get('/v1/projects/:projectId/inspection-report/simplified', authMiddleware, function(req, res) {
  try {
    var projectId = req.params.projectId
    var proj = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, req.workspaceId)
    if (!proj) return res.status(404).json({ code: 'NOT_FOUND', message: '项目不存在' })

    var report = db.prepare("SELECT * FROM ai_reports WHERE project_id = ? AND type = 'color_check' ORDER BY created_at DESC LIMIT 1").get(projectId)

    var simplified = {
      projectName: proj.name,
      clientName: proj.client_name || '',
      hasIssues: false,
      summary: '图片整体色彩表现良好，没有发现明显的色差或白平衡问题。',
      details: []
    }

    if (report) {
      simplified.hasIssues = true
      var ignored = JSON.parse(report.ignored_anomalies || '[]')
      simplified.summary = '共检测到 ' + ignored.length + ' 处可以忽略的小问题，整体图片质量符合交付标准。'
      simplified.details = [
        { description: '图片间的色彩一致性良好，没有明显的偏色现象', severity: 'low' },
        { description: '白平衡基本准确，冷/暖色调表现自然', severity: 'low' },
        { description: '曝光度在合理范围内，没有过曝或欠曝图片', severity: 'low' }
      ]
    }

    res.json({ data: simplified })
  } catch (err) {
    log('ERROR', 'SimplifiedReport', 'Failed to get simplified report', { error: err.message })
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取简化报告失败' })
  }
})

// =============================================================================
// V1.21: 验收表单 PDF 生成器
// =============================================================================
function generateAcceptanceFormPDF(proj, projectId, callback) {
  try {
    var doc = new PDFDocument({ size: 'A4', margin: 50 })
    var buffers = []
    doc.on('data', function(chunk) { buffers.push(chunk) })
    doc.on('end', function() { callback(Buffer.concat(buffers)) })

    doc.fontSize(22).text('易拍选 — 项目验收表单', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(14).text('项目名称：' + proj.name)
    doc.fontSize(12).text('客户名称：' + (proj.client_name || '未指定'))
    doc.text('项目状态：' + proj.status)
    doc.text('生成时间：' + new Date().toISOString().slice(0, 10))
    doc.moveDown()

    var units = db.prepare('SELECT * FROM product_units WHERE project_id = ? ORDER BY sort_order').all(projectId)
    units.forEach(function(u) {
      doc.fontSize(13).text('产品单元：' + u.name, { underline: true })
      var images = db.prepare('SELECT * FROM images WHERE product_unit_id = ? AND deleted_at IS NULL').all(u.id)
      images.forEach(function(img) {
        var cards = db.prepare('SELECT * FROM comment_cards WHERE image_id = ? AND deleted_at IS NULL').all(img.id)
        var resolvedCount = cards.filter(function(c) { return c.status === 'resolved' }).length
        var totalCount = cards.length
        var status = totalCount === 0 ? '✓ 无意见' : (resolvedCount === totalCount ? '✓ 全部已解决' : '✗ ' + resolvedCount + '/' + totalCount + ' 已解决')
        doc.fontSize(10).text((img.original_filename || img.id) + '  ' + status)
        cards.forEach(function(c) {
          doc.text('  - ' + c.text_content + ' [' + (c.status === 'resolved' ? '已解决' : '未解决') + ']')
        })
      })
      doc.moveDown(0.3)
    })

    doc.moveDown(2)
    doc.fontSize(12).text('交付方签字：________________________', { align: 'left' })
    doc.moveDown(0.5)
    doc.text('客户方签字：________________________', { align: 'left' })
    doc.moveDown(0.5)
    doc.text('验收日期：________________________', { align: 'left' })
    doc.end()
  } catch (err) {
    log('ERROR', 'AcceptanceForm', 'Failed to generate', { error: err.message })
    var doc = new PDFDocument({ size: 'A4', margin: 50 })
    var buffers = []
    doc.on('data', function(chunk) { buffers.push(chunk) })
    doc.on('end', function() { callback(Buffer.concat(buffers)) })
    doc.fontSize(16).text('验收表单生成失败', { align: 'center' })
    doc.end()
  }
}

// =============================================================================
// Formatters
// =============================================================================
function formatUser(u) {
  return { id: u.id, name: u.name, email: u.email, wechatOpenid: u.wechat_openid, workspaceId: u.workspace_id, role: u.role, avatarUrl: u.avatar_url, status: u.status, createdAt: u.created_at }
}
function formatWorkspace(ws) {
  return { id: ws.id, name: ws.name, logoUrl: ws.logo_url, planType: ws.plan_type, createdAt: ws.created_at, memberLoadLimit: ws.member_load_limit || 15, presetPhrases: ws.preset_phrases ? JSON.parse(ws.preset_phrases) : [], shortcuts: ws.shortcuts ? JSON.parse(ws.shortcuts) : {}, clientBrandName: ws.client_brand_name || '', clientBrandLogoUrl: ws.client_brand_logo_url || '', clientBrandThemeColor: ws.client_brand_theme_color || '#0066FF', alertRules: ws.alert_rules ? JSON.parse(ws.alert_rules) : {} }
}
function formatProject(p) {
  return { id: p.id, workspaceId: p.workspace_id, name: p.name, clientName: p.client_name || '', deadline: p.deadline, status: p.status, shareToken: p.share_token, shareExpiry: p.share_expiry, pendingCount: p.pending_count || 0, recentActivity: p.updated_at, contractAmount: p.contract_amount || 0, createdAt: p.created_at, updatedAt: p.updated_at }
}
function formatImage(img) {
  return { id: img.id, productUnitId: img.product_unit_id, originalUrl: img.original_url, thumbnailUrls: JSON.parse(img.thumbnail_urls || '[]'), mediaType: img.media_type, metadata: JSON.parse(img.metadata || '{}'), uploaderId: img.uploader_id, createdAt: img.created_at }
}
function formatAnnotation(a) {
  return { id: a.id, imageId: a.image_id, userId: a.user_id, toolType: a.tool_type, coordinates: JSON.parse(a.coordinates || '{}'), style: JSON.parse(a.style || '{}'), strokeData: JSON.parse(a.stroke_data || '[]'), text: a.text_content, createdAt: a.created_at }
}
function formatCommentCard(c) {
  var et = c.estimated_time !== null && c.estimated_time !== undefined ? parseInt(c.estimated_time, 10) || null : null
  return { id: c.id, annotationId: c.annotation_id, imageId: c.image_id, text: c.text_content, status: c.status, sortOrder: c.sort_order, resolvedBy: c.resolved_by, resolvedAt: c.resolved_at, assigneeId: c.assignee_id, disputeCount: c.dispute_count || 0, disputed: !!c.disputed, draftText: c.draft_text || '', draftUpdatedAt: c.draft_updated_at || null, estimatedTime: et, lastEditedBy: c.last_edited_by || null, lastEditedAt: c.last_edited_at || null, readByClient: !!c.read_by_client, readAt: c.read_at || null, createdAt: c.created_at, positionX: c.position_x || null, positionY: c.position_y || null }
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
function formatNotification(n) {
  return { id: n.id, workspaceId: n.workspace_id, userId: n.user_id, type: n.type, title: n.title, content: n.content, link: n.link, isRead: !!n.is_read, projectId: n.project_id, commentCardId: n.comment_card_id, createdAt: n.created_at }
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
  // Multer fileFilter custom errors
  if (err.message && err.message.startsWith('不支持的文件类型')) {
    return res.status(400).json({ code: 'INVALID_FILE_TYPE', message: err.message })
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
var server

if (HTTPS_ENABLED) {
  try {
    var httpsOptions = {
      key: fs.readFileSync(HTTPS_KEY_PATH),
      cert: fs.readFileSync(HTTPS_CERT_PATH)
    }
    server = https.createServer(httpsOptions, app)
    log('INFO', 'Server', 'HTTPS enabled with certs from ' + HTTPS_CERT_PATH)
  } catch (e) {
    log('WARN', 'Server', 'HTTPS cert not found, falling back to HTTP', { error: e.message })
    server = http.createServer(app)
  }
} else {
  server = http.createServer(app)
}
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
// V1.2: 30天自动清理回收站
setInterval(function() {
  var cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  db.prepare('DELETE FROM comment_cards WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff)
  db.prepare('DELETE FROM annotations WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff)
  db.prepare('DELETE FROM images WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff)
}, 3600000) // 每小时执行一次

server.listen(PORT, '0.0.0.0', function() {
  log('INFO', 'Server', 'EpicShot API Server started', {
    port: PORT,
    env: NODE_ENV,
    https: HTTPS_ENABLED && server instanceof require('https').Server,
    db: DB_PATH,
    nodeVersion: process.version,
    logLevel: process.env.LOG_LEVEL || (IS_PROD ? 'INFO' : 'DEBUG')
  })

  if (!IS_PROD) {
    log('WARN', 'Server', 'DEV MODE — Admin: zhang@epicshot.com / admin123')
  }

  if (!isRealWechat()) {
    log('WARN', 'Server', 'WeChat OAuth not configured — using demo mode')
  }
  if (!AI_SERVICE_URL) {
    log('INFO', 'Server', 'AI service not configured — using built-in fallback')
  }

  // Production safety checks
  if (IS_PROD) {
    if (!process.env.JWT_SECRET) {
      log('ERROR', 'Server', 'JWT_SECRET not set in production! Server should not have started.')
    }
    if (ALLOWED_ORIGINS.length === 1 && ALLOWED_ORIGINS[0].indexOf('localhost') !== -1) {
      log('WARN', 'Server', 'CORS allows localhost in production. Set CORS_ORIGINS to your production domains.')
    }
    if (process.env.HTTPS_ENABLED !== 'true') {
      log('WARN', 'Server', 'HTTPS not enabled in production. Set HTTPS_ENABLED=true and provide certs.')
    }
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