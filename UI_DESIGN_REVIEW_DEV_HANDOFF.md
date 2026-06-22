# UI 设计评审 — 开发交付文档

**来源**: 资深UI/UX设计师（SaaS/B端产品方向）对 V1.2.0 全量设计评审  
**评审日期**: 2026-06-17  
**处理人**: 产品经理  
**目标版本**: V1.3 / V1.4

---

## 评审覆盖范围

10 个核心页面 + 设计系统 + 6 个维度（信息架构、视觉层级、交互细节、情感化设计、品牌一致性、无障碍）

---

## 问题分级总览

| 编号 | 类型 | 优先级 | 摘要 | 涉及范围 | 预估工时 |
|------|------|--------|------|----------|----------|
| DS-01 | 导航 | **P0** | 按角色区分导航和默认首页 | 前端 | 4h |
| DS-02 | 视觉 | **P0** | 战情室红黄绿灯视觉冲击力不足 | 前端 | 3h |
| DS-03 | 布局 | **P0** | 项目详情页顶部工具栏严重拥挤 | 前端 | 4h |
| DS-04 | 交互 | **P0** | 标注工具栏切换不直观 | 前端 | 3h |
| DS-05 | 情感化 | **P0** | 全站空状态页面过于简陋 | 前端 | 6h |
| DS-06 | 品牌 | **P0** | 图标系统完全依赖 Emoji | 前端 | 8h |
| DS-07 | 无障碍 | **P0** | 色差巡检红绿标识对色盲不友好 | 前端 | 2h |
| DS-08 | 布局 | **P1** | 侧边栏宽 260px → 220px | 前端 | 1h |
| DS-09 | 视觉 | **P1** | 建立字体层级变量系统 | 前端 | 2h |
| DS-10 | 适配 | **P1** | 主站页面移动端适配 | 前端 | 8h |
| DS-11 | 交互 | **P1** | 通知铃铛增加分类筛选 | 前端 | 3h |
| DS-12 | 视觉 | **P1** | 品牌色硬编码统一为 SCSS 变量 | 前端 | 2h |
| DS-13 | 品牌 | **P1** | 客户端品牌色限制应用范围 | 前端 | 2h |
| DS-14 | 情感化 | **P1** | 加载状态增加骨架屏 | 前端 | 4h |
| DS-15 | 无障碍 | **P1** | 移动端触摸热区 ≥ 44px | 前端 | 2h |
| DS-16 | 导航 | **P2** | 项目详情页增加面包屑导航 | 前端 | 2h |
| DS-17 | 交互 | **P2** | 意见卡片拖拽增加视觉手柄 | 前端 | 1h |
| DS-18 | 情感化 | **P2** | Toast 文案情感化 | 前端 | 1h |
| DS-19 | 无障碍 | **P2** | 文本对比度提升至 WCAG AA | 前端 | 2h |

---

## 迭代规划

### V1.3（本次迭代，P0 项）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| DS-01 | 按角色区分导航和默认首页 | 4h |
| DS-02 | 战情室红黄绿灯增强 | 3h |
| DS-03 | 项目详情页工具栏分组收纳 | 4h |
| DS-04 | 标注工具栏视觉优化 | 3h |
| DS-05 | 全站空状态重新设计 | 6h |
| DS-06 | 引入图标库替换 Emoji | 8h |
| DS-07 | 色差巡检色盲友好 | 2h |

**V1.3 合计**: 30h

### V1.4（后续迭代，P1/P2 项）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| DS-08 | 侧边栏宽度调整 | 1h |
| DS-09 | 字体层级变量系统 | 2h |
| DS-10 | 主站移动端适配 | 8h |
| DS-11 | 通知分类筛选 | 3h |
| DS-12 | 品牌色变量统一 | 2h |
| DS-13 | 客户端品牌色限制 | 2h |
| DS-14 | 骨架屏推广 | 4h |
| DS-15 | 触摸热区优化 | 2h |
| DS-16 | 面包屑导航 | 2h |
| DS-17 | 拖拽手柄 | 1h |
| DS-18 | 情感化 Toast | 1h |
| DS-19 | 文本对比度 | 2h |

