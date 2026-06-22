# 三角色模拟试用反馈 — 开发交付文档

**来源**: 品牌方客户 / 工作室老板 / 修图师 模拟试用反馈  
**处理人**: 产品经理  
**关联文档**: 三轮设计评审交付文档 (V1.3~V1.6)  
**当前版本**: V1.6

---

## 反馈需求总览

| 编号 | 角色 | 需求摘要 | 优先级 | 预估 |
|------|------|----------|--------|------|
| UX-10 | 修图师 | 争议卡片驳回历史记录 | **P0** | 3h |
| UX-11 | 修图师 | 快速流转工具栏状态保持 | **P0** | 1h |
| UX-12 | 客户 | 已阅/无需修改快捷标记 | **P0** | 2h |
| UX-13 | 修图师 | 标注草稿自动保存 | **P0** | 2h |
| UX-14 | 客户 | 滑块对比模式 | **P0** | 3h |
| DATA-01 | 老板 | 工作空间（品牌设置 + 模板） | **P0** | 4h |
| UX-15 | 修图师 | 讨论区 @ 提及 | **P1** | 3h |
| UX-16 | 修图师 | 通知批量已读 | **P1** | 1h |
| UX-17 | 老板 | 成员负载详情面板 | **P1** | 2h |
| UX-18 | 老板 | 产品单元二级分类 | **P1** | 3h |
| UX-19 | 修图师 | 修改前后对比快捷入口 | **P1** | 1h |
| UX-20 | 老板 | 色差巡检 → 修图师工作台联动 | **P1** | 3h |
| UX-21 | 客户 | AI 风格样片自定义参考图 | **P1** | 4h |
| UX-22 | 老板 | 作品集多模板 | **P2** | 3h |
| UX-23 | 老板 | 数据看板/经营统计 | **P2** | 6h |
| UX-24 | 客户 | 移动端标注工具视觉放大 | **P2** | 0.5h |
| UX-25 | 客户 | 底部面板回到顶部按钮 | **P2** | 0.5h |
| UX-26 | 客户 | 底部 Sheet 手柄视觉加粗 | **P2** | 0.5h |
| UX-27 | 全角色 | 全链路操作日志 | **P2** | 5h |

---

## 迭代规划

### V1.7（本次迭代，P0 项 6 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| UX-10 | 争议卡片驳回历史记录 | 修图师 | 3h |
| UX-11 | 快速流转工具栏状态保持 | 修图师 | 1h |
| UX-12 | 已阅/无需修改快捷标记 | 客户 | 2h |
| UX-13 | 标注草稿自动保存 | 修图师 | 2h |
| UX-14 | 滑块对比模式 | 客户 | 3h |
| DATA-01 | 工作空间（品牌设置 + 模板） | 老板 | 4h |

**V1.7 合计**: 15h

### V1.8（后续迭代，P1 项 7 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| UX-15 | 讨论区 @ 提及 | 修图师 | 3h |
| UX-16 | 通知批量已读 | 修图师 | 1h |
| UX-17 | 成员负载详情面板 | 老板 | 2h |
| UX-18 | 产品单元二级分类 | 老板 | 3h |
| UX-19 | 修改前后对比快捷入口 | 修图师 | 1h |
| UX-20 | 色差巡检 → 修图师工作台联动 | 老板 | 3h |
| UX-21 | AI 风格样片自定义参考图 | 客户 | 4h |

**V1.8 合计**: 17h

### V1.9（远期迭代，P2 项 5 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| UX-22 | 作品集多模板 | 老板 | 3h |
| UX-23 | 数据看板/经营统计 | 老板 | 6h |
| UX-24 | 移动端标注工具视觉放大 | 客户 | 0.5h |
| UX-25 | 底部面板回到顶部按钮 | 客户 | 0.5h |
| UX-26 | 底部 Sheet 手柄视觉加粗 | 客户 | 0.5h |
| UX-27 | 全链路操作日志 | 全角色 | 5h |

**V1.9 合计**: 15.5h

---

## 详细条目

---

### UX-10: 争议卡片驳回历史记录 [P0]

