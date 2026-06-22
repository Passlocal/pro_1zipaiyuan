# 客户体验反馈 — 开发交付文档

**来源**: 品牌方市场专员首次使用客户审片端  
**时间**: 2026-06-17  
**处理人**: 产品经理  
**目标版本**: V1.2.1

---

## 反馈分类总览

| 编号 | 类型 | 优先级 | 摘要 | 迭代 |
|------|------|--------|------|------|
| UX-01 | 体验缺陷 | **P0** | 意见卡片面板在手机上不可见，用户不知道在哪看已提交的意见 | V1.2.1 |
| UX-02 | 体验缺陷 | **P1** | 缺少标注工具栏，AI 风格样片入口不明显 | V1.2.1 |
| UX-03 | 体验缺陷 | **P1** | 图片缩放/拖拽手势与原生不一致 | V1.2.1 |
| UX-04 | 体验优化 | **P2** | 确稿后缺少只读预览 | V1.3 |
| FEAT-01 | 新需求 | **P2** | 意见卡片在图片上显示对应编号标记点 | V1.3 |
| FEAT-02 | 新需求 | **P3** | 语音输入意见 | V1.3 |
| FEAT-03 | 新需求 | **P3** | 图片"已查看"标记 | V1.3 |
| PERF-01 | 性能 | **P1** | 移动端首次加载慢 | V1.2.1 |

---

## 详细条目

### UX-01: 意见卡片面板在手机上不可见

**用户原话**: "提完之后我下意识往下滑，它在底部面板里，但如果图片占了整个屏幕，我得专门往下拖才能看到。"

**当前行为**: 
- 页面布局为 `viewer-area (flex:1)` + `bottom-panel (height:240px)`
- 在桌面端，底部面板固定 240px 可见
- 在手机端（视口 < 768px），图片区撑满后，面板被挤出视口，用户需滚动才能发现

**根因**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L680-L685) 中 `.main-area` 使用 `flex-direction: column`，`viewer-area` 为 `flex:1`，面板在底部。在手机竖屏（高度约 800px），减去品牌栏(32px)+标题栏(56px)+面板(240px)，图片区仅剩约 470px，面板仍可见。但如果有图片时图片区撑满，面板无折叠提示。

**建议方案**: 
1. 在底部面板添加可拖拽的折叠/展开手柄，默认半展开状态（约 80px 露出卡片预览）
2. 当有新卡片提交时，面板自动弹起至全展开状态
3. 在图片区底部添加一个浮动的"意见反馈 (N)"胶囊按钮，点击展开面板

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L757-L764)

---

### UX-02: 缺少标注工具栏，AI 风格样片入口不明显

**用户原话**: "AI 风格样片那个按钮，我第一次是从图片上找到的，但如果图片上没有明显的标注工具条，我可能会漏掉这个功能。"

**当前行为**: 客户端页面没有标注工具栏——当前客户端没有标注功能，标注功能仅在摄影师端（ProjectDetailView）可用。客户端的意见反馈通过底部面板的文字回复完成。

**分析**: 当前客户端审片流程中，客户只能通过文字回复意见卡片，不能直接在图片上标注。品牌方市场专员的反馈是期望看到标注功能，这实际上暗示了一个需求缺失：**客户端的轻量标注能力**。

**建议方案**: 
1. **V1.2.1**: 在客户端的图片查看器上添加一个浮动工具栏，至少包含"AI 风格样片"按钮（已有此功能但入口不明显）
2. **V1.3**: 评估是否给客户开放轻量标注（画笔+文字），与摄影师端标注区分

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L32-L49)（图片查看器区域）

---

### UX-03: 图片缩放/拖拽手势

**用户原话**: "图片放大缩小的手势有时候跟手机自带的图片浏览不太一样，第一次用有点不跟手。"

**当前行为**: 当前图片使用 `<img>` 标签 + `object-fit: contain`，没有缩放/拖拽功能。用户的缩放是通过浏览器默认行为实现的。