**V1.4 合计**: 30h

---

## 详细条目

---

### DS-01: 按角色区分导航和默认首页 [P0]

**设计师原话**: "所有登录用户展示完全相同的4个导航项，不做角色区分。老板的核心场景是'战情室→项目看板'，修图师的核心场景是'我的待办→项目详情'。"

**当前行为**:
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue#L16-L32) 所有角色看到相同导航
- 默认首页 `/` 固定为战情室

**验收标准**:
1. Owner 角色：默认首页为战情室，导航显示「战情室 / 项目看板 / 工作空间」（隐藏「我的待办」或移至底部）
2. Editor 角色：默认首页为我的待办，导航显示「我的待办 / 项目看板」（隐藏「战情室」或显示为次要入口）
3. 侧边栏底部显示当前角色标签（"管理者" / "修图师"）
4. 路由守卫根据角色 redirect 到正确的首页

**涉及文件**:
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue) — 导航条件渲染
- [router/index.ts](file:///workspace/epicshot-frontend/src/router/index.ts) — 默认路由 redirect

**实现要点**:
```typescript
// 在 AppLayout 中根据 auth.user.role 条件渲染导航项
const isOwner = computed(() => auth.user?.role === 'owner')
// 导航项使用 v-if="isOwner" 或 v-if="!isOwner" 控制显示
```

---

### DS-02: 战情室红黄绿灯视觉冲击力增强 [P0]

**设计师原话**: "健康度指示器仅为一个 10px 圆点，红色项目行的背景色几乎不可见。这个页面的核心价值就是'一眼看到哪些项目出问题了'。"

**当前行为**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue#L48-L52) 健康度指示器 10px 圆点
- 红色行背景 `rgba(#ea4335, 0.04)` 几乎不可见

**验收标准**:
1. 红色项目行：左侧 3px 红色边框 + 背景色提升至 `rgba(#ea4335, 0.06)` + 项目名加粗为 `font-weight: 600`
2. 红色圆点增加脉冲发光动画：`box-shadow: 0 0 8px rgba(#ea4335, 0.4)` + 现有 pulse 动画
3. 统计卡片中"红灯预警"卡片使用红色顶部边框（3px）替代当前左边框，数字使用红色
4. 页面顶部增加汇总横幅：「⚠️ 3 个项目需要关注（2 红灯 · 1 黄灯）」，仅在有红/黄灯时显示

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 模板 + 样式

**具体改动**:
- `.health-indicator.red` 增加 `box-shadow: 0 0 8px rgba(#ea4335, 0.4)`
- `.project-row.health-red` 背景改为 `rgba(#ea4335, 0.06)`，增加 `border-left: 3px solid #ea4335`
- `.stat-card--red` 边框从 `border-left` 改为 `border-top: 3px solid #ea4335`
- 新增 `.alert-banner` 组件在 `.stats-row` 上方

---

### DS-03: 项目详情页顶部工具栏分组收纳 [P0]

**设计师原话**: "顶部工具栏塞入了 9 个按钮，在 1366px 宽屏幕上就已经很拥挤，且按钮之间没有视觉分组。"

**当前行为**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L18-L67) 10 个按钮平铺

**验收标准**:
1. 保留 4 个核心按钮在工具栏：「分享」「下载」「交付包」「时间轴」
2. 其余 5 个功能（抽查、最近操作、色差巡检、光影巡检、导出意见、作品集）收入「更多」下拉菜单（⋮ 图标按钮）
3. 按钮间距统一为 8px
4. 下载按钮的格式下拉与「下载」按钮合并为一个 split button（左侧主按钮=默认下载，右侧箭头=格式选择）

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 模板重构