**用户原话**: "争议卡片只有数字，不知道每次驳回的原因是什么。"

**当前行为**: 争议卡片显示「争议 N 次」计数器，但无法查看每次驳回的具体原因。

**验收标准**:
1. 争议卡片上点击争议次数，展开历史记录抽屉/弹窗
2. 每次驳回记录显示：驳回时间、驳回人、驳回原因（批注内容）
3. 支持快速跳转到对应图片查看驳回时的标注

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

**技术要点**:
- 后端已有 `comment_cards` 表，需新增 `rejection_history` 表或复用现有 `status_changes` 逻辑
- 每次驳回时记录驳回原因快照（批注文字）

---

### UX-11: 快速流转工具栏状态保持 [P0]

**用户原话**: "跳到下一张又变回默认的指针，还得重新选颜色。"

**当前行为**: 快速流转模式切换图片后，标注工具栏状态（选中工具、颜色、宽度）重置为默认值。

**验收标准**:
1. 快速流转模式下，切换图片时保持工具栏状态不变
2. 状态包括：当前选中工具、画笔颜色、画笔宽度、箭头宽度
3. 退出快速流转模式或手动刷新页面时重置

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

**技术要点**:
- 在 `annotationStore` 中维护一个 `sessionState` 对象
- 切换图片时保留 `sessionState`，不调用 `resetTool()`

---

### UX-12: 已阅/无需修改快捷标记 [P0]

**用户原话**: "我看完一张图想标记一下'这张不用改了'，但没找到这个功能。"

**当前行为**: 客户只能标注修改意见，无法标记「无需修改」或「已阅」。

**验收标准**:
1. 客户端图片查看器增加「已阅/无需修改」按钮
2. 标记后图片上显示 `✓ 已确认` 状态标签
3. 已标记的图片在修图师端显示绿色确认状态
4. 统计面板中显示「已确认 N 张」

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue)
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

**技术要点**:
- 客户端按钮：`POST /v1/images/:imageId/mark-reviewed`
- 后端新增 `image_reviews` 表或复用 `comment_cards` 表增加 `type='reviewed'`

---

### UX-13: 标注草稿自动保存 [P0]

**用户原话**: "修到一半客户来了个电话，回来发现页面刷新了，标注丢了。"

**当前行为**: 标注仅在内存中，页面刷新后丢失。

**验收标准**:
1. 标注操作每秒自动保存到 `sessionStorage`
2. 页面刷新后，自动恢复未提交的标注
3. 恢复时显示 Toast：「已恢复未保存的标注」
4. 标注提交后清除草稿

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

**技术要点**:
- 在 `annotationStore` 的每次操作后，将当前标注列表序列化到 `sessionStorage`
- `onMounted` 时检查是否有草稿，有则恢复

---

### UX-14: 滑块对比模式 [P0]

**用户原话**: "能不能加一个滑块拖拽的对比模式？从中间拖一条线，左边原图右边修改后。"

**当前行为**: 修改前后对比只支持左右分屏模式。

**验收标准**:
1. 客户端增加「滑块对比」模式按钮
2. 滑块可拖拽，左侧显示原图、右侧显示修改后成片
3. 滑块位置可拖拽 0% ~ 100%
4. 现有的左右分屏模式保留，三种模式可切换（左右/滑块/叠加）

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue)

**技术要点**:
- 使用 CSS `clip-path` 或 `overflow: hidden` + `transform: translateX()` 实现
- 滑块拖拽使用 `@mousedown` + `@mousemove` + `@mouseup`（桌面端）和 `@touchstart` + `@touchmove` + `@touchend`（移动端）

---

### DATA-01: 工作空间（品牌设置 + 模板） [P0]

**用户原话**: "工作空间页面还是空白的，我本来想在这里设置品牌信息和通知模板。"

**当前行为**: 工作空间页面（`/workspace`）几乎为空。

