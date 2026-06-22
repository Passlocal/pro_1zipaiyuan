# EpicShot V1.2.0 全功能点清单

## 测试环境
- 前端URL: http://localhost:5173
- 后端API基准地址: http://localhost:3000
- 数据库: SQLite (better-sqlite3) @ /workspace/epicshot-backend/data/epicshot.db

## 测试账号

| 角色 | 邮箱 | 密码 | 权限 |
|------|------|------|------|
| Owner (管理员) | reg_owner_xxx@t.com | Test@123 | 全部权限 |
| Editor (编辑者) | reg_editor_xxx@t.com | Test@123 | 读写项目 |
| Viewer (查看者) | reg_viewer_xxx@t.com | Test@123 | 只读 |
| 未登录 | — | — | 仅公开端点 |

## 业务状态流转

### 项目状态 (project.status)
```
draft → review → in_progress → final_review → completed → archived
```

### 评论卡片状态 (comment_card.status)
```
unresolved ↔ resolved
```

### 交付任务状态 (delivery_task.status)
```
pending → processing → completed/failed
```

### 用户角色 (user.role)
```
owner / editor / viewer
```

---

## 一、页面 & 前端功能点

| 模块 | 页面 | 功能点 | 类型 | 角色可见性 |
|------|------|--------|------|------------|
| 认证 | LoginView | 邮箱登录表单 | 前端 | 公开 |
| 认证 | LoginView | 微信扫码登录 | 前端 | 公开 |
| 认证 | RegisterView | 邮箱注册表单 | 前端 | 公开 |
| 导航 | AppLayout | 侧边栏导航 (战情室/我的待办/项目看板/工作空间) | 前端 | 登录 |
| 导航 | AppLayout | 通知铃铛 | 前端 | 登录 |
| 导航 | AppLayout | 用户头像/下拉菜单 | 前端 | 登录 |
| 战情室 | WarRoomView | 项目概览卡片 | 前端 | 登录 |
| 战情室 | WarRoomView | 提醒客户按钮 | 前端 | 登录 |
| 战情室 | WarRoomView | 导出按钮 (PDF/Excel) | 前端 | 登录 |
| 待办 | MyTasksView | 待办列表 | 前端 | 登录 |
| 看板 | DashboardView | 项目列表 | 前端 | 登录 |
| 看板 | DashboardView | 新建项目按钮 | 前端 | 登录 |
| 看板 | DashboardView | 搜索筛选 | 前端 | 登录 |
| 看板 | DashboardView | 筛选模板 (保存/加载) | 前端 | 登录 |
| 看板 | DashboardView | 批量缩略图 | 前端 | 登录 |
| 工作空间 | WorkspaceView | 基本信息编辑 | 前端 | Owner |
| 工作空间 | WorkspaceView | 成员管理 (邀请/移除) | 前端 | Owner |
| 工作空间 | WorkspaceView | API Key 管理 | 前端 | Owner |
| 工作空间 | WorkspaceView | 客户端品牌设置 (Logo/名称/主题色) | 前端 | Owner |
| 工作空间 | WorkspaceView | 成员负载限制 | 前端 | Owner |
| 项目详情 | ProjectDetailView | 产品单元列表 | 前端 | 登录 |
| 项目详情 | ProjectDetailView | 图片浏览/标注 | 前端 | 登录 |
| 项目详情 | ProjectDetailView | 评论卡片 | 前端 | 登录 |
| 项目详情 | ProjectDetailView | 下载按钮 (原尺寸/Web/自定义) | 前端 | 登录 |
| 项目详情 | ProjectDetailView | 分享按钮 | 前端 | 登录 |
| 项目详情 | ProjectDetailView | 完成项目按钮 | 前端 | 登录 |
| 色差巡检 | ColorCheckView | 发起巡检 | 前端 | 登录 |
| 色差巡检 | ColorCheckView | 查看报告 | 前端 | 登录 |
| 色差巡检 | ColorCheckView | 打印按钮 | 前端 | 登录 |
| 光影一致性 | ConsistencyCheckView | 发起巡检 | 前端 | 登录 |
| 光影一致性 | ConsistencyCheckView | 查看报告 | 前端 | 登录 |
| 光影一致性 | ConsistencyCheckView | 打印按钮 | 前端 | 登录 |
| 时间轴 | TimelineView | 事件时间轴 | 前端 | 登录 |
| 时间轴 | TimelineView | 打印按钮 | 前端 | 登录 |
| 作品集 | PortfolioEditorView | 编辑作品集 | 前端 | 登录 |
| 作品集 | PortfolioViewView | 查看作品集 | 前端 | 登录 |
| 客户分享 | ClientProjectView | 公开项目查看 | 前端 | 公开 |
| 客户分享 | ClientProjectView | 品牌栏展示 | 前端 | 公开 |
| 客户资产 | ClientAssetsView | 已完成项目列表 | 前端 | 登录 |
| 客户资产 | ClientAssetsView | 图片弹窗预览 | 前端 | 登录 |
| 404 | NotFoundView | 404页面 | 前端 | 公开 |

