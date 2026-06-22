# 第五轮三角色模拟试用反馈 — 开发交付文档

**来源**: 品牌方客户 / 工作室老板 / 修图师 第五轮模拟试用反馈  
**处理人**: 产品经理  
**关联文档**: [第四轮反馈交付文档](file:///workspace/USER_FEEDBACK_ROUND4_DEV_HANDOFF.md) (V1.17)  
**当前版本**: V1.18  
**交付状态**: ✅ V1.18 已交付 (2026-06-18)

---

## 与第四轮规划的对比分析

第四轮已规划 V1.18~V1.19 共 10 项。第五轮反馈中：

| 状态 | 条目 | 说明 |
|------|------|------|
| ⬆️ **升级为 P0** | UX-48 AI微调、UX-50 快捷键 | 客户提了 3 次 / 三角色全提，不能再拖 |
| ✅ **确认 P1** | UX-49 预加载、UX-52 待办筛选、UX-55 模板 | 多角色反复提及，优先级稳固 |
| 🆕 **新增 P1** | UX-57 合同金额分阶段 | 老板新需求，关联 DATA-06 财务统计 |
| 🆕 **新增 P2** | UX-58 交付包异步打包 | 老板新需求，大文件体验优化 |
| 🆕 **新增 P3** | UX-59 @mention 微信推送 | 修图师新需求，DATA-07 增强 |
| ➡️ **维持 P2** | UX-53 放大镜、UX-54 预计时间、DATA-08 工时、UX-56 自定义颜色 | 多次提及但非阻塞 |
| ~~删除~~ | ~~UX-51 创建时上传图片~~ | 已在 V1.17 中实现 |

---

## 迭代规划

### V1.18（本次迭代，P0/P1 项 6 项）

| 编号 | 条目 | 角色 | 优先级 | 预估 | 来源 |
|------|------|------|--------|------|------|
| UX-48 | AI风格微调滑块 | 客户 | P0 | 3h | 客户提 3 次 |
| UX-50 | 键盘快捷键 | 三角色 | P0 | 2h | 三角色全提 |
| UX-49 | 快速流转图片预加载 | 修图师 | P1 | 2h | 修图师提 2 次 |
| UX-52 | 待办列表筛选 | 修图师 | P1 | 1.5h | 修图师提 2 次 |
| UX-55 | 作品集多模板 | 老板 | P1 | 4h | 老板提 2 次 |
| UX-57 | 合同金额分阶段 | 老板 | P1 | 2h | 第五轮新增 |

**V1.18 合计**: 14.5h

**V1.18 交付状态**: ✅ 全部完成 (2026-06-18)

| 条目 | 状态 | 说明 |
|------|------|------|
| UX-48 AI风格微调 | ✅ | 选中风格后显示强度滑块(0-100%)，通过 filter 参数插值实现实时预览 |
| UX-50 键盘快捷键 | ✅ | Ctrl+Enter 提交、工具切换(A/P/R/T)、Esc 关闭、文本框焦点保护 |
| UX-49 图片预加载 | ✅ | 使用 new Image() + requestIdleCallback 预加载后续 2 张图片 |
| UX-52 待办筛选 | ✅ | 全部/争议/临期/正常 4 标签 + 项目下拉筛选 |
| UX-55 作品集多模板 | ✅ | 杂志风/电商风/极简风/婚礼风 4 套模板，CSS 变量切换 |
| UX-57 合同金额分阶段 | ✅ | 前端添加付款阶段 UI + 后端 payment_stages 表 |

**前端构建**: ✅ 通过 (vue-tsc + vite build)  
**后端服务**: ✅ 正常启动

### V1.19（后续迭代，P2 项 5 项）

| 编号 | 条目 | 角色 | 优先级 | 预估 | 来源 |
|------|------|------|--------|------|------|
| UX-53 | 手机端标注放大镜 | 客户 | P2 | 4h | 客户提 2 次 |
| UX-54 | 审片页预计完成时间 | 客户 | P2 | 1h | 第四轮 |
| DATA-08 | 成员工时统计 | 老板 | P2 | 5h | 老板提 2 次 |
| UX-56 | 标注工具自定义颜色 | 修图师 | P2 | 1h | 第四轮 |
| UX-58 | 交付包后台异步打包 | 老板 | P2 | 3h | 第五轮新增 |

**V1.19 合计**: 14h

### V1.20（远期规划，P3 项 1 项）

| 编号 | 条目 | 角色 | 优先级 | 预估 | 来源 |
|------|------|------|--------|------|------|
| UX-59 | @mention 微信模板消息推送 | 修图师 | P3 | 4h | 第五轮新增 |

---

## 详细条目

---

### UX-48: AI风格微调滑块 [P0 ← 原 P2]

**用户原话**: "AI 风格还是没有微调，我选暖色，它就给我一个固定效果，太黄了我也没办法调。上次我就提过这个，到现在还没做。"（客户，第 3 次提出）

**当前行为**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L136-L152) AI 风格 2×2 网格，点击后直接应用 CSS filter 效果，无微调。