**验收标准**:
1. 品牌设置 Tab：Logo 上传、品牌色选择、品牌名称
2. 通知模板 Tab：催稿模板、确稿提醒模板、驳回通知模板，支持变量占位符（{客户名}、{项目名}、{图片数}）
3. 成员管理 Tab：已有（保留）
4. 品牌设置保存后，客户端确稿页自动应用品牌信息

**涉及文件**:
- [WorkspaceView.vue](file:///workspace/epicshot-frontend/src/views/workspace/WorkspaceView.vue)
- 后端新增 API

**技术要点**:
- 品牌设置：`PUT /v1/workspaces/:id/brand`
- 通知模板：`GET/PUT /v1/workspaces/:id/templates`
- 模板变量替换：`{clientName}`、`{projectName}`、`{imageCount}`

---

### UX-15: 讨论区 @ 提及 [P1]

**用户原话**: "我想 @老板 确认一个事情，但只能发文字，不知道老板能不能看到。"

**验收标准**:
1. 讨论区输入框支持 `@用户名` 触发下拉选择
2. 被 @ 的用户收到独立通知
3. 被 @ 的用户名在消息中高亮显示（蓝色）

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

---

### UX-16: 通知批量已读 [P1]

**用户原话**: "今天收到了 8 条通知，希望有个批量已读。"

**验收标准**:
1. 通知下拉列表顶部增加「全部已读」按钮
2. 支持按分类批量已读（如「修改请求全部已读」）
3. 操作后 Toast 反馈

**涉及文件**: [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue)

---

### UX-17: 成员负载详情面板 [P1]

**用户原话**: "只显示每个人有几个任务，但看不到任务是什么。"

**验收标准**:
1. 战情室成员面板点击展开，显示该成员当前任务列表
2. 每项任务显示：项目名、任务类型、截止时间、优先级
3. 支持从面板直接跳转到对应项目

**涉及文件**: [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue)

---

### UX-18: 产品单元二级分类 [P1]

**用户原话**: "电饭煲下面有白色款和黑色款，我想建两层结构。"

**验收标准**:
1. 产品单元支持创建子单元
2. 图片查看器支持树形结构展示
3. 拖拽图片到子单元

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)
- 后端 `product_units` 表新增 `parent_id` 字段

---

### UX-19: 修改前后对比快捷入口 [P1]

**用户原话**: "上传成片后找不到对比在哪里看。"

**验收标准**:
1. 意见卡片「已解决」状态旁增加「查看对比」按钮
2. 点击后弹出对比弹窗，默认显示原图 vs 成片
3. 支持三种对比模式切换

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

---

### UX-20: 色差巡检 → 修图师工作台联动 [P1]

**用户原话**: "检测出来偏蓝了，还得手动去修。"

**验收标准**:
1. 色差巡检结果页增加「创建修图任务」按钮
2. 点击后自动生成修图任务，包含色差数据（色温偏差值、建议调整方向）
3. 修图师待办列表中出现该任务，卡片上显示色差数据

**涉及文件**:
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue)
- 后端新增 API

---

### UX-21: AI 风格样片自定义参考图 [P1]

**用户原话**: "我们公司有自己的品牌色，能不能上传一张参考图？"

**验收标准**:
1. AI 风格样片面板增加「上传参考图」按钮
2. 上传后 AI 以参考图为基准生成风格样片
3. 生成的样片标注「基于参考图生成」

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue)

---

### P2 项简要说明

| 编号 | 说明 |
|------|------|
| UX-22 | 作品集增加 3-5 个布局模板（网格/瀑布流/杂志风） |
| UX-23 | 数据看板：月接单量、平均确稿周期、修图师效率排行、客户满意度 |
| UX-24 | 移动端标注工具图标从 16px → 20px 视觉尺寸 |
| UX-25 | 底部面板增加「回到顶部」浮动按钮 |
| UX-26 | 底部 Sheet 手柄从 4px → 6px 高度 |
| UX-27 | 全链路操作日志：项目操作记录、卡片流转记录、通知发送记录 |

---

*产品经理: 已评审，请按 V1.7 范围（P0 6项）执行，V1.8（P1 7项）和 V1.9（P2 5项）排入后续迭代*