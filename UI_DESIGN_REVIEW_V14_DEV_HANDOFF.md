# UI 设计评审 V1.4 — 开发交付文档

**来源**: 资深UI/UX设计师对 V1.3 实施后全量设计评审（第二轮）  
**评审日期**: 2026-06-17  
**处理人**: 产品经理  
**目标版本**: V1.4

---

## 评审背景

V1.3 P0 7项 + 部分 P1 5项已全部实施并测试通过。本轮评审基于实施后的产品现状，识别剩余问题和新发现的问题。

---

## 问题分级总览

| 编号 | 类型 | 优先级 | 摘要 | 涉及范围 | 预估工时 |
|------|------|--------|------|----------|----------|
| A11Y-01 | 适配 | **P0** | 客户端确稿页移动端适配 | 前端 | 4h |
| EMO-03 | 情感化 | **P0** | 全站骨架屏推广 | 前端 | 4h |
| INT-03 | 交互 | **P0** | 通知分类筛选 Tab | 前端 | 3h |
| NAV-02 | 导航 | **P1** | 面包屑导航 | 前端 | 2h |
| BRN-02 | 品牌 | **P1** | 客户端品牌色限制 | 前端 | 2h |
| EMO-01 | 情感化 | **P1** | 次要页面空状态引导 | 前端 | 2h |
| INT-01 | 交互 | **P1** | 更多下拉点击外部关闭 | 前端 | 0.5h |
| A11Y-02 | 无障碍 | **P1** | 图标 aria-label | 前端 | 1h |
| BRN-01 | 品牌 | **P1** | Emoji / Lucide 使用规范 | 前端 | 1h |
| INT-02 | 交互 | **P2** | 意见卡片拖拽手柄 | 前端 | 1h |
| EMO-02 | 情感化 | **P2** | Toast 文案情感化 | 前端 | 1h |
| A11Y-03 | 无障碍 | **P2** | 颜色选择器键盘导航 | 前端 | 1h |
| A11Y-04 | 无障碍 | **P2** | 图片查看器快捷键 | 前端 | 2h |
| NAV-01 | 导航 | **P2** | 侧边栏折叠按钮图标 | 前端 | 0.5h |
| VIS-04 | 视觉 | **P2** | 客户端进度条硬编码颜色 | 前端 | 0.5h |

**V1.4 合计**: 25.5h

---

## 迭代规划

### V1.4（本次迭代，P0 + P1 项）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| A11Y-01 | 客户端确稿页移动端适配 | 4h |
| EMO-03 | 全站骨架屏推广 | 4h |
| INT-03 | 通知分类筛选 Tab | 3h |
| NAV-02 | 面包屑导航 | 2h |
| BRN-02 | 客户端品牌色限制 | 2h |
| EMO-01 | 次要页面空状态引导 | 2h |
| INT-01 | 更多下拉点击外部关闭 | 0.5h |
| A11Y-02 | 图标 aria-label | 1h |
| BRN-01 | Emoji / Lucide 使用规范 | 1h |

**V1.4 合计**: 19.5h

### V1.5（后续迭代，P2 项）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| INT-02 | 意见卡片拖拽手柄 | 1h |
| EMO-02 | Toast 文案情感化 | 1h |
| A11Y-03 | 颜色选择器键盘导航 | 1h |
| A11Y-04 | 图片查看器快捷键 | 2h |
| NAV-01 | 侧边栏折叠按钮图标 | 0.5h |
| VIS-04 | 客户端进度条硬编码颜色 | 0.5h |

**V1.5 合计**: 6h

---

## 详细条目

---

### A11Y-01: 客户端确稿页移动端适配 [P0]

**设计师原话**: "客户在微信内置浏览器中打开确稿页面时体验极差。所有页面在 < 768px 下不可用。"

**当前行为**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) 无任何响应式设计
- 图片查看器、意见卡片面板、工具栏均为桌面端固定布局

**验收标准**:
1. 移动端（< 768px）：图片查看器全屏显示，支持双指缩放和滑动切换
2. 底部 Sheet 面板：显示意见卡片列表，可上拉展开
3. 浮动标注按钮：固定在右下角，点击展开标注工具栏
4. 品牌栏保持顶部固定，高度自适应
5. 确稿按钮大号、固定在底部，触摸热区 ≥ 48px

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue)

**实现要点**:
- 使用 CSS `@media (max-width: 768px)` 媒体查询
- 图片查看器使用 `touch-action: pan-x pan-y pinch-zoom`
- 底部 Sheet 使用 `transform: translateY()` 动画
- 触摸滑动使用 `@touchstart` / `@touchmove` / `@touchend`

---

### EMO-03: 全站骨架屏推广 [P0]

**设计师原话**: "全站加载状态仍为'加载中...'文字，与客户端已实现的骨架屏形成反差。"

**当前行为**:
- 战情室、项目看板、我的待办加载时显示"加载中..."文字
- 客户端确稿页（PERF-01）已有骨架屏实现