**验收标准**:
1. 选中 AI 风格方向后，弹出微调弹窗
2. 弹窗包含强度滑块（0~100%），默认 100%
3. 滑块拖动时实时预览效果
4. 确认后应用最终效果
5. 弹窗包含"取消"按钮，取消后恢复原图

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — AI 风格微调弹窗

**技术要点**:
- 新增 `aiStyleIntensity` ref（0~1）
- 实时预览：watch `aiStyleIntensity`，通过 CSS filter 插值实现（如 `sepia(0.3 * intensity)`）
- 当前 AI 风格使用 CSS filter 模拟，微调通过调整 filter 各参数与 intensity 的乘积实现
- 4 种风格对应的基础 filter 值：
  - 暖色: `sepia(0.3) saturate(1.2) brightness(1.05)`
  - 冷色: `sepia(0) saturate(0.8) brightness(1.1) hue-rotate(-10deg)`
  - 自然光: `saturate(1.1) contrast(1.05)`
  - INS: `sepia(0.1) saturate(1.3) contrast(1.1) brightness(1.05)`

---

### UX-50: 键盘快捷键 [P0 ← 原 P2]

**用户原话**: "我上次就说了想要 Ctrl+Enter 提交、左右箭头切换图片。现在还是得用鼠标点，快速流转模式下不够'快'。"（修图师，第 2 次提出）