**实现要点**:
```html
<!-- 核心操作 -->
<button class="btn-toolbar">🔗 分享</button>
<button class="btn-toolbar">⬇ 下载 ▾</button>  <!-- split button -->
<button class="btn-toolbar">📦 交付包</button>
<button class="btn-toolbar">📅 时间轴</button>

<!-- 更多菜单 -->
<div class="more-menu-wrap">
  <button class="btn-toolbar" @click="showMore = !showMore">⋮ 更多</button>
  <div v-if="showMore" class="more-dropdown">
    <button @click="...">🔍 抽查</button>
    <button @click="...">📋 最近操作</button>
    <button @click="...">✨ 色差巡检</button>
    <button @click="...">💡 光影巡检</button>
    <button @click="...">📥 导出意见</button>
    <button @click="...">📖 作品集</button>
  </div>
</div>
```

---

### DS-04: 标注工具栏视觉优化 [P0]

**设计师原话**: "标注工具栏使用纯图标按钮，没有文字标签。颜色选择器是 4 个小圆点，没有当前选中色的视觉反馈。"

**当前行为**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue#L122-L167) 工具栏纯图标，颜色 20x20px 圆点

**验收标准**:
1. 工具栏按钮默认显示图标 + 文字标签（如「✏️ 画笔」「□ 矩形」「T 文字」）
2. 颜色选择器：当前选中色放大为 28px + 外圈 2px 白色环 + 2px 品牌色环，非选中色保持 20px
3. 画笔宽度选择器：改为可视化预览——每个按钮内显示一条实际粗细的横线，替代纯文字"2px/4px/6px"
4. 增加「选择/指针」工具作为默认工具，避免误触标注

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 标注工具栏模板 + 样式
- [ImageViewer.vue](file:///workspace/epicshot-frontend/src/components/viewer/ImageViewer.vue) — 可能需要新增 pointer 工具模式

**实现要点**:
```html
<!-- 工具按钮改为图标+文字 -->
<button class="tool-btn" :class="{ active: activeTool === 'pointer' }" title="选择">
  <span>🖱️</span> <span class="tool-label">选择</span>
</button>
<button class="tool-btn" :class="{ active: activeTool === 'pen' }" title="画笔">
  <span>✏️</span> <span class="tool-label">画笔</span>
</button>
<!-- ... -->

<!-- 画笔宽度可视化 -->
<button class="width-btn" :class="{ active: activeWidth === 2 }">
  <span class="width-preview" style="height: 2px"></span> 2px
</button>
```

---

### DS-05: 全站空状态重新设计 [P0]

**设计师原话**: "整个产品的空状态几乎都是'图标 + 一行文字'的极简模式。对于 B 端付费产品，这种空状态会让新用户感到产品'空荡荡的'。"

**当前行为**: 所有页面空状态为图标 + 一行文字，无引导

**验收标准**:

**战情室空状态（最重要）**:
1. 展示几何插画（CSS 纯绘或 SVG）：空画布 + 相机图标
2. 主文案：「开始你的第一个项目」
3. 副文案：「创建项目后，这里将显示项目健康度、团队负载和关键指标」
4. CTA 按钮：「+ 创建第一个项目」（大号、品牌色、hover 时箭头微动）
5. 下方 3 个步骤卡片（横向排列）：
   - ① 创建项目 → "设置项目名称、截止日期和客户信息"
   - ② 上传图片 → "按产品单元组织图片，支持批量上传"
   - ③ 分享给客户 → "生成分享链接，客户在微信中即可审片"

**我的待办空状态**:
1. 主文案：「全都搞定了！🎉」
2. 副文案：「所有待处理任务已完成」
3. 按钮：「前往项目看板」

**色差巡检 / 光影巡检空状态**:
1. 已有一定设计基础，增加折叠式「巡检能发现什么」说明区

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 空状态模板
- [MyTasksView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/MyTasksView.vue) — 空状态模板
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue) — 说明区
- [ConsistencyCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ConsistencyCheckView.vue) — 说明区

**实现要点**:
- 战情室空状态可提取为独立组件 `EmptyWarRoom.vue`，避免主文件过长
- 步骤卡片使用 CSS flexbox 横向排列，移动端纵向堆叠
- 按钮使用 `@keyframes` 实现箭头微动效果

---

### DS-06: 引入图标库替换 Emoji [P0]

**设计师原话**: "Emoji 在不同操作系统上渲染效果差异巨大，在微信浏览器中尤其不稳定。这严重影响了产品的专业感。"

