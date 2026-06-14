# Checklist

- [ ] Vite 开发服务器正确配置，执行 `npm run dev` 能看到 `Local: http://localhost:5173/`
- [ ] `.env` 与 `.env.production` 环境变量文件存在，包含 `VITE_API_URL` / `VITE_WS_URL`
- [ ] `src/api/client.ts` 使用 `import.meta.env.VITE_API_URL` 作为 Base URL，而非硬编码
- [ ] Dashboard (首页) 展示至少 3 张项目卡片，显示状态、缩略图、待处理数
- [ ] 点击项目卡片可以路由到 ProjectDetail，展示产品单元 Tab 与图片缩略图
- [ ] ProjectDetail 图片查看器可看到 Canvas 上的示例标注与右侧意见卡片
- [ ] 可以在图片查看器中绘制新标注（画笔/箭头/矩形），新标注即时显示并生成意见卡片
- [ ] Timeline 页面展示至少 4 个时间轴节点，支持点击对比视图
- [ ] ColorCheck 页面展示巡检结果列表
- [ ] Workspace 页面展示工作空间信息与成员管理表格
- [ ] `npm run type-check` 执行通过，0 error
- [ ] `npm run build` 成功产出 dist/