**当前行为**: [ImageViewer.vue](file:///workspace/epicshot-frontend/src/components/viewer/ImageViewer.vue) 仅有 `+`/`-`/`0`/`f` 快捷键，无提交/切换图片/切换工具快捷键。

**验收标准**:
1. `Ctrl+Enter` / `Cmd+Enter`：提交当前卡片（快速流转模式下触发"提交并下一张"）
2. `→` 右箭头：切换到下一张图片
3. `←` 左箭头：切换到上一张图片
4. `A`：切换到箭头工具
5. `P`：切换到画笔工具
6. `R`：切换到矩形工具
7. `T`：切换到文字工具
8. `Esc`：关闭当前弹窗/模态框
9. 快捷键仅在图片查看器聚焦且不在文本输入时生效

**涉及文件**:
- [ImageViewer.vue](file:///workspace/epicshot-frontend/src/components/viewer/ImageViewer.vue) — 键盘事件处理
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 提交/切换图片方法暴露

**技术要点**:
- 在 `onKeydown` 中增加 case 分支
- 通过 `emit` 通知父组件执行提交/切换操作
- 判断焦点状态：`document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA'`
- 工具切换快捷键不区分大小写（`a`/`A` 均可）

---

### UX-49: 快速流转图片预加载 [P1 ← 原 P2]

**用户原话**: "快速流转模式还是不够快，切换图片的时候有时候还是有白屏闪烁。上次提的图片预加载到现在还没做。"（修图师，第 2 次提出）

**当前行为**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) 快速流转模式切换到下一张时，`currentImageIndex` 变更触发图片重新加载，有短暂白屏。

**验收标准**:
1. 快速流转模式下，提前加载下一张图片（预加载当前 +1 和 +2 两张）
2. 切换时图片已缓存，无白屏闪烁
3. 预加载失败时降级为正常加载，不影响功能
4. 使用 `requestIdleCallback` 在空闲时预加载，避免阻塞主线程

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 快速流转逻辑

**技术要点**:
- 使用 `new Image()` 预加载：`const img = new Image(); img.src = nextImageUrl`
- 在 `submitAndNext()` 提交前就开始预加载下一张
- 预加载队列：提前加载当前图片 +1 和 +2 两张
- 使用 `requestIdleCallback` 或 `setTimeout(fn, 0)` 在空闲时预加载

---

### UX-52: 待办列表筛选 [P1 ← 原 P2]

**用户原话**: "我有时候想只看争议卡片、只看临期卡片、只看某个项目的卡片，现在只能看全部，按优先级排序。如果能有筛选栏就好了。"（修图师，第 2 次提出）

**当前行为**: [MyTasksView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/MyTasksView.vue) 待办列表按优先级排序展示所有任务，无筛选。

**验收标准**:
1. 待办列表顶部增加筛选栏
2. 筛选选项：全部 / 争议 / 临期 / 正常
3. 支持按项目筛选（下拉选择项目名）
4. 筛选后实时更新列表，无闪烁
5. 筛选栏显示当前筛选条件下的任务数量

**涉及文件**:
- [MyTasksView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/MyTasksView.vue) — 筛选栏 UI + 过滤逻辑

**技术要点**:
- 新增 `activeFilter` ref：`'all' | 'dispute' | 'urgent' | 'normal'`
- 新增 `selectedProjectFilter` ref
- `filteredTasks` computed：先按状态过滤，再按项目过滤
- 筛选栏 UI：标签页切换 + 项目下拉选择器
- 争议判定：`task.disputed === true`
- 临期判定：`task.deadline && new Date(task.deadline) < Date.now() + 86400000`

---

### UX-55: 作品集多模板 [P1 ← 原 P3]

**用户原话**: "作品集模板还是只有一种，电商风、极简风、婚礼风这些都没做。成品展示给客户的时候，只有一种模板显得不够专业。"（老板，第 2 次提出）

**当前行为**: [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue) 仅一种模板（杂志风）。

**验收标准**:
1. 作品集模板选择增加至 4 种：
   - 杂志风（现有，保留）
   - 电商风（大图+价格标签占位+商品信息卡片）
   - 极简风（白底+居中排版+大间距）
   - 婚礼风（柔和色调+花边装饰+脚本字体）
2. 模板预览缩略图，点击切换
3. 切换模板时保留已添加的图片和封面设置

**涉及文件**:
- [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue) — 模板选择器 + 模板渲染

**技术要点**:
- 定义 `TemplateConfig` 类型：`{ layout: 'grid'|'masonry'|'single', gap: number, bgColor: string, fontFamily: string, accentColor: string }`
- 4 种模板配置：
  - 杂志风: `{ layout: 'masonry', gap: 12, bgColor: '#1a1a1a', fontFamily: 'serif', accentColor: '#e63946' }`
  - 电商风: `{ layout: 'grid', gap: 16, bgColor: '#ffffff', fontFamily: 'sans-serif', accentColor: '#ff6600' }`
  - 极简风: `{ layout: 'single', gap: 24, bgColor: '#fafafa', fontFamily: 'sans-serif', accentColor: '#333333' }`
  - 婚礼风: `{ layout: 'grid', gap: 8, bgColor: '#fdf6f0', fontFamily: 'cursive', accentColor: '#c9a96e' }`
- 模板切换时仅更新 CSS 变量，不重新渲染图片列表

---

### UX-57: 合同金额分阶段 [P1] 🆕

**用户原话**: "合同金额只能填总数，不能分阶段。有时候项目是分阶段付款的（定金 30% + 尾款 70%），只有总金额字段不够用。"（老板）

**当前行为**: [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue) 创建项目时仅有一个合同金额总数字段。

**验收标准**:
1. 创建项目时合同金额区域支持添加付款阶段
2. 默认显示"合同总金额"输入框（现有行为）
3. 点击"添加付款阶段"后，展开阶段列表：
   - 阶段名称（如"定金"、"尾款"）
   - 阶段金额
   - 阶段比例（自动计算）
4. 各阶段金额之和自动校验，不等于总金额时提示
5. 创建项目 API 携带 `contract_amount` 和 `payment_stages` 数组

**涉及文件**:
- [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue) — 创建项目弹窗
- [server.js](file:///workspace/epicshot-backend/server.js) — `POST /v1/projects` 接收 `payment_stages` 并存储

**技术要点**:
- 前端 `paymentStages` 数组：`[{ name: string, amount: number }]`
- 后端新增 `payment_stages` 表或 JSON 字段：`CREATE TABLE IF NOT EXISTS payment_stages (id TEXT, project_id TEXT, name TEXT, amount REAL, sort INTEGER, created_at TEXT)`
- 降级方案：如果不想新增表，可在 `projects` 表增加 `payment_stages` JSON 字段
- 战情室财务统计复用现有 `GET /v1/analytics/finance` API，按阶段汇总

---

### UX-53: 手机端标注放大镜 [P2]

**用户原话**: "手机端标注还是不够精准，虽然有了箭头和细线，但手指画画的时候还是容易画偏。上次提的放大镜辅助还没影。"（客户，第 2 次提出）

**当前行为**: 无手机端标注优化，Canvas 标注在触摸屏上操作精度不足。

**验收标准**:
1. 手机端标注时，手指按住区域上方出现圆形放大镜（直径 120px）
2. 放大镜内显示手指下方区域的 2x 放大视图
3. 手指松开后放大镜消失
4. 仅在手机端（触摸设备）启用

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — 手机端标注区域

**技术要点**:
- 检测触摸设备：`'ontouchstart' in window`
- 使用 Canvas 绘制放大镜：截取手指下方区域，`ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)` 放大 2x
- 放大镜定位：跟随手指位置，偏移到手指上方 60px
- 放大镜圆形遮罩：使用 `ctx.clip()` 裁剪为圆形

---

### UX-54: 审片页预计完成时间 [P2]

**用户原话**: "我审完片之后，不知道修图师大概什么时候能修完。虽然状态条告诉我处理中，但我还是想知道大概还要等多久。"（客户）

**验收标准**:
1. 审片页面顶部（进度条旁）显示预计完成时间，如"预计 6月20日前完成"
2. 时间基于项目截止日期或图片数量 × 平均修图时间估算
3. 如果存在延迟风险，显示橙色预警

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — 顶部信息栏
- [server.js](file:///workspace/epicshot-backend/server.js) — 分享 API 返回 `estimatedCompletion`

---

### DATA-08: 成员工时统计 [P2]

**用户原话**: "成员负载的数据不够细，只能看到任务数，看不到每个成员花了多少时间。对于管理来说，工时数据比任务数更重要。"（老板，第 2 次提出）

**验收标准**:
1. 成员详情面板增加"本月工时"统计
2. 工时统计基于卡片处理时间（从指派到解决的时间差）
3. 显示每个成员在每个项目上的工时分布

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 成员详情面板
- [server.js](file:///workspace/epicshot-backend/server.js) — 新增 `GET /v1/analytics/member-hours?month=`

---

### UX-56: 标注工具自定义颜色 [P2]

**用户原话**: "四种颜色红黄蓝白，有时候想用绿色标注'已确认'，或者用紫色标注'待讨论'，调不了。"（修图师）

**验收标准**:
1. 颜色选择器增加"自定义"入口
2. 点击后弹出颜色选择器（color picker），支持 HEX 输入
3. 自定义颜色可保存为常用色（最多 4 个）

**涉及文件**:
- [ImageViewer.vue](file:///workspace/epicshot-frontend/src/components/viewer/ImageViewer.vue) — 颜色选择器 UI
- [models.ts](file:///workspace/epicshot-frontend/src/types/models.ts#L93) — `AnnotationColor` 类型扩展

---

### UX-58: 交付包后台异步打包 [P2] 🆕

**用户原话**: "大项目（100+张图）打包的时候还是要等几十秒，没有一个'后台打包，完成后通知我'的选项。"（老板）

**当前行为**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L701) `downloadWithFormat` 同步请求，等待 zip 生成完成后下载。

**验收标准**:
1. 大文件（>50MB 或 >50张图）自动切换为异步打包模式
2. 异步模式下，前端显示"打包中，完成后将通知您下载"
3. 打包完成后创建通知，点击通知触发下载
4. 打包中的项目显示进度百分比

**涉及文件**:
- [server.js](file:///workspace/epicshot-backend/server.js) — 新增 `POST /v1/projects/:projectId/delivery-task` 创建异步任务
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 异步打包 UI

**技术要点**:
- 后端 `POST /v1/delivery-tasks` 创建任务记录，返回 `taskId`
- 后端 `GET /v1/delivery-tasks/:taskId` 返回进度 `{ progress, status, downloadUrl }`
- 使用 `setInterval` 或 SSE 轮询进度
- 打包完成后写入 `delivery_files` 表，生成临时下载链接

---

### UX-59: @mention 微信模板消息推送 [P3] 🆕

**用户原话**: "虽然站内通知有了，但客户如果不在平台上，还是看不到。如果能有微信推送就更好了。"（修图师）

**当前行为**: [server.js](file:///workspace/epicshot-backend/server.js#L3392) `createNotification` 创建站内通知，无微信推送。

**验收标准**:
1. @mention 创建的站内通知同步触发微信模板消息推送
2. 微信模板消息内容："修图师在项目「XX」中追问了你"
3. 点击模板消息后跳转到对应图片的讨论区
4. 微信推送失败时不影响站内通知，记录失败日志

**涉及文件**:
- [server.js](file:///workspace/epicshot-backend/server.js) — 微信模板消息推送逻辑

**技术要点**:
- 需要配置微信公众平台模板消息：
  - 模板 ID
  - 模板字段：`{{first.DATA}}` = 标题，`{{keyword1.DATA}}` = 项目名，`{{keyword2.DATA}}` = 追问内容摘要
- 调用微信 API：`POST https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=TOKEN`
- 需要用户已绑定微信（`users` 表 `wechat_openid` 字段）
- 降级方案：无 openid 或推送失败时仅记录日志

---

## 附录：第五轮评分趋势

| 轮次 | 客户 | 老板 | 修图师 | 平均 |
|------|------|------|--------|------|
| 第三轮 | 8.5 | 8.0 | 8.5 | 8.33 |
| 第四轮 | 8.5 | 8.0 | 8.5 | 8.33 |
| 第五轮 | 8.5 | 8.5 | 8.5 | **8.50** |

趋势：平台体验趋于稳定，老板评分从 8.0 升至 8.5（合同金额闭环 + 交付包 Excel），三角色评分首次持平。反馈从"功能缺失"转向"效率优化"。

---

*产品经理: 已评审，请按 V1.18 范围（P0/P1 6项）执行，V1.19（P2 5项）和 V1.20（P3 1项）排入后续迭代*