**验收标准**:
1. 战情室加载：统计卡片骨架（5个占位块）+ 项目列表骨架（3条）
2. 项目看板加载：项目卡片骨架（3x2 网格）
3. 我的待办加载：任务卡片骨架（3条）
4. 骨架屏统一使用 CSS 动画（`shimmer` 效果），颜色与设计系统一致

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue)
- [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue)
- [MyTasksView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/MyTasksView.vue)

**实现要点**:
```scss
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: $radius-sm;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### INT-03: 通知分类筛选 Tab [P0]

**设计师原话**: "所有类型通知混在一起，通知量大时难以快速定位。"

**当前行为**:
- [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue) 下拉列表所有通知平铺，无分类

**验收标准**:
1. 下拉列表顶部增加分类 Tab：全部 / 修改请求 / 系统通知 / 催稿提醒
2. 未读通知使用蓝色左边框标记（替代仅靠小圆点）
3. 增加「仅显示未读」开关
4. 快捷操作按钮颜色：同意驳回 = 绿色，拒绝 = 灰色

**涉及文件**:
- [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue)

**实现要点**:
```html
<div class="filter-tabs">
  <button v-for="tab in tabs" class="filter-tab" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
    {{ tab.label }}
  </button>
</div>
```

---

### NAV-02: 面包屑导航 [P1]

**设计师原话**: "子页面深度导航后无法快速返回。"

**当前行为**:
- 所有子页面只有「← 返回」按钮，无层级路径

**验收标准**:
1. 项目详情页顶部：`项目看板 > 项目名称`
2. 子页面（时间轴、色差巡检、光影巡检、作品集）：`项目看板 > 项目名称 > 当前页面`
3. 每个层级可点击跳转

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)
- [TimelineView.vue](file:///workspace/epicshot-frontend/src/views/project/TimelineView.vue)
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue)
- [ConsistencyCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ConsistencyCheckView.vue)
- [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue)

---

### BRN-02: 客户端品牌色限制 [P1]

**设计师原话**: "品牌色可应用于操作按钮，存在与功能色（红/绿）冲突的风险。"

**当前行为**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) 品牌色应用无限制
- 进度条使用 `brand.themeColor || '#0066FF'`，存在硬编码

**验收标准**:
1. 品牌色仅应用于：品牌栏、Logo、进度条，不应用于操作按钮
2. 自定义品牌色自动校验：亮度太低或与功能色冲突时自动调整
3. 进度条硬编码 `#0066FF` fallback 改为 `$color-brand`

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue)

---

### EMO-01: 次要页面空状态引导 [P1]

**设计师原话**: "时间轴、色差巡检、作品集等页面空状态仍为'图标 + 一行文字'。"

**当前行为**:
- 时间轴空状态：`📅 暂无时间轴记录`
- 色差巡检空状态：`🔍 点击"一键巡检"开始分析色差`
- 作品集空状态未确认

**验收标准**:
1. 时间轴空状态：增加引导文案「项目进行中时，修改记录将自动汇聚于此」
2. 色差巡检空状态：保持现有设计，增加折叠式「巡检能发现什么」说明区
3. 作品集空状态：增加引导文案 + CTA

**涉及文件**:
- [TimelineView.vue](file:///workspace/epicshot-frontend/src/views/project/TimelineView.vue)
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue)
- [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue)

---

### INT-01: 更多下拉点击外部关闭 [P1]

**设计师原话**: "点击外部区域不会自动关闭菜单。"

**当前行为**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) 更多下拉菜单仅通过点击按钮关闭

**验收标准**:
1. 点击下拉菜单外部区域自动关闭
2. 使用 `onMounted` / `onUnmounted` 注册/移除 `document.click` 监听

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)

---

### A11Y-02: 图标 aria-label [P1]

**设计师原话**: "Lucide 图标均缺少 aria-label，屏幕阅读器无法识别。"

**当前行为**:
- 所有 Lucide 图标无 `aria-label` 属性

**验收标准**:
1. 所有功能性 Lucide 图标添加 `aria-label` 属性
2. 纯装饰性图标添加 `aria-hidden="true"`

**涉及文件**:
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue) — 导航图标
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 工具栏图标
- [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue) — 铃铛/齿轮图标
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — 浮动按钮

---

### BRN-01: Emoji / Lucide 使用规范 [P1]

**设计师原话**: "新的 Lucide 图标与残留的 Emoji 混用，需要明确规范。"

**当前行为**:
- 空状态、错误状态、提示文案中仍使用 Emoji（⚠️、🎉、🔍、📸、📅）
- 功能性图标已迁移至 Lucide

**验收标准**:
1. 制定规范：功能性→Lucide，情感化→Emoji 可保留
2. 功能性警告图标（⚠️）替换为 `<AlertTriangle>`
3. 空状态、成功提示的 Emoji 保留

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 警报横幅 ⚠️
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 错误状态 ⚠️
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue) — 错误状态 ⚠️

---

*产品经理: 已评审，请按 V1.4 范围（P0 3项 + P1 6项）执行，V1.5（P2 6项）排入后续迭代*