---

## 二、后端 API 全量清单

### 2.1 认证 (Auth) — 7 端点

| 方法 | 路径 | 描述 | 角色可见性 |
|------|------|------|------------|
| POST | /v1/auth/register | 邮箱注册 | 公开 |
| POST | /v1/auth/login | 邮箱登录 | 公开 |
| GET | /v1/auth/wechat/qrcode | 微信扫码二维码 | 公开 |
| GET | /v1/auth/wechat/status/:ticket | 扫码状态查询 | 公开 |
| POST | /v1/auth/wechat/confirm/:ticket | 确认扫码 | 公开 |
| POST | /v1/auth/wechat/scan/:ticket | 模拟扫码 | 公开 |
| GET | /v1/auth/token-status | Token状态 | 登录 |

### 2.2 用户 & 工作空间 — 12 端点

| 方法 | 路径 | 描述 | 角色 |
|------|------|------|------|
| GET | /v1/users/me | 当前用户信息 | 登录 |
| GET | /v1/workspaces/mine | 当前工作空间 | 登录 |
| PUT | /v1/workspaces/mine | 更新工作空间 | Owner |
| GET | /v1/workspaces/members | 成员列表 | 登录 |
| POST | /v1/workspaces/invite | 邀请成员 | Owner |
| DELETE | /v1/workspaces/members/:userId | 移除成员 | Owner |
| POST | /v1/workspaces/api-keys | 创建API Key | Owner |
| DELETE | /v1/workspaces/api-keys | 删除API Key | Owner |
| GET | /v1/workspace/client-brand | 获取客户端品牌 | 登录 |
| PUT | /v1/workspace/client-brand | 设置客户端品牌 | Owner |
| GET | /v1/workspace/preset-phrases | 预设短语 | 登录 |
| GET | /v1/workspace/shortcuts | 快捷键 | 登录 |
| PUT | /v1/workspace/member-load-limit | 成员负载限制 | Owner |

### 2.3 项目管理 — 16 端点

| 方法 | 路径 | 描述 | 角色 |
|------|------|------|------|
| GET | /v1/projects | 项目列表 | 登录 |
| POST | /v1/projects | 创建项目 | 登录 |
| GET | /v1/projects/:id | 项目详情 | 同WS |
| PUT | /v1/projects/:id | 更新项目 | 登录 |
| DELETE | /v1/projects/:id | 删除项目(硬删除) | 登录 |
| POST | /v1/projects/:id/share | 生成分享链接 | 登录 |
| GET | /v1/share/:token | 公开分享页 | 公开 |
| DELETE | /v1/projects/:id/share | 删除分享 | 登录 |
| POST | /v1/projects/:id/complete | 标记完成 | 登录 |
| POST | /v1/projects/batch-thumbnails | 批量缩略图 | 登录 |
| PUT | /v1/projects/:id/warning-settings | 警告设置 | 登录 |
| PUT | /v1/projects/:id/client-first-visit | 客户首次访问 | 登录 |
| POST | /v1/projects/:id/modify-request | 修改请求 | 登录 |
| PUT | /v1/projects/:id/reject-confirm | 拒绝确认 | 登录 |
| POST | /v1/projects/:id/nudge | 提醒客户 | 登录 |
| GET | /v1/projects/:id/versions | 版本历史 | 登录 |

### 2.4 产品单元 — 3 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/projects/:projectId/units | 单元列表 |
| POST | /v1/projects/:projectId/units | 创建单元 |
| PUT | /v1/projects/:projectId/units/reorder | 单元排序 |

