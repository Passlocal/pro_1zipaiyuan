# 易拍选 (EpicShot) V1.2.0 测试文档

## 测试环境

| 项目 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3000 |
| 测试账号 | zhang@epicshot.com / admin123 |
| 数据库 | SQLite (epicshot-backend/data/epicshot.db) |

## E2E 自动化测试

### 运行方式

```bash
cd epicshot-frontend

# 安装浏览器
npx playwright install chromium

# 运行全部测试
npx playwright test

# 运行单个测试
npx playwright test -g "登录页面"

# 调试模式
npx playwright test --debug

# 查看报告
npx playwright show-report
```

### 测试用例 (11个)

| # | 用例 | 验证点 | 预期结果 |
|---|------|--------|----------|
| 1 | 登录页面渲染完整 | email/password输入框、提交按钮、注册链接 | 全部可见 |
| 2 | 空表单提交保持在登录页 | 空表单提交 | URL仍含/login |
| 3 | 注册页面可访问 | email/password/confirm输入框 | 全部可见 |
| 4 | 成功登录后跳转 | 填写正确凭证并提交 | 跳转离开/login |
| 5 | 看板页加载 | 登录后访问/dashboard | body可见 |
| 6 | 工作空间页面加载 | 登录后访问/workspace | body可见 |
| 7 | 客户端分享页加载 | 创建项目→分享→访问 | body可见 |
| 8 | 色差巡检页加载 | 创建项目→访问color-check | body可见 |
| 9 | 作品集编辑页加载 | 创建项目→访问portfolio | body可见 |
| 10 | 项目详情页加载 | 创建项目→访问详情 | body可见 |
| 11 | 404页面友好降级 | 访问不存在路径 | body可见 |

## 后端 API 测试

### 测试命令

```bash
# 健康检查
curl http://localhost:3000/health

# 登录获取Token
curl -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"zhang@epicshot.com","password":"admin123"}'

# 使用Token访问受保护接口
TOKEN="<token>"
curl http://localhost:3000/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/v1/projects \
  -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/v1/dashboard \
  -H "Authorization: Bearer $TOKEN"

# 未授权访问（应返回401）
curl http://localhost:3000/v1/projects
```

### API 接口清单

| 分类 | 接口 | 认证 |
|------|------|------|
| 健康 | GET /health | 无 |
| 认证 | POST /v1/auth/login | 限流 |
| 认证 | POST /v1/auth/register | 限流 |
| 用户 | GET /v1/users/me | JWT |
| 工作空间 | GET /v1/workspaces/mine | JWT |
| 工作空间 | PUT /v1/workspaces/mine | JWT+owner |
| 工作空间 | GET /v1/workspaces/members | JWT |
| 工作空间 | POST /v1/workspaces/invite | JWT+owner |
| 工作空间 | DELETE /v1/workspaces/members/:id | JWT+owner |
| 项目 | GET /v1/projects | JWT |
| 项目 | POST /v1/projects | JWT |
| 项目 | PUT /v1/projects/:id | JWT |
| 项目 | DELETE /v1/projects/:id | JWT |
| 项目 | POST /v1/projects/:id/share | JWT |
| 项目 | DELETE /v1/projects/:id/share | JWT |
| 项目 | POST /v1/projects/:id/complete | JWT |
| 分享 | GET /v1/share/:token | 无 |
| 图片 | GET /v1/units/:unitId/images | JWT |
| 图片 | POST /v1/units/:unitId/images | JWT |
| 图片 | GET /v1/images/:id/download | JWT |
| 批注 | GET /v1/images/:imageId/annotations | JWT |
| 批注 | POST /v1/images/:imageId/annotations | JWT |
| 批注 | PUT /v1/annotations/:id | JWT |
| 批注 | DELETE /v1/annotations/:id | JWT |
| 评论卡片 | GET /v1/images/:imageId/comment-cards | JWT |
| 评论卡片 | POST /v1/comment-cards | JWT |
| 评论卡片 | PUT /v1/comment-cards/:id | JWT |
| 评论卡片 | PUT /v1/comment-cards/:id/status | JWT |
| 看板 | GET /v1/dashboard | JWT |
| 分析 | GET /v1/analytics/dashboard | JWT |
| 分析 | GET /v1/analytics/finance | JWT |
| AI | POST /v1/ai/style-samples | JWT |
| AI | GET /v1/ai/style-samples/:taskId | JWT |
| AI | POST /v1/ai/color-check | JWT |
| AI | GET /v1/ai/color-check/:taskId | JWT |
| AI | POST /v1/ai/consistency-check | JWT |
| AI | GET /v1/ai/consistency-check/:taskId | JWT |
| 作品集 | POST /v1/projects/:id/portfolio | JWT |
| 作品集 | GET /v1/portfolios/:id | JWT |
| 作品集 | PUT /v1/portfolios/:id | JWT |
| 费用 | GET /v1/projects/:id/expenses | JWT |
| 费用 | POST /v1/projects/:id/expenses | JWT |
| 任务 | GET /v1/my-tasks | JWT |
| 通知 | GET /v1/notifications | JWT |
| 通知 | PUT /v1/notifications/:id/read | JWT |
| 回收站 | GET /v1/recycle-bin | JWT |
| 回收站 | POST /v1/recycle-bin/:type/:id/restore | JWT |
| 导入 | POST /v1/import/wechat-screenshot | JWT |
| 导出 | GET /v1/dashboard/export | JWT |
| 导出 | GET /v1/projects/:projectId/comments/export | JWT |

## 测试检查清单

### 功能测试
- [x] 邮箱密码注册/登录
- [x] 项目CRUD
- [x] 图片上传/查看
- [x] 批注创建/编辑/删除
- [x] 评论卡片状态流转
- [x] 项目分享链接
- [x] 客户端视图
- [x] 看板/分析
- [x] 工作空间管理
- [x] 回收站
- [x] 通知系统
- [x] 404页面

### 安全测试
- [x] 未授权访问返回401
- [x] JWT Token验证
- [x] 登录频率限制
- [x] XSS防护

### 移动端测试
- [x] 全部18个视图页面 ≤768px
- [x] 触控热区 ≥44px
- [x] 输入框字体 ≥16px
- [x] 弹窗宽度 94vw
- [x] 登录表单首屏可见