**当前行为**: 全站使用 Emoji 作为功能性图标（侧边栏导航、工具栏按钮、通知铃铛等）

**验收标准**:
1. 引入图标库（推荐 Lucide Icons，MIT 协议，按需引入）
2. 替换以下关键位置的 Emoji 为 SVG 图标：
   - 侧边栏导航 4 项（🏠✅📋⚙️ → 对应 SVG）
   - 顶部工具栏按钮（🔗✨💡📥📖📅📦⬇🔍📋）
   - 通知铃铛（🔔⚙️）
   - 客户端浮动按钮（🎨）
3. 情感化场景（空状态、成功提示）的 Emoji 可以保留
4. 图标统一使用 `currentColor`，支持主题色自动适配

**涉及文件**:
- 安装依赖: `npm install lucide-vue-next`
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue) — 导航图标
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 工具栏图标
- [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue) — 铃铛图标
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — 浮动按钮图标
- [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue) — 导出/搜索图标
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue) — 巡检图标
- [ConsistencyCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ConsistencyCheckView.vue) — 巡检图标
- [TimelineView.vue](file:///workspace/epicshot-frontend/src/views/project/TimelineView.vue) — 时间轴图标
- [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue) — 生成图标

**实现要点**:
```typescript
// main.ts 或 按需引入
import { Home, CheckSquare, LayoutGrid, Settings, Bell, Link, Sparkles, Lightbulb, Download, BookOpen, Calendar, Package, Search, MoreHorizontal, Pen, Square, Circle, ArrowRight, Type, Undo, Redo } from 'lucide-vue-next'
// 注册为全局组件或局部导入
```

**Emoji → Lucide 映射参考**:
| Emoji | 用途 | Lucide Icon |
|-------|------|-------------|
| 🏠 | 战情室 | `LayoutDashboard` |
| ✅ | 我的待办 | `CheckSquare` |
| 📋 | 项目看板 | `LayoutGrid` |
| ⚙️ | 工作空间 | `Settings` |
| 🔔 | 通知 | `Bell` |
| 🔗 | 分享 | `Link` |
| ✨ | 色差巡检 | `Sparkles` |
| 💡 | 光影巡检 | `Lightbulb` |
| 📥 | 导出意见 | `Download` |
| 📖 | 作品集 | `BookOpen` |
| 📅 | 时间轴 | `Clock` |
| 📦 | 交付包 | `Package` |
| 🔍 | 抽查/搜索 | `Search` |
| ⬇ | 下载 | `ArrowDown` |

---

### DS-07: 色差巡检色盲友好 [P0]

**设计师原话**: "色差偏差用红绿色标识，对红绿色盲用户几乎无法区分。约 8% 的男性用户受此影响。"

**当前行为**:
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue#L100-L105) 偏差类型仅用颜色区分

**验收标准**:
1. 每种偏差类型增加图标区分：
   - 偏暖（warm）= 🔥（或火焰图标）
   - 偏冷（cool）= ❄️（或雪花图标）
   - 偏暗（dark）= 🌑（或月亮图标）
   - 偏亮（bright）= ☀️（或太阳图标）
2. 偏差值方向用 ↑↓ 箭头 + 数字双重编码（已有此设计，确认保留）
3. 增加「色盲友好模式」开关：开启后使用高对比度 + 图案填充替代颜色区分

**涉及文件**:
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue) — 偏差徽章模板 + 模式开关

**实现要点**:
```html
<!-- 偏差徽章增加图标 -->
<span class="deviation-badge" :class="'deviation--' + item.deviationType">
  <span class="deviation-icon">{{ deviationIcon(item.deviationType) }}</span>
  {{ deviationLabel(item.deviationType) }}
</span>
```

---

### DS-08: 侧边栏宽度调整 [P1]

**验收标准**:
1. `$sidebar-width` 从 260px 调整为 220px
2. 折叠态保持 64px 不变
3. 导航项间距微调以适应当前宽度

**涉及文件**:
- [variables.scss](file:///workspace/epicshot-frontend/src/assets/styles/variables.scss#L23)
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue) — 样式可能需微调

