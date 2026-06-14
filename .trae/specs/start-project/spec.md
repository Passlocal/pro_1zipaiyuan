# 启动项目 Spec

## Why

"易拍选" (EpicShot) 前端项目的源代码骨架已完成（Vue 3 + Vite + TypeScript + Pinia + Vue Router），但尚未配置可直接运行的开发服务器，也缺少启动所需的关键配套：没有配置服务器监听端口/主机，没有 Mock 数据支撑各个页面的运行时展示，缺少环境变量示例文件。开发团队需要一条 `npm run dev` 就能把项目完整跑起来，以便进行后续功能开发与联调。

## What Changes

- 为 Vite 配置开发服务器（host 0.0.0.0、port 5173、自动打开浏览器可选），保证 Linux/容器环境下可访问
- 补齐 `.env` / `.env.production` 环境变量示例文件（API Base URL、WebSocket URL）
- 在 [client.ts](file:///workspace/epicshot-frontend/src/api/client.ts#L1-L29) 使用 import.meta.env 读取环境变量（而非硬编码）
- 在全局 Pinia stores 中加入 Mock 数据初始化（projects、productUnits、images、annotations、commentCards、user info），保证首次进入各页面无需后端即可看到界面与交互
- 为 [ImageViewer.vue](file:///workspace/epicshot-frontend/src/components/viewer/ImageViewer.vue#L1-L20) 添加演示图片占位（SVG data URI），保证首次启动可即时看到 Canvas 标注
- 确保 [main.ts](file:///workspace/epicshot-frontend/src/main.ts#L1-L10) 正确挂载全局 Toast/通知组件并暴露到 window
- 添加 `dev` / `build` / `preview` / `type-check` 脚本，并写入 README 启动说明

## Impact

- Affected code: `package.json`, `vite.config.ts`, `src/api/client.ts`, `src/stores/auth.ts`, `src/stores/project.ts`, `src/stores/annotation.ts`, `src/views/project/*.vue`, `.env`, `.env.production`
- **BREAKING**: 无破坏性变更；仅为现有骨架补全启动所需配置与 Mock 数据
- Requires `npm install` followed by `npm run dev` to work

## ADDED Requirements

### Requirement: 开发服务器可启动

系统 SHALL 提供一条命令启动前端开发服务器，监听 0.0.0.0:5173，支持浏览器访问。

#### Scenario: 首次启动
- **WHEN** 开发者执行 `cd /workspace/epicshot-frontend && npm run dev`
- **THEN** Vite 服务器在 3 秒内启动，控制台打印 `Local: http://localhost:5173/`，浏览器访问该地址可看到登录/首页界面

#### Scenario: 生产构建
- **WHEN** 开发者执行 `npm run build`
- **THEN** TypeScript 类型检查通过，Vite 产出 dist/，大小主 bundle gzip < 50KB

#### Scenario: 预览生产构建
- **WHEN** 开发者执行 `npm run preview`
- **THEN** 预览服务器正常监听，dist 产物可以被访问

### Requirement: 页面 Mock 数据可浏览

系统 SHALL 在各 Pinia store 初始化时填充合理数量的 Mock 数据，保证进入 Dashboard、ProjectDetail、Timeline、ColorCheck、Workspace 等页面均能看到有意义的内容而非空状态。

#### Scenario: 进入 Dashboard
- **WHEN** 用户打开 `/`
- **THEN** 看到至少 3 张项目卡片（不同状态 + 缩略图 + 待处理标注数），可点击进入项目详情

#### Scenario: 进入项目详情
- **WHEN** 用户点击某张项目卡片
- **THEN** 看到产品单元 Tab、缩略图、图片查看器 Canvas 中预置若干示例标注、右侧意见卡片列表

#### Scenario: 标注工作流
- **WHEN** 用户在图片查看器中点击画笔/箭头/矩形工具，拖动画图
- **THEN** 新标注出现在 Canvas 上，同时右侧生成新的意见卡片

#### Scenario: 时间轴页面
- **WHEN** 用户打开 `/project/:id/timeline`
- **THEN** 看到时间轴节点（客户批注 / 修图师修改 / 确稿等）至少 4 个，支持点击展开对比视图

### Requirement: 环境变量配置

系统 SHALL 通过 `.env` 文件读取 API 配置，允许开发者不修改代码即可切换后端地址。

#### Scenario: 配置 API 地址
- **WHEN** 开发者在 `.env` 中写入 `VITE_API_URL=https://api.epicshot.com/v1`
- **THEN** 所有 API 请求使用该 Base URL；未设置时使用空字符串（CORS 由后端处理）

## MODIFIED Requirements

### Requirement: API 客户端原硬编码 URL

原有实现中 [client.ts](file:///workspace/epicshot-frontend/src/api/client.ts#L1-L29) 硬编码 Base URL，现改为读取 `import.meta.env.VITE_API_URL`。默认值为空字符串。
