# 易拍选 (EpicShot) V1.2.0 开发文档

## 项目概述

易拍选是专业摄影审片协作平台，服务于摄影工作室与客户之间的照片审片、批注、确稿流程。

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | Vue 3 + TypeScript | 3.5 |
| 构建工具 | Vite | 8.0 |
| 状态管理 | Pinia | 3.0 |
| 路由 | Vue Router | 4.6 |
| 样式 | SCSS Modules | - |
| 后端框架 | Express.js | 5.2 |
| 数据库 | SQLite (better-sqlite3) | 12.10 |
| 认证 | JWT + bcryptjs | - |
| 安全 | Helmet + express-rate-limit | - |
| 图片处理 | Sharp | 0.35 |
| 文件上传 | Multer | 2.1 |
| 实时通信 | WebSocket (ws) | 8.21 |
| E2E测试 | Playwright | 1.61 |

## 项目结构

```
/workspace/
├── epicshot-frontend/          # 前端项目
│   ├── src/
│   │   ├── api/                # API 调用封装
│   │   │   ├── ai.ts           # AI服务接口
│   │   │   ├── auth.ts         # 认证接口
│   │   │   ├── dashboard.ts   # 看板接口
│   │   │   └── client.ts       # 客户端请求封装
│   │   ├── assets/styles/      # 全局样式
│   │   │   ├── variables.scss  # SCSS变量/品牌色
│   │   │   └── global.scss     # 全局样式
│   │   ├── components/
│   │   │   ├── common/         # 通用组件
│   │   │   │   ├── Button.vue
│   │   │   │   ├── Modal.vue
│   │   │   │   ├── StatCard.vue
│   │   │   │   └── NotificationBell.vue
│   │   │   ├── layout/
│   │   │   │   └── AppLayout.vue  # 主布局
│   │   │   ├── project/        # 项目相关组件
│   │   │   └── viewer/         # 图片查看器组件
│   │   ├── composables/        # 组合式函数
│   │   │   └── useWebSocket.ts
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia状态管理
│   │   │   ├── auth.ts
│   │   │   └── project.ts
│   │   ├── types/              # TypeScript类型
│   │   ├── utils/              # 工具函数
│   │   └── views/              # 视图页面
│   │       ├── auth/           # LoginView, RegisterView
│   │       ├── client/         # ClientProjectView, ClientAssetsView
│   │       ├── dashboard/      # WarRoomView, MyTasksView
│   │       ├── portfolio/      # PortfolioEditorView, PortfolioViewView
│   │       ├── project/        # DashboardView, ProjectDetailView, TimelineView, ColorCheckView, ConsistencyCheckView
│   │       ├── reports/        # ReportsView
│   │       └── workspace/      # WorkspaceView
│   ├── e2e/                    # E2E测试
│   │   └── epicshot.spec.ts
│   ├── vite.config.ts
│   └── package.json
├── epicshot-backend/           # 后端项目
│   ├── server.js               # 主入口（Express路由、中间件、数据库）
│   ├── data/                   # SQLite数据库文件
│   ├── uploads/                # 上传文件存储
│   └── package.json
└── docs/                       # 项目文档
```

## 启动命令

### 开发环境

```bash
# 后端
cd epicshot-backend
npm install
node server.js          # 默认端口 3000

# 前端
cd epicshot-frontend
npm install
npx vite --host 0.0.0.0 --port 5173
```

### 生产构建

```bash
# 前端
cd epicshot-frontend
npm run build           # 产出 dist/ 目录

# 后端
cd epicshot-backend
NODE_ENV=production node server.js
```

## 开发命令

```bash
cd epicshot-frontend

# 类型检查
npm run type-check      # vue-tsc --noEmit

# 构建
npm run build           # vue-tsc -b && vite build

# E2E测试
npx playwright install chromium
npx playwright test
```

## 数据库

### 表结构

| 表名 | 用途 |
|------|------|
| `users` | 用户（含微信openid、角色、工作空间） |
| `workspaces` | 工作空间 |
| `projects` | 项目（含分享token、状态、预警设置） |
| `units` | 拍摄单元（项目内的分组） |
| `images` | 图片（含版本号、文件路径） |
| `annotations` | 批注（含坐标、颜色、文本） |
| `comment_cards` | 评论卡片（含状态流转、指派） |
| `portfolios` | 作品集 |
| `ai_style_samples` | AI风格样片 |
| `project_expenses` | 项目费用 |
| `notifications` | 通知 |
| `activity_logs` | 操作日志 |
| `recycle_bin` | 回收站 |

### 迁移

```sql
-- 模式：ALTER TABLE ADD COLUMN
-- 示例：
ALTER TABLE projects ADD COLUMN closed_at TEXT;
ALTER TABLE projects ADD COLUMN archived_at TEXT;
```

## 关键设计决策

### 移动端适配
- 断点统一: `max-width: 768px`
- 触控热区: 按钮 ≥44px，输入框字体 ≥16px
- 弹窗宽度: 94vw
- 登录页: 移动端隐藏品牌面板，表单直接可见

### 安全
- JWT Token 认证
- express-rate-limit 登录频率限制
- XSS防护: sanitize 中间件
- Helmet 安全头
- 密码: bcryptjs 10轮哈希

### AI 成本控制（4层）
1. 24小时结果缓存
2. 每项目每天50次上限
3. 完成/归档项目自动关闭(403)
4. 月≥200次内部预警

### 品牌色
- 主色: `#2D2D3F`
- 背景: `#F5F3F1`
- 圆角: 8px