---

### DS-09: 字体层级变量系统 [P1]

**验收标准**:
1. 在 `variables.scss` 中增加字体大小变量：
   ```scss
   $font-xs: 11px;
   $font-sm: 12px;
   $font-base: 14px;
   $font-md: 16px;
   $font-lg: 20px;
   $font-xl: 24px;
   $font-2xl: 32px;
   ```
2. 全项目替换硬编码字体大小为变量引用

**涉及文件**:
- [variables.scss](file:///workspace/epicshot-frontend/src/assets/styles/variables.scss) — 新增变量
- 所有 `.vue` 文件的 `<style>` 块 — 替换硬编码

---

### DS-10: 主站页面移动端适配 [P1]

**验收标准**:
1. 移动端（< 768px）侧边栏改为底部 Tab Bar（4 个图标 + 文字标签）
2. 项目详情页移动端：图片查看器全屏 + 底部 Sheet 面板 + 浮动标注按钮
3. 战情室移动端：统计卡片横向滚动 + 项目列表堆叠
4. 项目看板移动端：筛选栏折叠 + 项目卡片全宽

**涉及文件**:
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue) — 响应式侧边栏
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 响应式布局
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue) — 响应式
- [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue) — 响应式

---

### DS-11: 通知铃铛增加分类筛选 [P1]

**验收标准**:
1. 下拉列表顶部增加分类 Tab：全部 / 修改请求 / 系统通知 / 催稿提醒
2. 未读通知使用蓝色左边框标记（替代仅靠小圆点）
3. 快捷操作按钮颜色明确：同意驳回 = 绿色，拒绝 = 灰色
4. 增加「仅显示未读」开关