### 2.5 图片管理 — 6 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/units/:unitId/images | 图片列表 |
| POST | /v1/units/:unitId/images | 上传图片 |
| GET | /v1/images/:id/download | 下载原图 |
| GET | /v1/images/:id/signed-url | 签名URL |
| POST | /v1/projects/:id/images/filter | 图片筛选 |
| POST | /v1/images/batch-rename | 批量重命名 |

### 2.6 标注 — 4 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/images/:imageId/annotations | 标注列表 |
| POST | /v1/images/:imageId/annotations | 创建标注 |
| PUT | /v1/annotations/:id | 更新标注 |
| DELETE | /v1/annotations/:id | 删除标注(软删除) |

### 2.7 评论卡片 — 13 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/images/:imageId/comment-cards | 评论列表 |
| POST | /v1/comment-cards | 创建评论 |
| PUT | /v1/comment-cards/:id | 更新评论 |
| PUT | /v1/comment-cards/:id/status | 状态流转 |
| PUT | /v1/comment-cards/sort | 排序 |
| PUT | /v1/comment-cards/:id/assign | 分配 |
| PUT | /v1/comment-cards/:id/dispute | 争议 |
| PUT | /v1/comment-cards/:id/draft | 草稿 |
| PUT | /v1/comment-cards/:id/edit | 编辑 |
| PUT | /v1/comment-cards/:id/estimated-time | 预估工时 |
| POST | /v1/comment-cards/:cardId/sync-to-images | 同步到图片 |
| POST | /v1/comment-cards/:cardId/read-receipt | 已读回执 |
| GET | /v1/projects/:id/comments/export | 评论导出 |

### 2.8 战情室 & 看板 — 3 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/dashboard | 战情室数据 |
| GET | /v1/dashboard/export | 战情室导出(PDF/Excel) |
| GET | /v1/my-tasks | 我的待办 |

### 2.9 交付 & 导出 — 5 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /v1/projects/:projectId/delivery-package | 交付包下载 |
| POST | /v1/projects/:projectId/delivery-task | 异步交付任务 |
| GET | /v1/delivery-tasks/:taskId | 任务状态查询 |
| GET | /v1/projects/:projectId/export-zip | 导出ZIP |
| GET | /v1/projects/:projectId/export-pdf | 导出PDF |

### 2.10 AI 功能 — 9 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /v1/ai/style-samples | 生成风格样本 |
| GET | /v1/ai/style-samples/:taskId | 查询风格样本 |
| POST | /v1/ai/style-samples/:sampleId/like | 点赞 |
| POST | /v1/ai/style-samples/with-retry | 重试 |
| POST | /v1/ai/parse-instruction | 解析指令 |
| POST | /v1/ai/instructions/:id/feedback | 指令反馈 |
| PUT | /v1/ai/instructions/:id/params | 指令参数 |
| POST/GET | /v1/ai/color-check + /:taskId | 色差巡检 |
| POST/GET | /v1/ai/consistency-check + /:taskId | 光影一致性巡检 |

### 2.11 其余端点 — 30+ 端点

| 模块 | 端点数 | 端点列表 |
|------|--------|----------|
| 回收站 | 2 | GET /v1/recycle-bin, POST /v1/recycle-bin/image/:id/restore |
| 时间轴 | 1 | GET /v1/projects/:id/timeline |
| 导入 | 3 | POST /v1/import/cloud-drive, POST /v1/import/apply, POST /v1/import/wechat |
| 作品集 | 5 | POST/GET/PUT /v1/portfolios/:id, GET stats, POST cover |
| 客户端 | 1 | GET /v1/client/me/projects |
| 通知 | 5 | GET /v1/notifications, PUT /:id/read, PUT read-all, POST quick-action, GET/PUT preferences |
| 模板 | 6 | GET/POST/PUT/DELETE /v1/templates, GET preview, POST copy, POST from-template |
| 行话模板 | 4 | GET /v1/jargon-templates, GET/POST/PUT/DELETE /v1/personal-jargon-templates |
| 最近操作 | 3 | GET recent-resolved, GET recent-actions, POST undo |
| 讨论 | 2 | GET/POST /v1/images/:imageId/discussions |
| 修订 | 1 | POST /v1/images/:imageId/revision |
| 公开分享 | 2 | GET /v1/share/:token, GET /v1/share/:token/brand |

---

*总计: 126 API端点, 42 前端页面功能点*