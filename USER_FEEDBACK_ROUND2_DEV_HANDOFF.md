# 第二轮三角色模拟试用反馈 — 开发交付文档

**来源**: 品牌方客户 / 工作室老板 / 修图师 第二轮模拟试用反馈  
**处理人**: 产品经理  
**关联文档**: [第一轮反馈交付文档](file:///workspace/USER_FEEDBACK_DEV_HANDOFF.md) (V1.7~V1.9)  
**当前版本**: V1.9

---

## 反馈需求总览

| 编号 | 角色 | 需求摘要 | 优先级 | 预估 |
|------|------|----------|--------|------|
| DATA-02 | 老板 | 数据看板接入真实数据 | **P0** | 4h |
| DATA-03 | 修图师 | 争议历史接入真实数据 | **P0** | 3h |
| DATA-04 | 老板 | 操作日志前端查看入口 | **P0** | 3h |
| UX-28 | 修图师 | 标注草稿多项目隔离 | **P1** | 0.5h |
| UX-29 | 修图师 | 通知按分类批量已读 | **P1** | 1.5h |
| UX-30 | 客户 | 滑块对比手柄加粗 | **P1** | 0.5h |
| UX-31 | 客户 | 移动端标注工具进一步放大 | **P2** | 0.5h |

---

## 迭代规划

### V1.10（本次迭代，P0 项 3 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| DATA-02 | 数据看板接入真实数据 | 老板 | 4h |
| DATA-03 | 争议历史接入真实数据 | 修图师 | 3h |
| DATA-04 | 操作日志前端查看入口 | 老板 | 3h |

**V1.10 合计**: 10h

### V1.11（后续迭代，P1 项 3 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| UX-28 | 标注草稿多项目隔离 | 修图师 | 0.5h |
| UX-29 | 通知按分类批量已读 | 修图师 | 1.5h |
| UX-30 | 滑块对比手柄加粗 | 客户 | 0.5h |

**V1.11 合计**: 2.5h

### V1.12（远期迭代，P2 项 1 项）

| 编号 | 条目 | 角色 | 预估 |
|------|------|------|------|
| UX-31 | 移动端标注工具进一步放大 | 客户 | 0.5h |

**V1.12 合计**: 0.5h

---

## 详细条目

---

### DATA-02: 数据看板接入真实数据 [P0]

**用户原话**: "数据看板那几个数字是写死的吧？12 个项目、3.5 天平均确稿，我需要看到真实数据，按月份筛选。"

**当前行为**: [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue#L215-L229) 中 `analytics` ref 全部硬编码：
- `totalProjects: 12`、`avgReviewDays: 3.5`、`completionRate: 92`、`totalImages: 248`
- `memberEfficiency` 数组也是写死的四个成员

**验收标准**:
1. 数据看板 4 个 KPI 卡片（总项目数、平均确稿周期、完成率、总图片数）从后端 API 实时获取
2. 修图师效率排行从后端统计真实数据
3. 支持按月份筛选（默认当月）
4. 数据为 0 时显示合理的空状态，不显示假数据

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 前端
- [server.js](file:///workspace/epicshot-backend/server.js) — 后端新增统计 API

**技术要点**:
- 后端新增 `GET /v1/analytics/dashboard?month=2026-06`，返回:
  ```json
  {
    "totalProjects": 12,
    "avgReviewDays": 3.5,
    "completionRate": 92,
    "totalImages": 248,
    "memberEfficiency": [{"id":"1","name":"小王","efficiency":15}, ...]
  }
  ```
- 统计数据来源：`projects` 表（总数、完成率）、`comment_cards` 表（确稿周期）、`images` 表（图片总数）
- 前端 `onMounted` 时调用 API 替换 mock 数据

---

### DATA-03: 争议历史接入真实数据 [P0]

**用户原话**: "争议历史弹窗显示'批注内容将在后端API接入后显示'，这就是个占位符，我需要看到真实的驳回记录。"

**当前行为**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L455-L460) 中驳回历史弹窗内容为硬编码 mock：
```html
<span class="rejection-time">最近驳回</span>
<span class="rejection-by">由 老板</span>
<p class="rejection-reason">批注内容将在后端API接入后显示</p>
```

**验收标准**:
1. 争议卡片点击争议次数，展开历史记录弹窗，显示真实驳回记录列表
2. 每条记录显示：驳回时间、驳回人、驳回原因（批注内容快照）
3. 支持从历史记录跳转到对应图片
4. 无驳回记录时显示空状态

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 前端
- [server.js](file:///workspace/epicshot-backend/server.js) — 后端新增 API

**技术要点**:
- 后端新增 `GET /v1/cards/:cardId/rejection-history`，返回驳回记录数组
- 数据来源：`comment_cards` 表已有 `dispute_count` 字段，需增加 `rejection_history` 表或在 `operation_logs` 中按 `action='dispute_card'` 查询
- 前端 `openRejectionHistory(cardId)` 调用 API 获取真实数据，替换当前 mock 内容

---

### DATA-04: 操作日志前端查看入口 [P0]

**用户原话**: "你说有操作日志，但我找了半天没找到在哪里看。项目详情页、战情室、工作空间，都没有入口。"

**当前行为**: 后端 [server.js](file:///workspace/epicshot-backend/server.js#L1555-L1573) 已实现两个 API：
- `GET /v1/projects/:projectId/logs` — 项目操作日志（最近 100 条）
- `GET /v1/users/:userId/logs` — 用户操作日志（最近 50 条）

但前端 [router/index.ts](file:///workspace/epicshot-frontend/src/router/index.ts) 中无对应路由，无任何查看页面。

**验收标准**:
1. 项目详情页顶部操作栏增加「操作日志」按钮，点击展开抽屉/侧边面板
2. 日志列表显示：时间、操作人、操作类型、操作详情
3. 操作类型用不同图标/颜色区分（创建卡片=绿、驳回=红、完成=蓝 等）
4. 支持按操作类型筛选

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 新增日志抽屉
- [router/index.ts](file:///workspace/epicshot-frontend/src/router/index.ts) — 可选：独立日志页路由

**技术要点**:
- 在 ProjectDetailView 中新增 `showOperationLogs` ref + 日志抽屉模板
- 调用已有 `GET /v1/projects/:projectId/logs` API
- 操作类型中文映射：`create_card`→创建卡片, `resolve_card`→解决卡片, `dispute_card`→驳回卡片, `complete_project`→完成项目
- 抽屉样式参考已有的 rejection-history-panel 设计

---

### UX-28: 标注草稿多项目隔离 [P1]

**用户原话**: "我在项目 A 修了一半，切到项目 B 看了一眼，再切回来草稿没了。这自动保存能不能只保存到当前项目？"

**当前行为**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L731-L741) 使用单一 `sessionStorage` key：
```typescript
const DRAFT_KEY = 'epicshot_annotation_draft'
// saveDraft: sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
// loadDraft: sessionStorage.getItem(DRAFT_KEY)
```
虽然 draft 对象中包含 `projectId` 和 `imageId` 用于校验，但 key 是全局唯一的，切换项目时旧草稿会被覆盖。

**验收标准**:
1. 草稿 key 改为 `epicshot_annotation_draft_${projectId}_${imageId}`，每个项目+图片独立存储
2. 同项目同图片切换回来时，草稿仍在
3. 不同项目的草稿互不影响

**涉及文件**: [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L731-L736)

**技术要点**:
- 将 `DRAFT_KEY` 改为 computed：`const draftKey = computed(() => \`epicshot_annotation_draft_${projectId.value}_${currentImageId.value}\`)`
- `saveDraft` 和 `loadDraft` 中使用 `draftKey.value`
- 提交标注后清除对应 key 的草稿

---

### UX-29: 通知按分类批量已读 [P1]

**用户原话**: "全部已读一键清空太粗暴了。我有 5 条修改请求和 3 条系统通知，只想把修改请求的已读，系统通知还要留着看。"

**当前行为**: [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue#L44) 只有「全部已读」按钮，调用 `markAllRead()` 一次性标记所有通知为已读。但通知已有分类筛选标签（全部/修改请求/系统通知/催稿提醒）。

**验收标准**:
1. 在分类筛选标签栏右侧增加「标记此分类已读」按钮
2. 当用户选中某个分类（如「修改请求」）时，按钮文案变为「修改请求全部已读」
3. 在「全部」分类下，按钮文案保持「全部已读」
4. 操作后 Toast 反馈：「已标记 N 条修改请求为已读」

**涉及文件**: [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue)

**技术要点**:
- 新增 `markCategoryRead()` 函数，根据 `activeTab.value` 过滤通知后批量标记已读
- 按钮文案改为 computed：`activeTab.value ? notificationTabs.find(t=>t.value===activeTab.value)?.label + '全部已读' : '全部已读'`
- 后端需新增 `PUT /v1/notifications/mark-read-by-category?type=modify_request` 或前端循环调用单条已读 API

---

### UX-30: 滑块对比手柄加粗 [P1]

**用户原话**: "滑块对比那条线太细了，手机上根本拖不动，手指一按就挡住了。"

**当前行为**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L2253-L2257) 中 `.slider-handle-line` 宽度为 `3px`：
```scss
.slider-handle-line {
  width: 3px;
  height: 100%;
  background: #1a73e8;
  box-shadow: 0 0 4px rgba(0,0,0,0.3);
}
```

**验收标准**:
1. 桌面端滑块手柄线宽 `3px → 5px`
2. 移动端（≤768px）滑块手柄线宽 `5px → 8px`，并增大触摸热区到 44px 宽
3. 箭头按钮 `padding: 4px 8px → 6px 10px`，`font-size: 12px → 14px`

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L2240-L2268)

**技术要点**:
- 修改 `.slider-handle-line` width: `3px → 5px`
- 在 `@media (max-width: 768px)` 中覆盖为 `width: 8px`，并给 `.slider-handle` 增加 `min-width: 44px` 触摸热区
- `.slider-handle-arrow` 在移动端增大 padding 和 font-size

---

### UX-31: 移动端标注工具进一步放大 [P2]

**用户原话**: "标注工具图标在手机上还是偏小，我的手指比较粗，经常点错工具。"

**当前行为**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L2512-L2522) 中移动端标注工具图标 20px（UX-24 已从 16px → 20px）：
```scss
.tool-icon-svg { width: 20px !important; height: 20px !important; }
.tool-label { font-size: 12px; }
.tool-btn { padding: 10px 6px; }
```

**验收标准**:
1. 移动端标注工具图标 `20px → 24px`
2. 工具按钮 `padding: 10px 6px → 12px 8px`
3. 确保按钮之间间距足够，不会误触

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L2512-L2522)

**技术要点**:
- 修改 `.tool-icon-svg` 为 `width: 24px; height: 24px`
- 修改 `.tool-btn` padding 为 `12px 8px`
- 修改 `.tool-label` font-size 为 `13px`

---

*产品经理: 已评审，请按 V1.10 范围（P0 3项）执行，V1.11（P1 3项）和 V1.12（P2 1项）排入后续迭代*