**涉及文件**:
- [NotificationBell.vue](file:///workspace/epicshot-frontend/src/components/common/NotificationBell.vue) — 模板 + 逻辑

---

### DS-12: 品牌色硬编码统一 [P1]

**验收标准**:
1. 全项目检索所有硬编码颜色值，替换为 SCSS 变量
2. 重点关注：`#0066FF` → `$color-primary` 或 `$annotation-blue`
3. 重点关注：`#00c864` → `$color-success`
4. 在 `variables.scss` 中增加语义化别名：
   ```scss
   $color-brand: $color-primary;
   $color-annotation: $color-primary;
   $color-danger: $color-error;
   $color-confirmed: $color-success;
   ```

**涉及文件**: 全项目检索

---

### DS-13: 客户端品牌色限制应用范围 [P1]

**验收标准**:
1. 品牌色仅应用于：品牌栏、Logo、进度条，不应用于操作按钮
2. 对自定义品牌色自动校验：如果亮度太低或与功能色冲突，自动调整
3. 提供 3-5 个预设品牌色方案供客户选择

**涉及文件**:
- [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue) — 品牌色应用限制
- [WorkspaceView.vue](file:///workspace/epicshot-frontend/src/views/workspace/WorkspaceView.vue) — 品牌设置增加预设方案

---

### DS-14: 骨架屏推广到主站 [P1]

**验收标准**:
1. 项目列表/卡片类页面加载时使用骨架屏替代 "加载中..." 文字
2. 战情室加载：统计卡片骨架 + 项目列表骨架
3. 项目看板加载：项目卡片骨架（3x2 网格）
4. 我的待办加载：任务卡片骨架
5. 参考现有客户端骨架屏实现（`ClientProjectView.vue` 中 PERF-01 已实现）

**涉及文件**:
- [WarRoomView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/WarRoomView.vue)
- [DashboardView.vue](file:///workspace/epicshot-frontend/src/views/project/DashboardView.vue)
- [MyTasksView.vue](file:///workspace/epicshot-frontend/src/views/dashboard/MyTasksView.vue)

---

### DS-15: 移动端触摸热区优化 [P1]

**验收标准**:
1. 所有可点击元素最小热区设为 44x44px（通过 padding 扩展）
2. 重点检查：标注工具栏颜色选择器、通知铃铛齿轮按钮、卡片操作按钮
3. 颜色选择器视觉大小 20px → 热区 28px（目标 44px，通过 padding 补齐）

**涉及文件**: 全项目按钮/可点击元素

---

### DS-16: 面包屑导航 [P2]

**验收标准**:
1. 项目详情页顶部增加面包屑：`项目看板 > 项目名称`
2. 子页面（时间轴、色差巡检、光影巡检、作品集）面包屑：`项目看板 > 项目名称 > 当前页面`
3. 每个层级可点击跳转

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue)
- [TimelineView.vue](file:///workspace/epicshot-frontend/src/views/project/TimelineView.vue)
- [ColorCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ColorCheckView.vue)
- [ConsistencyCheckView.vue](file:///workspace/epicshot-frontend/src/views/project/ConsistencyCheckView.vue)
- [PortfolioEditorView.vue](file:///workspace/epicshot-frontend/src/views/portfolio/PortfolioEditorView.vue)

---

### DS-17: 意见卡片拖拽手柄 [P2]

**验收标准**:
1. 每张意见卡片左上角增加 ⋮⋮ 拖拽手柄图标
2. hover 时显示 `grab` 光标
3. 拖拽时显示 `grabbing` 光标

**涉及文件**:
- [ProjectDetailView.vue](file:///workspace/epicshot-frontend/src/views/project/ProjectDetailView.vue) — 卡片模板

---

### DS-18: Toast 文案情感化 [P2]

**验收标准**:
1. 确稿成功：`确稿成功！工作室已收到确认 🎉`
2. 待办清空：`太棒了，今天的任务全部完成！`
3. 导出完成：`报告已生成，请查收`
4. 项目创建：`项目创建成功，开始上传图片吧`

**涉及文件**:
- 全局检索 `toast.success(` 和 `toast.error(` 调用

---

### DS-19: 文本对比度提升 [P2]

**验收标准**:
1. `$color-text-muted` 从 `#9aa0a6` 调整为 `#80868b`（对比度 ≥ 4.5:1）
2. 侧边栏导航文字从 `#bdc1c6` 调整为 `#e8eaed`（对比度 ≥ 4.5:1）
3. 使用 Chrome DevTools Accessibility 面板验证所有文本元素

**涉及文件**:
- [variables.scss](file:///workspace/epicshot-frontend/src/assets/styles/variables.scss#L15)
- [AppLayout.vue](file:///workspace/epicshot-frontend/src/components/layout/AppLayout.vue#L219)

---

## 设计理想态参考

设计师在评审中给出了项目详情页的理想视觉方案，作为长期参考：

```
┌──────────────────────────────────────────────────────┐
│ ← 返回 │ 项目名称 · 进行中 │ [分享] [下载] [···] │  ← 精简顶部栏
├──────────────────────────────┬───────────────────────┤
│                              │  [产品单元标签]        │
│   ┌──────────────────┐      │  ┌───────────────────┐│
│   │                  │      │  │ #1 意见卡片       ││
│   │   图片查看器      │      │  │ 缩略图 + 文字     ││
│   │   (Canvas标注)   │      │  │ [确认] [继续修改] ││
│   │                  │      │  └───────────────────┘│
│   │  [画笔][矩形][文字]│←浮动│  ┌───────────────────┐│
│   │  [🔴🟡🔵⚪] [2 4 6]│ 工具栏│  │ #2 意见卡片       ││
│   │                  │      │  │ ...               ││
│   └──────────────────┘      │  └───────────────────┘│
│   ◄ 3/12 ►  [全部确稿]      │                       │
├──────────────────────────────┴───────────────────────┤
│  ← 底部状态栏：共 5 张图片 · 3 条待处理意见          │
└──────────────────────────────────────────────────────┘
```

核心改动方向：
1. 标注工具栏从独立竖栏 → 浮动在图片查看器左侧
2. 顶部工具栏精简为 3 个核心操作 + "更多"下拉
3. 意见卡片面板从 360px → 320px
4. 整体背景从纯白 → 微灰 `#fafbfc`

---

*产品经理: 已评审，请按 V1.3 范围（P0 7项）优先执行，V1.4（P1/P2 12项）排入后续迭代*