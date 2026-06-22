# UI 设计评审 V1.5 + V1.6 — 开发交付文档

**来源**: 资深UI/UX设计师第三轮全量设计评审  
**评审日期**: 2026-06-17  
**目标版本**: V1.5 + V1.6（合并迭代）

---

## 问题总览

| 编号 | 类型 | 优先级 | 摘要 | 涉及文件 | 预估 |
|------|------|--------|------|----------|------|
| VIS-05 | 视觉 | **P0** | 标注工具栏 Emoji → Lucide 迁移 | ProjectDetailView.vue | 2h |
| A11Y-05 | 无障碍 | **P0** | 同上（无障碍维度） | ProjectDetailView.vue | (含上) |
| VIS-07 | 视觉 | **P0** | 项目详情页加载→骨架屏 | ProjectDetailView.vue | 1h |
| A11Y-06 | 无障碍 | **P0** | 图片查看器键盘快捷键 | ProjectDetailView.vue | 2h |
| VIS-06 | 视觉 | **P1** | 统计卡片边框语义统一 | WarRoomView.vue | 0.5h |
| BRN-04 | 品牌 | **P1** | DashboardView Emoji → Lucide | DashboardView.vue | 1h |
| BRN-05 | 品牌 | **P1** | 通知图标 Emoji → Lucide | NotificationBell.vue | 1h |
| INT-05 | 交互 | **P1** | 客户端 ◀/▶ → Chevron | ClientProjectView.vue | 0.5h |
| EMO-06 | 情感化 | **P1** | 色差巡检空状态引导 | ColorCheckView.vue | 1h |
| A11Y-07 | 无障碍 | **P1** | 颜色选择器键盘导航 | ProjectDetailView.vue | 1h |
| NAV-04 | 导航 | **P1** | 工作空间页面引导 | WorkspaceView.vue | 1h |
| INT-02 | 交互 | **P2** | 意见卡片拖拽手柄 | ProjectDetailView.vue | 1h |
| EMO-05 | 情感化 | **P2** | Toast 文案情感化 | 全局 | 1h |
| EMO-07 | 情感化 | **P2** | 催稿完成微动效 | WarRoomView.vue | 0.5h |
| INT-06 | 交互 | **P2** | 下载 ▾ → ChevronDown | ProjectDetailView.vue | 0.5h |
| INT-07 | 交互 | **P2** | 通知快捷操作优化 | NotificationBell.vue | 1h |
| NAV-05 | 导航 | **P2** | 更多下拉分组 | ProjectDetailView.vue | 0.5h |
| VIS-08 | 视觉 | **P2** | 时间轴加载→骨架屏 | TimelineView.vue | 0.5h |
| BRN-06 | 品牌 | **P2** | 健康度弹窗 Emoji | WarRoomView.vue | 0.5h |
| BRN-07 | 品牌 | **P2** | Logo 图形化 | AppLayout.vue | 1h |
| A11Y-08 | 无障碍 | **P2** | 全局焦点指示器 | global.scss | 0.5h |

**合计**: 21 项，约 18h

---

## 详细条目

### VIS-05 / A11Y-05: 标注工具栏 Emoji → Lucide [P0]

**当前行为**: 标注工具使用 Emoji（🖉 ✏ □ ○ → T 🧹），与全站 Lucide 图标不一致，且 Emoji 在不同 OS 渲染效果不同，屏幕阅读器不可控。

**验收标准**:
1. 所有标注工具 Emoji 替换为 Lucide 图标
2. 映射关系：🖉→MousePointer2, ✏→Pen, □→Square, ○→Circle, →→ArrowRight, T→Type, 🧹→Eraser
3. 工具栏宽度从 48px → 56px
4. 工具标签字号从 10px → 11px

### VIS-07: 项目详情页骨架屏 [P0]

**当前行为**: 加载状态为「加载中...」文字。

**验收标准**:
1. 左侧图片查看器：骨架矩形占位
2. 中间标注工具栏：按钮列骨架
3. 右侧面板：3 条卡片骨架

### A11Y-06: 图片查看器键盘快捷键 [P0]

**当前行为**: 无键盘快捷键。

**验收标准**:
| 快捷键 | 操作 |
|--------|------|
| ← | 上一张图片 |
| → | 下一张图片 |
| Delete/Backspace | 删除选中标注 |
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z | 重做 |
| 1-7 | 切换标注工具 |
| Escape | 取消当前操作 |

### VIS-06: 统计卡片边框统一 [P1]

**当前行为**: `--active` 使用 `border-left`，`--red`/`--yellow` 使用 `border-top`。

**验收标准**: 统一使用 `border-top: 3px solid`。

### BRN-04: DashboardView Emoji → Lucide [P1]

**验收标准**: 📤→Upload, 📄→FileText, 📊→BarChart3, 🔍→Search

### BRN-05: 通知图标 Emoji → Lucide [P1]

**验收标准**: typeIcon 函数返回 Lucide 组件而非 Emoji 字符串。

### INT-05: 客户端 ◀/▶ → Chevron [P1]

**验收标准**: 导航按钮替换为 `<ChevronLeft :size="24" />` / `<ChevronRight :size="24" />`

### EMO-06: 色差巡检空状态 [P1]

**验收标准**: 增加折叠式说明区「巡检能发现什么？」，列出 4 种检测类型。

### A11Y-07: 颜色选择器键盘导航 [P1]

**验收标准**: 颜色按钮添加 `tabindex="0"`, `role="radio"`, `aria-checked`, `aria-label`

### NAV-04: 工作空间引导 [P1]

**验收标准**: 展示引导性空状态 + 蓝图预览。

### INT-02: 意见卡片拖拽手柄 [P2]

**验收标准**: 卡片头部添加 `⋮⋮` GripVertical 图标。

### EMO-05: Toast 情感化 [P2]

**验收标准**: 建立 Toast 文案风格指南，5 类操作各对应一条人格化表达。

### EMO-07: 催稿微动效 [P2]

**验收标准**: 催稿成功后文案变绿 + 弹性动画。

### INT-06: 下载 ▾ → ChevronDown [P2]

### INT-07: 通知快捷操作优化 [P2]

### NAV-05: 更多下拉分组 [P2]

### VIS-08: 时间轴骨架屏 [P2]

### BRN-06: 健康度弹窗 Emoji [P2]

### BRN-07: Logo 图形化 [P2]

### A11Y-08: 全局焦点指示器 [P2]

---

*产品经理: 已评审，V1.5 + V1.6 合并执行，21 项全部纳入本次迭代*