**建议方案**: 
1. 引入轻量图片手势库（如 `pinch-zoom` 或自定义 touch 事件），实现双指缩放 + 单指拖拽
2. 确保与微信内置浏览器的触摸事件兼容

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L33-L38)

---

### UX-04: 确稿后缺少只读预览

**用户原话**: "确稿之后，我想再回头看一眼修改前后的对比，发现项目已经锁定了。"

**当前行为**: 确稿后弹出成功弹窗，引导用户"申请修改"或"前往下载"。项目锁定后无法再查看对比视图。

**建议方案**: 确稿成功后，将项目改为只读模式而非完全锁定。用户可浏览图片和意见卡片，但不可修改。需要修改时再申请。

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L238-L249)

---

### FEAT-01: 意见卡片在图片上显示编号标记点

**用户原话**: "意见卡片如果能直接在图片上对应位置显示一个小标记点（比如编号气泡），点击卡片就能跳到对应的图片位置。"

**当前行为**: 图片和意见卡片完全分离——图片在 viewer 区，卡片在底部面板。卡片有缩略图但无图片位置映射。

**建议方案**: 
1. 后端增加字段：`comment_cards` 表添加 `position_x, position_y, image_id` 字段存储标注坐标
2. 前端在图片上根据坐标渲染编号气泡（#1, #2...）
3. 点击气泡跳转到对应卡片，反之亦然

**涉及文件**: 
- 后端: [server.js](file:///workspace/epicshot-backend/server.js) `comment_cards` 表 + CRUD 端点
- 前端: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L32-L49)

---

### FEAT-02: 语音输入意见

**用户原话**: "能直接对着手机说'这个褶皱修掉'然后自动转成文字。"

**建议方案**: 使用浏览器 Web Speech API (`SpeechRecognition`)，在意见输入框旁添加麦克风按钮。注意微信内置浏览器兼容性。

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L79-L85)

---

### FEAT-03: 图片"已查看"标记

**用户原话**: "如果能标记'这张已看'会更有条理。"

**建议方案**: 在图片导航区添加一个"标记已查看"按钮，状态存储在 `sessionStorage`，支持一键全部标记。

**涉及文件**: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L39-L43)

---

### PERF-01: 移动端首次加载慢

**用户原话**: "在微信里点开链接，页面加载稍微有点慢。"

**当前行为**: 客户端页面加载时同时请求 `/v1/share/:token`（项目数据+图片+评论）和 `/v1/share/:token/brand`（品牌数据），两个请求串行。

**建议方案**: 
1. 将品牌数据合并到 `/v1/share/:token` 响应中，减少一次请求
2. 图片缩略图增加 WebP 格式支持（Sharp 已集成）
3. 评估是否需要骨架屏（Skeleton Screen）替代当前的"加载中..."文字

**涉及文件**: 
- 后端: [server.js](file:///workspace/epicshot-backend/server.js) `GET /v1/share/:token`
- 前端: [ClientProjectView.vue](file:///workspace/epicshot-frontend/src/views/client/ClientProjectView.vue#L120-L122)

---

## 迭代规划

### V1.2.1（本次迭代）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| UX-01 | 底部面板折叠/展开 + 浮动意见按钮 | 4h |
| UX-02 | 图片区浮动工具栏（AI 风格样片入口） | 2h |
| UX-03 | 图片手势（双指缩放+拖拽） | 3h |
| PERF-01 | 合并请求 + 加载体验优化 | 2h |

### V1.3（后续版本）

| 编号 | 条目 | 预估工时 |
|------|------|----------|
| UX-04 | 确稿后只读预览 | 3h |
| FEAT-01 | 图片上意见编号标记点 | 6h |
| FEAT-02 | 语音输入 | 4h |
| FEAT-03 | 已查看标记 | 2h |

---

*产品经理: 已评审，请按 V1.2.1 范围执行*