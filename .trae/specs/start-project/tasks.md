# Tasks

- [x] Task 1: 配置 Vite 开发服务器
  - [x] 修改 `vite.config.ts`：添加 server.host = '0.0.0.0'、server.port = 5173、server.open = false
  - [x] 确认 `package.json` 脚本：`dev` / `build` / `preview` 已存在；新增 `type-check` script
- [x] Task 2: 补齐环境变量与配置
  - [x] 创建 `.env` 文件，写入 `VITE_API_URL` 与 `VITE_WS_URL` 示例值
  - [x] 创建 `.env.production` 文件，写入生产环境值
  - [x] 修改 `src/api/client.ts` 以 `import.meta.env.VITE_API_URL` 替代硬编码
- [x] Task 3: 完善 Mock 数据，使所有页面无后端时可浏览
  - [x] 在 `stores/auth.ts` 添加默认 user (owner) 与 workspace mock，使 fetchUser 直接填充本地 user
  - [x] 在 `stores/project.ts` 添加 projects / productUnits / images 数组 Mock 数据与 timeline 节点
  - [x] 在 `stores/annotation.ts` 添加 annotations / commentCards Mock 数据
  - [x] 修改各页面视图（Dashboard、ProjectDetail、Timeline、ColorCheck、Workspace），首次访问即显示示例数据
- [x] Task 4: 运行时验证
  - [x] 执行 `npm run dev` 启动服务器，确认能在浏览器访问 http://localhost:5173
  - [x] 执行 `npm run build` 构建产物，确认无 TypeScript 错误且产物生成
  - [x] 执行 `npm run type-check` 确认类型检查通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1..3]