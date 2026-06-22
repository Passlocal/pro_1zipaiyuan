<template>
  <div class="project-detail">
    <!-- 顶部工具栏 -->
    <div class="detail-topbar">
      <div class="topbar-left">
        <!-- NAV-02: 面包屑导航 -->
        <nav class="breadcrumb-nav">
          <router-link to="/projects" class="breadcrumb-link">项目看板</router-link>
          <ChevronRight :size="12" class="breadcrumb-sep" />
          <span class="breadcrumb-current">{{ projectStore.currentProject?.name || projectStore.currentProject?.clientName || '项目详情' }}</span>
        </nav>
        <span
          v-if="projectStore.currentProject"
          class="status-badge"
          :class="'status--' + projectStore.currentProject.status"
        >
          {{ statusLabel(projectStore.currentProject.status) }}
        </span>
        <span class="profit-badge" :class="projectProfit >= 0 ? 'profit-positive' : 'profit-negative'">
          预期利润：¥{{ projectProfit >= 0 ? '+' : '' }}{{ projectProfit.toFixed(2) }}
        </span>
      </div>
      <div class="topbar-right">
        <!-- DS-03: 核心操作 (Tier 1 - 始终可见) -->
        <button class="btn-toolbar btn-toolbar--primary" title="分享" @click="handleShare">
          <Link :size="14" /> 分享
        </button>
        <!-- DS-03: 下载 Split Button -->
        <div class="download-split-wrap" ref="downloadDropdownRef">
          <button class="btn-toolbar btn-toolbar--download" title="下载原图" @click="downloadWithFormat('original')">
            <Download :size="14" /> 下载
          </button>
          <button class="btn-toolbar btn-toolbar--download-caret" @click="showDownloadDropdown = !showDownloadDropdown" aria-label="下载选项">
            <ChevronDown :size="12" />
          </button>
          <div v-if="showDownloadDropdown" class="download-dropdown" @click.stop>
            <button class="download-option" @click="downloadWithFormat('original')">原尺寸下载</button>
            <button class="download-option" @click="downloadWithFormat('web')">Web 优化 (2000px JPG)</button>
            <button class="download-option" @click="openCustomDownloadDialog">自定义尺寸</button>
          </div>
        </div>

        <!-- DS-03: 工具菜单 (Tier 2 - 工具下拉) -->
        <div class="tools-menu-wrap">
          <button class="btn-toolbar" title="工具" @click="showToolsMenu = !showToolsMenu">
            <Wrench :size="14" /> 工具
          </button>
          <div v-if="showToolsMenu" class="tools-dropdown" @click.stop>
            <button class="tools-item" @click="router.push(`/project/${projectId}/timeline`); showToolsMenu = false">
              <Clock :size="14" /> 时间轴
            </button>
            <button class="tools-item" @click="openOperationLogs; showToolsMenu = false">
              <ListChecks :size="14" /> 操作日志
            </button>
            <button
              class="tools-item"
              :disabled="downloadingDelivery"
              @click="downloadDeliveryPackage; showToolsMenu = false"
            >
              <Package :size="14" /> {{ downloadingDelivery ? '打包中...' : '交付包' }}
            </button>
            <button class="tools-item" @click="openCommentsSummary; showToolsMenu = false">
              <MessageSquare :size="14" /> 意见汇总
            </button>
          </div>
        </div>

        <!-- DS-03: 更多菜单 (Tier 3 - 更多操作) -->
        <div class="more-menu-wrap">
          <button class="btn-toolbar" title="更多操作" @click="showMoreMenu = !showMoreMenu">
            <MoreHorizontal :size="14" /> 更多
          </button>
          <div v-if="showMoreMenu" class="more-dropdown" @click.stop>
            <div class="more-group">
              <span class="more-group-label">巡检</span>
              <button class="more-item" @click="openReviewModal"><Search :size="14" /> 抽查</button>
              <button class="more-item" @click="openInspectionReport('color-check')"><Sparkles :size="14" /> 色差巡检</button>
              <button class="more-item" @click="openInspectionReport('consistency-check')"><Lightbulb :size="14" /> 光影巡检</button>
              <!-- FB-014: 简化巡检报告切换 -->
              <div class="more-toggle-row">
                <span class="more-toggle-label">巡检报告版本</span>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="simplifiedReport" />
                  <span class="toggle-slider"></span>
                  <span class="toggle-text toggle-text--left">{{ simplifiedReport ? '客户版' : '专业版' }}</span>
                </label>
              </div>
            </div>
            <div class="more-divider"></div>
            <div class="more-group">
              <span class="more-group-label">导出</span>
              <button class="more-item" @click="handleExportComments"><FileText :size="14" /> 导出意见</button>
              <button class="more-item" @click="router.push(`/project/${projectId}/portfolio`)"><BookOpen :size="14" /> 作品集</button>
            </div>
            <div class="more-divider"></div>
            <div class="more-group">
              <span class="more-group-label">其他</span>
              <button class="more-item" @click="openRecentActions"><ListChecks :size="14" /> 最近操作</button>
              <button class="more-item" @click="showExpenseModal = true; showMoreMenu = false">
                <Receipt :size="14" /> 支出记录
              </button>
              <!-- UX-41: 提交确认（移至更多菜单） -->
              <button
                class="more-item"
                @click="toggleConfirmBeforeSubmit"
              >
                <CheckSquare :size="14" /> 提交确认{{ confirmBeforeSubmit ? ' ✓' : '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="detail-body">
      <!-- 加载中 -->
      <div v-if="projectLoading" class="skeleton-detail">
        <div class="skeleton-viewer"></div>
        <div class="skeleton-toolbar">
          <div v-for="i in 7" :key="'tool-' + i" class="skeleton skeleton-tool-btn"></div>
        </div>
        <div class="skeleton-panel">
          <div v-for="i in 3" :key="'card-' + i" class="skeleton skeleton-card"></div>
        </div>
      </div>
      <!-- 加载失败 -->
      <div v-else-if="projectError" class="error-state">
        <AlertTriangle :size="24" aria-label="错误" />
        <p>{{ projectError }}</p>
        <button class="btn-retry" @click="loadProject">重新加载</button>
      </div>
      <!-- 正常内容 -->
      <template v-else>
      <!-- 左侧：图片查看器 -->
      <div class="viewer-panel">
        <ImageViewer
          v-if="currentImage"
          :image-url="currentImageUrl"
          :annotations="annotationStore.annotations"
          :active-tool="annotationStore.activeTool"
          :active-color="annotationStore.activeColor"
          :active-width="activePenWidth"
          :active-font-size="annotationStore.activeFontSize"
          :current-index="currentImageIndex"
          :total-count="currentUnitImages.length"
          :card-draft-text="currentCardDraft"
          @prev="navigateImage(-1)"
          @next="navigateImage(1)"
          @annotation-created="onAnnotationCreated"
          @annotation-deleted="onAnnotationDeleted"
          @goto-page="navigateToPage"
          @draft-restore="restoreCardDraft"
          @draft-ignore="clearCardDraft"
          @focus-next-card="focusNextCard"
          @submit="handleKeyboardSubmit"
          @tool-change="handleKeyboardToolChange"
          @close-modal="handleKeyboardCloseModal"
        />
        <div v-else class="image-viewer">
          <div class="viewer-placeholder">
            <span class="viewer-icon">🖼️</span>
            <p>图片查看器</p>
            <p class="viewer-hint" v-if="currentUnitImages.length === 0">
              请先在右侧选择一个产品单元查看图片
            </p>
            <p class="viewer-hint" v-else>
              请点击右侧图片缩略图开始查看
            </p>
          </div>
        </div>
      </div>

      <!-- 标注工具栏 -->
      <div class="annotation-toolbar">
        <div class="tool-group">
          <button
            v-for="tool in tools"
            :key="tool.type"
            class="tool-btn"
            :class="{ active: annotationStore.activeTool === tool.type }"
            :title="tool.label"
            @click="annotationStore.setTool(tool.type)"
          >
            <component :is="tool.icon" :size="16" class="tool-icon-svg" />
            <span class="tool-label">{{ tool.label }}</span>
          </button>
        </div>
        <div class="divider-h"></div>
        <div class="color-group">
          <button
            v-for="c in colors"
            :key="c"
            class="color-btn"
            :class="{ active: annotationStore.activeColor === c }"
            :style="{ background: c }"
            :tabindex="0"
            role="radio"
            :aria-checked="annotationStore.activeColor === c"
            :aria-label="'颜色：' + c"
            @click="annotationStore.setColor(c)"
            @keydown.enter.prevent="annotationStore.setColor(c)"
            @keydown.space.prevent="annotationStore.setColor(c)"
          ></button>
        </div>
        <div class="divider-h"></div>
        <div class="width-group">
          <button
            v-for="w in widths"
            :key="w"
            class="width-btn"
            :class="{ active: annotationStore.activeWidth === w }"
            @click="annotationStore.setWidth(w)"
          >
            <span class="width-preview-line" :style="{ height: Math.max(1, w / 2) + 'px', background: annotationStore.activeColor }"></span>
            {{ w }}px
          </button>
        </div>
        <select
          v-if="annotationStore.activeTool === 'pen' || annotationStore.activeTool === 'arrow'"
          v-model="activePenWidth"
          class="width-select"
          title="画笔粗细"
        >
          <option :value="3">细 (3px)</option>
          <option :value="5">中 (5px)</option>
          <option :value="10">粗 (10px)</option>
        </select>
        <div class="divider-h"></div>
        <div class="tool-group">
          <button class="tool-btn" title="撤销" @click="annotationStore.undo()">
            <Undo :size="14" />
          </button>
          <button class="tool-btn" title="重做" @click="annotationStore.redo()">
            <Redo :size="14" />
          </button>
        </div>
      </div>

      <!-- 右侧面板 -->
      <aside class="comment-panel">
        <!-- 产品单元标签 -->
        <div class="unit-tabs">
          <div class="unit-tabs-scroll">
            <button
              v-for="unit in projectStore.productUnits"
              :key="unit.id"
              class="unit-tab"
              :class="{ active: activeUnitId === unit.id }"
              @click="selectUnit(unit.id)"
            >
              {{ unit.name }}
            </button>
          </div>
          <button class="btn-add-unit" title="添加产品单元" @click="showAddUnit = true">+</button>
          <button class="btn-batch-units" title="批量创建产品单元" @click="showBatchUnitModal = true">批量创建</button>
          <!-- FB-010: 创建向导 -->
          <button class="btn-wizard-units" title="产品单元创建向导" @click="openUnitWizard">创建向导</button>
          </div>
          <div v-if="showAddUnit" class="add-unit-form">
            <input
              ref="addUnitInputRef"
              v-model="newUnitName"
              type="text"
              class="form-input form-input--sm"
              placeholder="输入单元名称"
              @keydown.enter="handleAddUnit"
              @keydown.escape="cancelAddUnit"
            />
            <button class="btn-confirm" @click="handleAddUnit" :disabled="!newUnitName.trim()">确定</button>
            <button class="btn-cancel" @click="cancelAddUnit">取消</button>
          </div>

        <!-- 图片缩略图条 -->
        <div class="thumbnail-strip" v-if="currentUnitImages.length > 0">
          <button
            v-for="(img, index) in currentUnitImages"
            :key="img.id"
            class="thumbnail-item"
            :class="{ active: projectStore.currentImage?.id === img.id }"
            @click="selectImage(img)"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
            <div v-else class="thumb-placeholder"></div>
            <span class="thumbnail-badge">{{ index + 1 }}</span>
          </button>
        </div>
        <div v-else class="thumbnail-empty">
          <span>暂无图片</span>
        </div>

        <div class="divider-h"></div>

        <!-- 意见卡片列表 -->
        <div class="comment-list" v-if="annotationStore.commentCards.length > 0">
          <div
            v-for="(card, index) in annotationStore.commentCards"
            :key="card.id"
            class="comment-card"
            :class="{ focused: focusedCardId === card.id }"
            :ref="(el: any) => setCardRef(card.id, el)"
            @click="focusCard(card)"
            @contextmenu.prevent="showCardContextMenu($event, card)"
          >
            <div class="card-number">#{{ index + 1 }}</div>
            <div class="card-thumbnail">
              <img v-if="card.thumbnailUrl" :src="card.thumbnailUrl" :alt="'card ' + (index + 1)" />
              <div v-else class="card-thumb-placeholder"></div>
            </div>
            <span class="card-drag-handle" title="拖拽排序">
              <GripVertical :size="14" />
            </span>
            <div class="card-content">
              <p class="card-text">{{ card.text }}</p>
              <p v-if="card.lastEditedBy" class="card-edited-info">
                最后由{{ card.lastEditedBy }}编辑于{{ formatDate(card.lastEditedAt) }}
              </p>
              <!-- UX-10/UX-42: 争议次数显示（本月/累计拆分） -->
              <span
                v-if="card.disputeCount > 0"
                class="card-dispute-badge"
                :class="{ 'dispute-warning': getDisputeCountThisMonth(card) > 3 }"
                @click.stop="openRejectionHistory(card.id)"
                title="查看驳回历史"
              >
                本月 {{ getDisputeCountThisMonth(card) }} 次 / 累计 {{ card.disputeCount }} 次
              </span>
            </div>
            <div class="card-status-dot"
              :class="card.status === 'resolved' ? 'dot-resolved' : 'dot-unresolved'"
              :title="card.status === 'resolved' ? '标记为未解决' : '标记为已解决'"
              @click.stop="toggleCardStatus(card)"
            ></div>
            <!-- UX-41: 快速流转提交并下一张 -->
            <button
              v-if="card.status === 'unresolved'"
              class="btn-submit-next"
              @click.stop="handleSubmitAndNext(card)"
              title="提交并下一张"
            >
              提交并下一张
            </button>
            <!-- UX-19: 查看对比按钮 -->
            <button v-if="card.status === 'resolved'" class="btn-compare" @click.stop="openComparison()" title="查看修改前后对比">
              对比
            </button>
            <!-- FB-021: 版本对比按钮（争议卡片） -->
            <button v-if="card.disputeCount > 0" class="btn-version-compare" @click.stop="openVersionComparison(card.id)" title="查看版本对比">
              版本对比
            </button>
          </div>
        </div>
        <div v-else class="comment-empty">
          <span>暂无意见卡片</span>
        </div>

        <!-- 4.14: 图片级讨论区 -->
        <div v-if="currentImage" class="discussion-area">
          <div class="discussion-header">图片讨论</div>
          <div class="discussion-list" v-if="discussions.length > 0">
            <div v-for="d in discussions" :key="d.id" class="discussion-item">
              <span class="discussion-user">{{ d.userName }}</span>
              <span class="discussion-text">{{ d.text }}</span>
              <span class="discussion-time">{{ formatDate(d.createdAt) }}</span>
              <!-- FB-022: 已读状态指示 -->
              <span v-if="(d as any).readBy && (d as any).readBy.length > 0" class="discussion-read-status" :title="'已读: ' + (d as any).readBy.join(', ')">✓ 对方已读</span>
              <span v-else class="discussion-read-status discussion-unread">未读</span>
              <!-- FB-022: 提醒对方按钮 -->
              <button class="btn-nudge-discussion" @click.stop="nudgeDiscussion(d.id)" title="提醒对方">
                <Bell :size="10" />
              </button>
            </div>
          </div>
          <div v-else class="discussion-empty">暂无讨论</div>
          <div class="discussion-input-row">
            <!-- UX-15: @ 提及列表 -->
            <div class="mention-list" v-if="showMentionList && filteredMembers.length > 0">
              <div
                v-for="(member, idx) in filteredMembers"
                :key="member.id"
                class="mention-item"
                :class="{ active: idx === mentionIndex }"
                @click="insertMention(member)"
              >
                <span class="mention-name">{{ member.name }}</span>
                <span class="mention-role">{{ member.role === 'owner' ? '管理者' : '修图师' }}</span>
              </div>
            </div>
            <textarea
              v-model="discussionText"
              class="discussion-input"
              placeholder="输入讨论内容，使用 @ 提及成员..."
              rows="2"
              @input="handleDiscussionInput"
              @keydown.enter.exact.prevent="sendDiscussion"
            ></textarea>
            <button class="discussion-send-btn" @click="sendDiscussion" :disabled="!discussionText.trim()">发送</button>
          </div>
        </div>
      </aside>
      </template>
    </div>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast" :class="toastType === 'error' ? 'toast--error' : 'toast--success'">
      {{ toastMsg }}
    </div>

    <!-- 4.9: 右键上下文菜单 -->
    <div v-if="contextMenuVisible" class="context-menu" :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }" @mouseleave="contextMenuVisible = false">
      <div class="context-menu-item" @click="openSyncModal">应用到其他图片...</div>
    </div>

    <!-- 4.9: 跨图同步模态框 -->
    <Modal v-if="syncModalVisible" :visible="syncModalVisible" title="应用到其他图片" size="large" @close="syncModalVisible = false">
      <div class="sync-modal-body">
        <p class="sync-modal-hint">选择要同步意见卡片的目标图片（可多选）：</p>
        <div class="sync-image-grid">
          <div
            v-for="img in currentUnitImages"
            :key="img.id"
            class="sync-image-item"
            :class="{ selected: selectedSyncImageIds.has(img.id) }"
            @click="toggleSyncImage(img.id)"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
            <div v-else class="sync-image-placeholder"></div>
            <span v-if="selectedSyncImageIds.has(img.id)" class="sync-check-mark">✓</span>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="syncModalVisible = false">取消</button>
        <button class="btn-confirm" @click="executeSync" :disabled="selectedSyncImageIds.size === 0">同步</button>
      </template>
    </Modal>

    <!-- 4.10: 抽查模态框 -->
    <Modal v-if="reviewModalVisible" :visible="reviewModalVisible" title="抽查已解决卡片" size="medium" @close="reviewModalVisible = false">
      <div class="review-modal-body">
        <div class="review-progress" v-if="reviewCards.length > 0">
          进度：{{ reviewCurrentIndex + 1 }} / {{ reviewCards.length }}
        </div>
        <div v-if="reviewCards.length > 0 && reviewCards[reviewCurrentIndex]" class="review-card-detail">
          <img v-if="reviewCards[reviewCurrentIndex].thumbnailUrl" :src="reviewCards[reviewCurrentIndex].thumbnailUrl" class="review-card-img" />
          <p class="review-card-text">{{ reviewCards[reviewCurrentIndex].text }}</p>
        </div>
        <div v-else class="review-empty">暂无待抽查的卡片</div>
      </div>
      <template #footer>
        <button class="btn-reject" @click="reviewAction('reject')" :disabled="reviewCards.length === 0">驳回</button>
        <button class="btn-approve" @click="reviewAction('approve')" :disabled="reviewCards.length === 0">通过</button>
      </template>
    </Modal>

    <!-- 4.11: 最近操作模态框 -->
    <Modal v-if="recentActionsVisible" :visible="recentActionsVisible" title="最近操作" size="medium" @close="recentActionsVisible = false">
      <div class="recent-actions-body">
        <div v-if="recentActions.length === 0" class="recent-empty">暂无最近操作</div>
        <div v-for="action in recentActions" :key="action.id" class="recent-action-item">
          <div class="recent-action-info">
            <span class="recent-action-desc">{{ action.description }}</span>
            <span class="recent-action-time">{{ formatDate(action.createdAt) }}</span>
          </div>
          <button v-if="action.undoable" class="btn-undo" @click="undoAction(action.id)">撤回</button>
        </div>
      </div>
    </Modal>

    <!-- F-53: 自定义尺寸下载弹窗 -->
    <Modal v-if="customDownloadVisible" :visible="customDownloadVisible" title="自定义下载尺寸" size="medium" @close="customDownloadVisible = false">
      <div class="custom-download-body">
        <div class="slider-group">
          <label class="slider-label">宽度：{{ customWidth }}px</label>
          <input
            type="range"
            v-model.number="customWidth"
            min="800"
            max="5000"
            step="100"
            class="slider-input"
          />
          <div class="slider-range">
            <span>800</span>
            <span>5000</span>
          </div>
        </div>
        <div class="slider-group">
          <label class="slider-label">质量：{{ customQuality }}%</label>
          <input
            type="range"
            v-model.number="customQuality"
            min="60"
            max="100"
            step="5"
            class="slider-input"
          />
          <div class="slider-range">
            <span>60</span>
            <span>100</span>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="customDownloadVisible = false">取消</button>
        <button class="btn-confirm" @click="downloadWithFormat('custom')">下载</button>
      </template>
    </Modal>

    <!-- F-53: 异步打包进度弹窗 -->
    <Modal v-if="deliveryTaskVisible" :visible="deliveryTaskVisible" title="打包中" size="small" @close="cancelDeliveryTask">
      <div class="delivery-task-body">
        <p class="delivery-task-text">正在生成交付包，请稍候...</p>
        <div class="delivery-task-progress-bar">
          <div class="delivery-task-progress-fill" :style="{ width: deliveryTaskProgress + '%' }"></div>
        </div>
        <p class="delivery-task-percent">{{ deliveryTaskProgress }}%</p>
      </div>
    </Modal>

    <!-- UX-10: 争议历史弹窗 -->
    <div v-if="showRejectionHistory" class="rejection-history-overlay" @click.self="showRejectionHistory = false">
      <div class="rejection-history-panel">
        <div class="rejection-history-header">
          <h3>驳回历史</h3>
          <button class="btn-close" @click="showRejectionHistory = false" aria-label="关闭">✕</button>
        </div>
        <div class="rejection-history-list">
          <div v-if="rejectionHistoryLoading" class="rejection-loading">加载中...</div>
          <div v-else-if="rejectionHistory.length === 0" class="rejection-empty">暂无驳回记录</div>
          <div
            v-for="item in rejectionHistory"
            :key="item.id"
            class="rejection-history-item"
          >
            <div class="rejection-meta">
              <span class="rejection-time">{{ formatDate(item.time) }}</span>
              <span class="rejection-by">由 {{ item.userName }}</span>
            </div>
            <p class="rejection-reason">{{ item.detail }}</p>
          </div>
        </div>
        <div class="rejection-history-footer">
          <button class="btn-jump" @click="jumpToRejectionImage">
            跳转到对应图片
          </button>
        </div>
      </div>
    </div>

    <!-- DATA-04: 操作日志抽屉 -->
    <div v-if="showOperationLogs" class="operation-logs-overlay" @click.self="showOperationLogs = false">
      <div class="operation-logs-panel">
        <div class="operation-logs-header">
          <h3>操作日志</h3>
          <button class="btn-close" @click="showOperationLogs = false" aria-label="关闭">✕</button>
        </div>
        <div class="operation-logs-filters">
          <button
            v-for="f in logFilters"
            :key="f.value"
            class="log-filter-btn"
            :class="{ active: logFilter === f.value }"
            @click="logFilter = f.value"
          >{{ f.label }}</button>
        </div>
        <div class="operation-logs-list">
          <div v-if="operationLogsLoading" class="logs-loading">加载中...</div>
          <div v-else-if="filteredLogs.length === 0" class="logs-empty">暂无操作记录</div>
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-item"
            :class="'log--' + log.action"
          >
            <div class="log-icon">
              <CheckCircle2 v-if="log.action === 'resolve_card'" :size="14" />
              <AlertTriangle v-else-if="log.action === 'dispute_card'" :size="14" />
              <Edit3 v-else-if="log.action === 'create_card'" :size="14" />
              <Flag v-else-if="log.action === 'complete_project'" :size="14" />
              <Clock v-else :size="14" />
            </div>
            <div class="log-info">
              <div class="log-action">{{ actionLabel(log.action) }}</div>
              <div class="log-user">{{ log.user_name }}</div>
            </div>
            <div class="log-detail" v-if="log.detail">{{ log.detail }}</div>
            <div class="log-time">{{ formatDate(log.created_at) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- UX-19: 修改前后对比弹窗 -->
    <div v-if="showComparison" class="comparison-overlay" @click.self="showComparison = false">
      <div class="comparison-modal">
        <div class="comparison-header">
          <h3>修改前后对比</h3>
          <button @click="showComparison = false" aria-label="关闭">✕</button>
        </div>
        <div class="comparison-body">
          <div class="comparison-side">
            <span class="comparison-label">原图</span>
            <img v-if="compareOriginalUrl" :src="compareOriginalUrl" alt="原图" />
            <span v-else class="comparison-unavailable">原图暂不可用</span>
          </div>
          <div class="comparison-divider"></div>
          <div class="comparison-side">
            <span class="comparison-label">成片</span>
            <img v-if="compareProcessedUrl" :src="compareProcessedUrl" alt="成片" />
            <span v-else class="comparison-unavailable">成片暂不可用</span>
          </div>
        </div>
      </div>
    </div>

    <!-- UX-35: 交付清单弹窗 -->

    <!-- FB-021: 版本对比弹窗 -->
    <div v-if="showVersionComparison" class="comparison-overlay" @click.self="showVersionComparison = false">
      <div class="comparison-modal version-comparison-modal">
        <div class="comparison-header">
          <h3>版本对比</h3>
          <button class="btn-close" @click="showVersionComparison = false" aria-label="关闭">✕</button>
        </div>
        <div class="comparison-body">
          <div class="comparison-side">
            <span class="comparison-label">原始版本</span>
            <img v-if="versionOriginalUrl" :src="versionOriginalUrl" alt="原始版本" />
            <span v-else class="comparison-unavailable">原始版本暂不可用</span>
          </div>
          <div class="comparison-divider"></div>
          <div class="comparison-side">
            <span class="comparison-label">修订版本</span>
            <img v-if="versionRevisedUrl" :src="versionRevisedUrl" alt="修订版本" />
            <span v-else class="comparison-unavailable">修订版本暂不可用</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deliveryChecklistVisible" class="comparison-overlay" @click.self="deliveryChecklistVisible = false">
      <div class="comparison-modal delivery-checklist-modal">
        <div class="comparison-header">
          <h3>交付清单</h3>
          <button @click="deliveryChecklistVisible = false" aria-label="关闭">✕</button>
        </div>
        <!-- V1.19: 交付包内容选项 -->
        <div class="delivery-options">
          <label class="delivery-option" v-for="opt in deliveryOptions" :key="opt.key">
            <input type="checkbox" v-model="opt.checked" />
            <span>{{ opt.label }}</span>
            <span class="delivery-option-desc">{{ opt.desc }}</span>
          </label>
          <div class="delivery-option-footer">
            <label class="delivery-option-save">
              <input type="checkbox" v-model="saveDeliveryDefaults" />
              <span>保存为默认配置</span>
            </label>
            <span class="delivery-estimate">预计 {{ deliveryEstimateCount }} 张图片，约 {{ deliveryEstimateSize }}</span>
          </div>
        </div>
        <div class="delivery-checklist-body">
          <div class="delivery-summary">
            <span>项目：{{ deliveryPackageData.projectName || '未知' }}</span>
            <span>图片总数：{{ deliveryPackageData.imageCount || 0 }}</span>
          </div>
          <table class="delivery-table" v-if="deliveryChecklist.length > 0">
            <thead>
              <tr>
                <th>文件名</th>
                <th>产品单元</th>
                <th>修图师</th>
                <th>修订次数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in deliveryChecklist" :key="idx">
                <td class="td-name">{{ item.name }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.retoucher }}</td>
                <td class="td-center">{{ item.revisions }}</td>
                <td>
                  <span class="checklist-status" :class="item.status === '已解决' ? 'status-resolved' : 'status-pending'">
                    {{ item.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="delivery-empty">暂无交付项</div>
        </div>
      </div>
    </div>

    <!-- V1.19: 支出记录弹窗 -->
    <div v-if="showExpenseModal" class="comparison-overlay" @click.self="showExpenseModal = false">
      <div class="comparison-modal expense-modal">
        <div class="comparison-header">
          <h3>项目支出记录</h3>
          <button @click="showExpenseModal = false" aria-label="关闭">✕</button>
        </div>
        <div class="expense-modal-body">
          <!-- 新增支出表单 -->
          <div class="expense-add-form">
            <select v-model="newExpense.category" class="form-input expense-category">
              <option value="">选择类别</option>
              <option value="修图师工资">修图师工资</option>
              <option value="外包费用">外包费用</option>
              <option value="场地租赁">场地租赁</option>
              <option value="道具采购">道具采购</option>
              <option value="交通差旅">交通差旅</option>
              <option value="其他">其他</option>
            </select>
            <input v-model.number="newExpense.amount" type="number" step="0.01" min="0" placeholder="金额" class="form-input expense-amount" />
            <input v-model="newExpense.expenseDate" type="date" class="form-input expense-date" />
            <input v-model="newExpense.note" type="text" placeholder="备注（可选）" class="form-input expense-note" />
            <button class="btn-primary btn-sm" @click="addExpense" :disabled="!newExpense.category || !newExpense.amount">添加</button>
          </div>
          <!-- 支出列表 -->
          <div class="expense-list" v-if="expenses.length > 0">
            <div class="expense-item" v-for="exp in expenses" :key="exp.id">
              <span class="expense-cat">{{ exp.category }}</span>
              <span class="expense-amt">¥{{ exp.amount.toFixed(2) }}</span>
              <span class="expense-date">{{ exp.expense_date }}</span>
              <span class="expense-note-text">{{ exp.note }}</span>
              <button class="btn-icon-danger" @click="deleteExpense(exp.id)" title="删除">×</button>
            </div>
          </div>
          <div v-else class="expense-empty">暂无支出记录</div>
          <!-- 合计 -->
          <div class="expense-total" v-if="expenses.length > 0">
            支出合计：<strong>¥{{ expenseTotal.toFixed(2) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- UX-41: 提交确认弹窗 -->
    <div v-if="showSubmitConfirmModal" class="modal-overlay" @click.self="showSubmitConfirmModal = false">
      <div class="modal-content">
        <h3 class="modal-title">提交确认</h3>
        <p class="modal-text">确定提交当前卡片并跳转到下一张？</p>
        <div class="submit-confirm-checkbox">
          <label class="checkbox-label">
            <input type="checkbox" v-model="submitConfirmNoPrompt" />
            不再提示
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="cancelSubmitConfirm">取消</button>
          <button class="btn-confirm" @click="confirmSubmitAndNext">确定</button>
        </div>
      </div>
    </div>

    <!-- FB-002: 意见汇总面板 -->
    <div v-if="showCommentsSummary" class="comments-summary-overlay" @click.self="showCommentsSummary = false">
      <div class="comments-summary-panel">
        <div class="comments-summary-header">
          <h3>意见汇总</h3>
          <button class="btn-close" @click="showCommentsSummary = false" aria-label="关闭">✕</button>
        </div>
        <div class="comments-summary-filters">
          <button
            v-for="f in summaryFilters"
            :key="f.value"
            class="summary-filter-btn"
            :class="{ active: summaryStatusFilter === f.value }"
            @click="summaryStatusFilter = f.value"
          >{{ f.label }}</button>
        </div>
        <div class="comments-summary-list">
          <div v-if="commentsSummaryLoading" class="summary-loading">加载中...</div>
          <div v-else-if="filteredSummary.length === 0" class="summary-empty">暂无意见数据</div>
          <div v-for="group in filteredSummary" :key="group.imageId" class="summary-group">
            <div class="summary-group-header">
              <img v-if="group.thumbnailUrl" :src="group.thumbnailUrl" class="summary-thumb" />
              <div v-else class="summary-thumb-placeholder"></div>
              <span class="summary-image-name">{{ group.imageName || group.imageId }}</span>
              <span class="summary-group-count">{{ group.items.length }} 条</span>
            </div>
            <div class="summary-items">
              <div v-for="item in group.items" :key="item.id" class="summary-item">
                <span class="summary-type-badge">{{ item.annotationType || '标注' }}</span>
                <span class="summary-text">{{ item.commentText }}</span>
                <span class="summary-status-badge" :class="item.status === 'resolved' ? 'summary-resolved' : 'summary-unresolved'">
                  {{ item.status === 'resolved' ? '已解决' : '未解决' }}
                </span>
                <span class="summary-assignee" v-if="item.assigneeName">{{ item.assigneeName }}</span>
                <span class="summary-date">{{ formatDate(item.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FB-008: 批量创建产品单元模态框 -->
    <Modal v-if="showBatchUnitModal" :visible="showBatchUnitModal" title="批量创建产品单元" size="large" @close="showBatchUnitModal = false">
      <div class="batch-unit-modal-body">
        <p class="batch-unit-hint">为未分配图片创建产品单元，每个单元可包含多张图片。</p>
        <div class="batch-unit-unassigned" v-if="unassignedImages.length > 0">
          <div class="batch-unit-section-label">未分配图片 ({{ unassignedImages.length }} 张)</div>
          <div class="batch-unit-image-grid">
            <div
              v-for="img in unassignedImages"
              :key="img.id"
              class="batch-unit-image-item"
              :class="{ selected: batchSelectedImageIds.has(img.id) }"
              @click="toggleBatchImageSelect(img.id)"
            >
              <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
              <div v-else class="batch-unit-img-placeholder"></div>
              <span v-if="batchSelectedImageIds.has(img.id)" class="batch-unit-check-mark">✓</span>
            </div>
          </div>
        </div>
        <div v-else class="batch-unit-no-unassigned">所有图片已分配</div>
        <div class="batch-unit-rows">
          <div class="batch-unit-section-label">新建单元列表</div>
          <div v-for="(row, index) in batchUnitRows" :key="index" class="batch-unit-row">
            <input
              v-model="row.name"
              type="text"
              class="form-input batch-unit-name-input"
              placeholder="单元名称"
            />
            <span class="batch-unit-row-count">已选 {{ batchSelectedImageIds.size }} 张图片</span>
            <button class="btn-icon-danger" @click="removeBatchUnitRow(index)" title="删除">×</button>
          </div>
          <button class="btn-add-row" @click="addBatchUnitRow">+ 添加单元行</button>
        </div>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="showBatchUnitModal = false">取消</button>
        <button class="btn-confirm" @click="submitBatchUnits" :disabled="batchUnitRows.length === 0 || batchSelectedImageIds.size === 0">批量创建</button>
      </template>
    </Modal>

    <!-- FB-014: 简化巡检报告面板 -->
    <div v-if="showSimplifiedReport" class="comparison-overlay" @click.self="showSimplifiedReport = false">
      <div class="comparison-modal simplified-report-modal">
        <div class="comparison-header">
          <h3>巡检报告（客户版）</h3>
          <div class="simplified-report-header-actions">
            <button class="btn-toolbar btn-sm" @click="simplifiedReport = false; router.push(`/project/${projectId}/color-check`)">切换专业版</button>
            <button @click="showSimplifiedReport = false" aria-label="关闭">✕</button>
          </div>
        </div>
        <div class="simplified-report-body">
          <div v-if="simplifiedReportLoading" class="simplified-report-loading">加载中...</div>
          <div v-else-if="simplifiedReportData" class="simplified-report-content">
            <div v-if="simplifiedReportData.summary" class="simplified-report-summary">
              <strong>总体评估：</strong>{{ simplifiedReportData.summary }}
            </div>
            <div v-if="simplifiedReportData.items && simplifiedReportData.items.length > 0" class="simplified-report-items">
              <div v-for="(item, idx) in simplifiedReportData.items" :key="idx" class="simplified-report-item">
                <span class="simplified-report-item-idx">{{ Number(idx) + 1 }}.</span>
                <span class="simplified-report-item-text">{{ item.description || item.plainText || item }}</span>
                <span v-if="item.severity" class="simplified-report-severity" :class="'severity-' + item.severity">
                  {{ item.severity === 'high' ? '严重' : item.severity === 'medium' ? '中等' : '轻微' }}
                </span>
              </div>
            </div>
            <div v-else class="simplified-report-empty">暂无检测问题</div>
          </div>
          <div v-else class="simplified-report-empty">暂无报告数据</div>
        </div>
      </div>
    </div>

    <!-- FB-010: 产品单元创建向导 -->
    <Modal v-if="showWizardModal" :visible="showWizardModal" :title="wizardTitle" size="large" @close="closeWizard">
      <!-- 进度指示器 -->
      <div class="wizard-progress">
        <div
          v-for="step in wizardSteps"
          :key="step.index"
          class="wizard-progress-step"
          :class="{
            active: wizardStep === step.index,
            completed: wizardStep > step.index,
          }"
        >
          <div class="wizard-step-dot">
            <span v-if="wizardStep > step.index">✓</span>
            <span v-else>{{ step.index }}</span>
          </div>
          <span class="wizard-step-label">{{ step.label }}</span>
          <div v-if="step.index < wizardSteps.length" class="wizard-step-line"></div>
        </div>
      </div>

      <!-- Step 1: 选择图片 -->
      <div v-if="wizardStep === 1" class="wizard-step-body">
        <p class="wizard-hint">选择要创建产品单元的图片（可多选），或上传新图片。</p>
        <div class="wizard-upload-row">
          <label class="btn-wizard-upload">
            <Upload :size="14" /> 上传图片
            <input type="file" multiple accept="image/*" @change="handleWizardUpload" hidden />
          </label>
        </div>
        <div class="wizard-image-grid" v-if="wizardAvailableImages.length > 0">
          <div
            v-for="img in wizardAvailableImages"
            :key="img.id"
            class="wizard-image-item"
            :class="{ selected: wizardSelectedImageIds.has(img.id) }"
            @click="toggleWizardImageSelect(img.id)"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
            <div v-else class="wizard-img-placeholder"></div>
            <span class="wizard-img-name">{{ img.originalName || img.id }}</span>
            <span v-if="wizardSelectedImageIds.has(img.id)" class="wizard-check-mark">✓</span>
          </div>
        </div>
        <div v-else class="wizard-empty">暂无未分配图片，请上传新图片</div>
      </div>

      <!-- Step 2: 分组 -->
      <div v-if="wizardStep === 2" class="wizard-step-body">
        <p class="wizard-hint">将图片拖入分组，或点击分组分配图片。为每个分组命名。</p>
        <div class="wizard-groups">
          <div v-for="(group, gIdx) in wizardGroups" :key="gIdx" class="wizard-group">
            <div class="wizard-group-header">
              <input
                v-model="group.name"
                type="text"
                class="form-input wizard-group-name-input"
                placeholder="输入分组名称"
              />
              <span class="wizard-group-count">{{ group.imageIds.length }} 张</span>
              <button class="btn-icon-danger" @click="removeWizardGroup(gIdx)" title="删除分组">×</button>
            </div>
            <div
              class="wizard-group-images"
              @dragover.prevent
              @drop.prevent="handleWizardDrop(gIdx, $event)"
            >
              <div v-if="group.imageIds.length === 0" class="wizard-group-drop-hint">
                拖拽图片到此处
              </div>
              <div
                v-for="imgId in group.imageIds"
                :key="imgId"
                class="wizard-group-image"
                draggable="true"
                @dragstart="handleWizardDragStart($event, imgId, gIdx)"
              >
                <img
                  v-if="getWizardImageUrl(imgId)"
                  :src="getWizardImageUrl(imgId)"
                  :alt="imgId"
                />
                <div v-else class="wizard-img-placeholder-sm"></div>
                <button class="wizard-group-img-remove" @click="removeWizardImageFromGroup(gIdx, imgId)" title="移出">×</button>
              </div>
            </div>
          </div>
          <button class="btn-add-group" @click="addWizardGroup">+ 添加分组</button>
        </div>
        <!-- 未分配图片池 -->
        <div class="wizard-unassigned-pool" v-if="wizardUnassignedIds.length > 0">
          <div class="wizard-pool-label">未分配图片 ({{ wizardUnassignedIds.length }})</div>
          <div class="wizard-pool-images">
            <div
              v-for="imgId in wizardUnassignedIds"
              :key="imgId"
              class="wizard-pool-image"
              draggable="true"
              @dragstart="handleWizardDragStart($event, imgId, -1)"
            >
              <img
                v-if="getWizardImageUrl(imgId)"
                :src="getWizardImageUrl(imgId)"
                :alt="imgId"
              />
              <div v-else class="wizard-img-placeholder-sm"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: 确认 -->
      <div v-if="wizardStep === 3" class="wizard-step-body">
        <p class="wizard-hint">检查以下产品单元，确认后将创建。</p>
        <div class="wizard-review-list">
          <div v-for="(group, gIdx) in wizardGroups" :key="gIdx" class="wizard-review-group">
            <div class="wizard-review-group-header">
              <strong>{{ group.name || '未命名分组' }}</strong>
              <span>{{ group.imageIds.length }} 张图片</span>
            </div>
            <div class="wizard-review-images">
              <div v-for="imgId in group.imageIds" :key="imgId" class="wizard-review-image">
                <img
                  v-if="getWizardImageUrl(imgId)"
                  :src="getWizardImageUrl(imgId)"
                  :alt="imgId"
                />
                <div v-else class="wizard-img-placeholder-sm"></div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="wizardGroups.length === 0" class="wizard-empty">暂无分组，请返回上一步创建</div>
      </div>

      <template #footer>
        <div class="wizard-footer">
          <button class="btn-cancel" @click="closeWizard">取消</button>
          <div class="wizard-footer-right">
            <button v-if="wizardStep > 1" class="btn-secondary" @click="wizardStep--">上一步</button>
            <button v-if="wizardStep < 3" class="btn-primary" @click="goToNextWizardStep" :disabled="!canGoNextWizardStep">下一步</button>
            <button v-if="wizardStep === 3" class="btn-primary" @click="confirmWizard" :disabled="wizardGroups.length === 0 || !wizardGroups.every(g => g.name.trim())">确认创建</button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useAnnotationStore } from '@/stores/annotation'
import { annotationApi } from '@/api/annotations'
import { projectApi } from '@/api/projects'
import client from '@/api/client'
import ImageViewer from '@/components/viewer/ImageViewer.vue'
import Modal from '@/components/common/Modal.vue'
import type { ProjectStatus, AnnotationToolType, AnnotationColor, PenWidth, ArrowWidth, ImageMedia, CommentCard, Annotation, ImageDiscussion } from '@/types/models'
import { PROJECT_STATUS_LABELS } from '@/types/models'
import { Link, Download, Clock, Package, Search, ListChecks, Sparkles, Lightbulb, FileText, BookOpen, Undo, Redo, MoreHorizontal, ChevronRight, AlertTriangle, MousePointer2, Pen, Square, Circle, ArrowUpRight, Type, Eraser, GripVertical, ChevronDown, CheckCircle2, Edit3, Flag, CheckSquare, Receipt, MessageSquare, Bell, Upload, Wrench } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const annotationStore = useAnnotationStore()

const projectId = computed(() => route.params.id as string)
const activeUnitId = ref<string>('')
const focusedCardId = ref<string>('')
const toastMsg = ref('')
const toastType = ref<'success' | 'error'>('success')
const projectLoading = ref(false)
const projectError = ref('')
const showAddUnit = ref(false)
const newUnitName = ref('')
const addUnitInputRef = ref<HTMLInputElement | null>(null)

// 11.1 一键交付包下载
const downloadingDelivery = ref(false)
const deliveryChecklistVisible = ref(false)
const deliveryChecklist = ref<Array<{ name: string; unit: string; retoucher: string; revisions: number; status: string }>>([])
const deliveryPackageData = ref<{ projectName?: string; previewUrl?: string; originals?: string[]; imageCount?: number }>({})

// V1.19: 交付包选项
const deliveryOptions = ref([
  { key: 'final_images', label: '最终成片', desc: '所有确稿通过的图片', checked: true },
  { key: 'compare_images', label: '修改前后对比图', desc: '每张图片的修改前后对比', checked: false },
  { key: 'originals', label: '原片', desc: '原始拍摄图片', checked: false },
  { key: 'color_check_report', label: '色差巡检报告', desc: 'PDF 格式', checked: false },
  { key: 'consistency_check_report', label: '光影巡检报告', desc: 'PDF 格式', checked: false },
  { key: 'acceptance_form', label: '客户验收单', desc: 'PDF 格式', checked: false },
  { key: 'excel', label: '交付清单', desc: 'Excel 格式', checked: true },
  { key: 'pdf', label: '项目报告', desc: 'PDF 格式', checked: true },
])
const saveDeliveryDefaults = ref(false)
const deliveryEstimateCount = computed(() => {
  return deliveryOptions.value.find(o => o.key === 'final_images')?.checked ? (deliveryPackageData.value.imageCount || 0) : 0
})
const deliveryEstimateSize = computed(() => {
  const count = deliveryEstimateCount.value
  if (count === 0) return '< 1MB'
  return '约 ' + Math.max(1, Math.round(count * 3)) + 'MB'
})

async function downloadDeliveryPackage() {
  downloadingDelivery.value = true
  try {
    // V1.19: 加载交付包默认配置
    try {
      const defaultsRes = await client.get('/v1/workspace/delivery-defaults')
      const defaults = defaultsRes.data.data
      if (defaults && defaults.include) {
        const includeList = defaults.include.split(',')
        deliveryOptions.value.forEach(o => {
          o.checked = includeList.indexOf(o.key) !== -1
        })
      }
    } catch (e) { /* use defaults */ }
    const res = await client.get(`/v1/projects/${projectId.value}/delivery-package`)
    const data = res.data?.data
    if (data && data.checklist) {
      deliveryPackageData.value = data
      deliveryChecklist.value = data.checklist
      deliveryChecklistVisible.value = true
      showToast('交付清单已加载', 'success')
    } else {
      showToast('暂无交付数据', 'error')
    }
  } catch (e) {
    console.error('加载交付清单失败:', e)
    showToast('加载失败，请稍后重试', 'error')
  } finally {
    downloadingDelivery.value = false
  }
}

// F-53: 下载格式选择
const showDownloadDropdown = ref(false)
// DS-03: 工具菜单
const showToolsMenu = ref(false)
// DS-03: 更多菜单
const showMoreMenu = ref(false)

// V1.19: 支出记录
const showExpenseModal = ref(false)
const expenses = ref<Array<{ id: string; category: string; amount: number; expense_date: string; note: string }>>([])
const expenseTotal = ref(0)
const newExpense = ref({ category: '', amount: 0, expenseDate: new Date().toISOString().slice(0, 10), note: '' })

// FB-002: 意见汇总面板
const showCommentsSummary = ref(false)
const commentsSummaryLoading = ref(false)
const commentsSummaryData = ref<Array<{
  imageId: string
  imageName: string
  thumbnailUrl: string
  items: Array<{
    id: string
    annotationType: string
    commentText: string
    status: string
    assigneeName: string
    createdAt: string
  }>
}>>([])
const summaryStatusFilter = ref('all')
const summaryFilters = [
  { label: '全部', value: 'all' },
  { label: '未解决', value: 'open' },
  { label: '已解决', value: 'resolved' },
]

const filteredSummary = computed(() => {
  if (summaryStatusFilter.value === 'all') return commentsSummaryData.value
  return commentsSummaryData.value
    .map(g => ({
      ...g,
      items: g.items.filter(i => i.status === summaryStatusFilter.value)
    }))
    .filter(g => g.items.length > 0)
})

async function openCommentsSummary() {
  showCommentsSummary.value = true
  commentsSummaryLoading.value = true
  try {
    const res = await client.get(`/v1/projects/${projectId.value}/comments-summary`)
    commentsSummaryData.value = res.data.data || []
  } catch (e) {
    console.error('加载意见汇总失败:', e)
    showToast('加载意见汇总失败', 'error')
  } finally {
    commentsSummaryLoading.value = false
  }
}

// FB-008: 批量创建产品单元
const showBatchUnitModal = ref(false)
const batchUnitRows = ref<Array<{ name: string }>>([])
const batchSelectedImageIds = ref<Set<string>>(new Set())
const unassignedImages = ref<Array<{ id: string; thumbnailUrls?: string[] }>>([])

function toggleBatchImageSelect(id: string) {
  const next = new Set(batchSelectedImageIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  batchSelectedImageIds.value = next
}

function addBatchUnitRow() {
  batchUnitRows.value.push({ name: '' })
}

function removeBatchUnitRow(index: number) {
  batchUnitRows.value.splice(index, 1)
}

async function submitBatchUnits() {
  const validRows = batchUnitRows.value.filter(r => r.name.trim())
  if (validRows.length === 0 || batchSelectedImageIds.value.size === 0) return
  try {
    await client.post(`/v1/projects/${projectId.value}/product-units/batch`, {
      units: validRows.map(r => ({ name: r.name.trim() })),
      imageIds: Array.from(batchSelectedImageIds.value),
    })
    showToast('批量创建成功', 'success')
    showBatchUnitModal.value = false
    batchUnitRows.value = []
    batchSelectedImageIds.value = new Set()
    await projectStore.fetchProject(projectId.value)
  } catch (e) {
    console.error('批量创建失败:', e)
    showToast('批量创建失败', 'error')
  }
}

// FB-010: 产品单元创建向导
const showWizardModal = ref(false)
const wizardStep = ref(1)
const wizardSteps = [
  { index: 1, label: '选择图片' },
  { index: 2, label: '分组命名' },
  { index: 3, label: '确认创建' },
]
const wizardTitle = computed(() => `创建产品单元 - 步骤 ${wizardStep.value}/3`)
const wizardSelectedImageIds = ref(new Set<string>())
const wizardGroups = ref<Array<{ name: string; imageIds: string[] }>>([])
const wizardDragImageId = ref<string | null>(null)
const wizardDragSourceGroup = ref<number | null>(null)

const wizardAvailableImages = computed(() => {
  if (!projectStore.currentProject) return []
  const allImages = (projectStore.currentProject as any).images || []
  // Show unassigned images + uploaded images (filter out already assigned)
  return allImages.filter((img: any) => {
    if (!projectStore.productUnits) return true
    const assigned = projectStore.productUnits.some((u: any) =>
      u.images?.some((i: any) => i.id === img.id)
    )
    return !assigned
  })
})

const wizardUnassignedIds = computed(() => {
  return Array.from(wizardSelectedImageIds.value).filter(
    id => !wizardGroups.value.some(g => g.imageIds.includes(id))
  )
})

const canGoNextWizardStep = computed(() => {
  if (wizardStep.value === 1) return wizardSelectedImageIds.value.size > 0
  if (wizardStep.value === 2) return wizardGroups.value.length > 0 && wizardGroups.value.every(g => g.name.trim())
  return true
})

function openUnitWizard() {
  wizardStep.value = 1
  wizardSelectedImageIds.value = new Set()
  wizardGroups.value = []
  showWizardModal.value = true
}

function closeWizard() {
  showWizardModal.value = false
  wizardStep.value = 1
  wizardSelectedImageIds.value = new Set()
  wizardGroups.value = []
}

function toggleWizardImageSelect(id: string) {
  const newSet = new Set(wizardSelectedImageIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  wizardSelectedImageIds.value = newSet
}

function goToNextWizardStep() {
  if (wizardStep.value === 1) {
    // Auto-create one group with all selected images
    wizardGroups.value = [{ name: '', imageIds: Array.from(wizardSelectedImageIds.value) }]
  }
  wizardStep.value++
}

function addWizardGroup() {
  wizardGroups.value.push({ name: '', imageIds: [] })
}

function removeWizardGroup(index: number) {
  wizardGroups.value.splice(index, 1)
}

function handleWizardDragStart(e: DragEvent, imageId: string, groupIdx: number) {
  wizardDragImageId.value = imageId
  wizardDragSourceGroup.value = groupIdx
  e.dataTransfer!.effectAllowed = 'move'
}

function handleWizardDrop(targetGroupIdx: number, _e: DragEvent) {
  const imgId = wizardDragImageId.value
  const sourceGroup = wizardDragSourceGroup.value
  if (!imgId) return
  // Remove from source group
  if (sourceGroup !== null && sourceGroup >= 0) {
    const group = wizardGroups.value[sourceGroup]
    if (group) {
      group.imageIds = group.imageIds.filter(id => id !== imgId)
    }
  }
  // Add to target group
  const target = wizardGroups.value[targetGroupIdx]
  if (target && !target.imageIds.includes(imgId)) {
    target.imageIds.push(imgId)
  }
  wizardDragImageId.value = null
  wizardDragSourceGroup.value = null
}

function removeWizardImageFromGroup(groupIdx: number, imgId: string) {
  const group = wizardGroups.value[groupIdx]
  if (group) {
    group.imageIds = group.imageIds.filter(id => id !== imgId)
  }
}

function getWizardImageUrl(imgId: string): string {
  const img = wizardAvailableImages.value.find((i: any) => i.id === imgId)
  return img?.thumbnailUrls?.[0] || img?.url || ''
}

function handleWizardUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  showToast(`已选择 ${input.files.length} 张图片，将在创建产品单元时上传`, 'success')
  // Note: actual upload happens on confirmation
  input.value = ''
}

async function confirmWizard() {
  const validGroups = wizardGroups.value.filter(g => g.name.trim() && g.imageIds.length > 0)
  if (validGroups.length === 0) {
    showToast('请至少创建一个有名称和图片的分组', 'error')
    return
  }
  try {
    for (const group of validGroups) {
      await client.post(`/v1/projects/${projectId.value}/product-units`, {
        name: group.name.trim(),
        imageIds: group.imageIds,
      })
    }
    showToast(`成功创建 ${validGroups.length} 个产品单元`, 'success')
    showWizardModal.value = false
    wizardStep.value = 1
    wizardSelectedImageIds.value = new Set()
    wizardGroups.value = []
    await projectStore.fetchProject(projectId.value)
  } catch (e) {
    console.error('创建产品单元失败:', e)
    showToast('创建失败，请稍后重试', 'error')
  }
}

// FB-022: 讨论已读 + 提醒
async function nudgeDiscussion(discussionId: string) {
  try {
    await client.post(`/v1/discussions/${discussionId}/nudge`)
    showToast('已提醒对方', 'success')
  } catch (e) {
    console.error('提醒失败:', e)
    showToast('提醒失败', 'error')
  }
}

const projectProfit = computed(() => {
  const contract = (projectStore.currentProject as any)?.contract_amount || projectStore.currentProject?.contractAmount || 0
  return Number(contract) - expenseTotal.value
})

async function loadExpenses() {
  try {
    const res = await client.get(`/v1/projects/${projectId.value}/expenses`)
    expenses.value = res.data.data.expenses || []
    expenseTotal.value = res.data.data.total || 0
  } catch (e) { /* ignore */ }
}

async function addExpense() {
  if (!newExpense.value.category || !newExpense.value.amount) return
  try {
    await client.post(`/v1/projects/${projectId.value}/expenses`, {
      category: newExpense.value.category,
      amount: newExpense.value.amount,
      expenseDate: newExpense.value.expenseDate,
      note: newExpense.value.note
    })
    newExpense.value = { category: '', amount: 0, expenseDate: new Date().toISOString().slice(0, 10), note: '' }
    await loadExpenses()
  } catch (e) { /* ignore */ }
}

async function deleteExpense(eid: string) {
  try {
    await client.delete(`/v1/projects/${projectId.value}/expenses/${eid}`)
    await loadExpenses()
  } catch (e) { /* ignore */ }
}
const customDownloadVisible = ref(false)
const customWidth = ref(2000)
const customQuality = ref(85)

// 异步打包
const deliveryTaskVisible = ref(false)
const deliveryTaskProgress = ref(0)
let deliveryTaskTimer: ReturnType<typeof setInterval> | null = null

function openCustomDownloadDialog() {
  showDownloadDropdown.value = false
  customDownloadVisible.value = true
}

async function downloadWithFormat(option: 'original' | 'web' | 'custom') {
  showDownloadDropdown.value = false
  if (option === 'custom') {
    customDownloadVisible.value = false
  }

  try {
    const checkedOptions = deliveryOptions.value.filter(o => o.checked).map(o => o.key).join(',')
    const params: Record<string, any> = { option, include: checkedOptions }
    if (option === 'custom') {
      params.width = customWidth.value
      params.quality = customQuality.value
    }

    const res = await client.get(`/v1/projects/${projectId.value}/delivery-package`, {
      params,
      responseType: 'blob',
    })

    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `delivery-${projectId.value}-${option}.zip`
    a.click()
    URL.revokeObjectURL(url)
    showToast('下载已开始', 'success')

    // V1.19: 保存交付包默认配置
    if (saveDeliveryDefaults.value) {
      try {
        const checkedOpts = deliveryOptions.value.filter(o => o.checked).map(o => o.key).join(',')
        await client.put('/v1/workspace/delivery-defaults', { include: checkedOpts })
      } catch (e) { /* ignore */ }
    }
  } catch (e: any) {
    // 如果返回 202，说明是异步任务
    if (e?.response?.status === 202) {
      const taskId = e?.response?.data?.taskId || e?.response?.data?.data?.taskId
      if (taskId) {
        startDeliveryTaskPolling(taskId)
      } else {
        // 尝试 POST 创建异步任务
        try {
          const taskRes = await client.post(`/v1/projects/${projectId.value}/delivery-task`, {
            option,
            width: option === 'custom' ? customWidth.value : undefined,
            quality: option === 'custom' ? customQuality.value : undefined,
          })
          const tid = taskRes.data?.taskId || taskRes.data?.data?.taskId
          if (tid) {
            startDeliveryTaskPolling(tid)
          } else {
            showToast('打包任务创建失败', 'error')
          }
        } catch (taskErr: any) {
          console.error('创建打包任务失败:', taskErr)
          showToast('下载失败，请稍后重试', 'error')
        }
      }
    } else {
      console.error('下载失败:', e)
      showToast('下载失败，请稍后重试', 'error')
    }
  }
}

function startDeliveryTaskPolling(taskId: string) {
  deliveryTaskVisible.value = true
  deliveryTaskProgress.value = 0

  deliveryTaskTimer = setInterval(async () => {
    try {
      const res = await client.get(`/v1/projects/${projectId.value}/delivery-task/${taskId}`)
      const data = res.data?.data || res.data
      const status = data?.status
      const progress = data?.progress || 0

      deliveryTaskProgress.value = Math.min(progress, 100)

      if (status === 'completed' || status === 'done') {
        stopDeliveryTaskPolling()
        deliveryTaskVisible.value = false
        showToast('打包完成，开始下载', 'success')

        // 下载
        const downloadRes = await client.get(`/v1/projects/${projectId.value}/delivery-task/${taskId}/download`, {
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([downloadRes.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = `delivery-${projectId.value}.zip`
        a.click()
        URL.revokeObjectURL(url)
      } else if (status === 'failed' || status === 'error') {
        stopDeliveryTaskPolling()
        deliveryTaskVisible.value = false
        showToast('打包失败，请重试', 'error')
      }
    } catch {
      // 轮询失败，继续尝试
    }
  }, 2000)
}

function stopDeliveryTaskPolling() {
  if (deliveryTaskTimer) {
    clearInterval(deliveryTaskTimer)
    deliveryTaskTimer = null
  }
}

function cancelDeliveryTask() {
  stopDeliveryTaskPolling()
  deliveryTaskVisible.value = false
}

function handleDownloadClickOutside(e: MouseEvent) {
  if (showDownloadDropdown.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.download-split-wrap')) {
      showDownloadDropdown.value = false
    }
    // DS-03: close more menu on outside click
    if (!target.closest('.more-menu-wrap')) {
      showMoreMenu.value = false
    }
    // DS-03: close tools menu on outside click
    if (!target.closest('.tools-menu-wrap')) {
      showToolsMenu.value = false
    }
  }
}

// 4.1: 图片索引
const currentImageIndex = computed(() => {
  const images = currentUnitImages.value
  const cur = currentImage.value
  if (!cur) return 0
  return images.findIndex((i: ImageMedia) => i.id === cur.id)
})

// 4.7: 草稿
const currentCardDraft = computed(() => {
  const focused = annotationStore.commentCards.find(c => c.id === focusedCardId.value)
  return focused?.draftText || ''
})

// 4.9: 右键菜单 & 跨图同步
const contextMenuVisible = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuCard = ref<CommentCard | null>(null)
const syncModalVisible = ref(false)
const selectedSyncImageIds = ref(new Set<string>())

// 4.10: 抽查
const reviewModalVisible = ref(false)
const reviewCards = ref<any[]>([])
const reviewCurrentIndex = ref(0)

// 4.11: 最近操作
const recentActionsVisible = ref(false)
const recentActions = ref<any[]>([])

// 4.14: 讨论
const discussions = ref<ImageDiscussion[]>([])
const discussionText = ref('')

// UX-10: 争议历史弹窗
const showRejectionHistory = ref(false)
const rejectionHistoryCardId = ref<string | null>(null)
const rejectionHistoryImageId = ref<string | null>(null)
const rejectionHistory = ref<Array<{ id: string; time: string; userName: string; detail: string }>>([])
const rejectionHistoryLoading = ref(false)

// UX-11: 快速流转工具栏状态保持
const sessionToolState = ref<{
  tool: string
  color: string
  penWidth: number
  arrowWidth: number
} | null>(null)

// UX-13: 标注草稿自动保存
const DRAFT_KEY_PREFIX = 'epicshot_annotation_draft'
const draftKey = computed(() => `${DRAFT_KEY_PREFIX}_${projectId.value}_${currentImageId.value}`)
let draftTimer: ReturnType<typeof setInterval> | null = null

// UX-15: @ 提及
const showMentionList = ref(false)
const mentionQuery = ref('')
const mentionIndex = ref(0)
const projectMembers = ref<Array<{ id: string; name: string; role: string }>>([])

// UX-19: 修改前后对比
const showComparison = ref(false)
const compareOriginalUrl = ref('')
const compareProcessedUrl = ref('')

// FB-021: 版本对比
const showVersionComparison = ref(false)
const versionOriginalUrl = ref('')
const versionRevisedUrl = ref('')

async function openVersionComparison(cardId: string) {
  try {
    const res = await client.get(`/v1/comment-cards/${cardId}/versions`)
    const data = res.data?.data
    versionOriginalUrl.value = data?.originalUrl || ''
    versionRevisedUrl.value = data?.revisedUrl || ''
    showVersionComparison.value = true
  } catch (e) {
    console.error('加载版本对比失败:', e)
    showToast('加载版本对比失败', 'error')
  }
}

// UX-41: 快速流转提交确认
const confirmBeforeSubmit = ref(getConfirmBeforeSubmit())
const showSubmitConfirmModal = ref(false)
const submitConfirmNoPrompt = ref(false)
const pendingSubmitCard = ref<CommentCard | null>(null)

function getConfirmBeforeSubmit(): boolean {
  try {
    return localStorage.getItem('epicshot_confirm_before_submit') === 'true'
  } catch { return false }
}

function toggleConfirmBeforeSubmit() {
  confirmBeforeSubmit.value = !confirmBeforeSubmit.value
  try {
    localStorage.setItem('epicshot_confirm_before_submit', String(confirmBeforeSubmit.value))
  } catch { /* ignore */ }
}

// UX-49: 图片预加载
const preloadedImages = new Map<string, HTMLImageElement>()

function preloadImage(url: string) {
  if (!url || preloadedImages.has(url)) return
  requestIdleCallback(() => {
    const img = new Image()
    img.onerror = () => {
      preloadedImages.delete(url)
    }
    img.src = url
    preloadedImages.set(url, img)
  })
}

function preloadNextImages() {
  const images = currentUnitImages.value
  const currentIdx = currentImageIndex.value
  const nextIdx = currentIdx + 1
  const nextNextIdx = currentIdx + 2
  if (nextIdx < images.length) {
    const nextImg = images[nextIdx] as any
    preloadImage(nextImg.url || nextImg.thumbnailUrl || '')
  }
  if (nextNextIdx < images.length) {
    const nextNextImg = images[nextNextIdx] as any
    preloadImage(nextNextImg.url || nextNextImg.thumbnailUrl || '')
  }
}

function handleSubmitAndNext(card: CommentCard) {
  preloadNextImages()
  if (confirmBeforeSubmit.value) {
    pendingSubmitCard.value = card
    showSubmitConfirmModal.value = true
  } else {
    doSubmitAndNext(card)
  }
}

function cancelSubmitConfirm() {
  showSubmitConfirmModal.value = false
  pendingSubmitCard.value = null
}

async function confirmSubmitAndNext() {
  showSubmitConfirmModal.value = false
  if (submitConfirmNoPrompt.value) {
    confirmBeforeSubmit.value = false
    try {
      localStorage.setItem('epicshot_confirm_before_submit', 'false')
    } catch { /* ignore */ }
  }
  if (pendingSubmitCard.value) {
    await doSubmitAndNext(pendingSubmitCard.value)
    pendingSubmitCard.value = null
  }
}

async function doSubmitAndNext(card: CommentCard) {
  try {
    await annotationApi.updateCardStatus(card.id, 'resolve')
    showToast('卡片已提交', 'success')
    // 跳转到下一张图片
    navigateImage(1)
  } catch (e) {
    showToast('提交失败', 'error')
  }
}

// FB-014: 简化巡检报告切换
const simplifiedReport = ref(false)
const simplifiedReportLoading = ref(false)
const simplifiedReportData = ref<any>(null)
const showSimplifiedReport = ref(false)

function openInspectionReport(type: string) {
  if (simplifiedReport.value) {
    // 客户版：加载简化报告并显示
    fetchSimplifiedReport(type)
  } else {
    // 专业版：导航到巡检页面
    router.push(`/project/${projectId.value}/${type}`)
  }
  showMoreMenu.value = false
}

async function fetchSimplifiedReport(type: string) {
  simplifiedReportLoading.value = true
  showSimplifiedReport.value = true
  try {
    const res = await client.get(`/v1/projects/${projectId.value}/inspection-report/simplified`, {
      params: { type }
    })
    simplifiedReportData.value = res.data?.data || res.data
  } catch (e: any) {
    console.error('加载简化报告失败:', e)
    showToast('加载简化报告失败', 'error')
    showSimplifiedReport.value = false
  } finally {
    simplifiedReportLoading.value = false
  }
}
const showOperationLogs = ref(false)
const operationLogs = ref<Array<{ id: string; action: string; user_name: string; detail: string; created_at: string }>>([])
const operationLogsLoading = ref(false)
const logFilter = ref('')
const logFilters = [
  { label: '全部', value: '' },
  { label: '创建卡片', value: 'create_card' },
  { label: '驳回', value: 'dispute_card' },
  { label: '解决', value: 'resolve_card' },
  { label: '完成项目', value: 'complete_project' },
]

const filteredLogs = computed(() => {
  if (!logFilter.value) return operationLogs.value
  return operationLogs.value.filter(l => l.action === logFilter.value)
})

const actionLabelMap: Record<string, string> = {
  create_card: '创建卡片',
  resolve_card: '解决卡片',
  dispute_card: '驳回卡片',
  complete_project: '完成项目',
}

function actionLabel(action: string): string {
  return actionLabelMap[action] || action
}

async function openOperationLogs() {
  showOperationLogs.value = true
  operationLogsLoading.value = true
  operationLogs.value = []
  try {
    const res = await client.get(`/v1/projects/${projectId.value}/logs`)
    if (res.data?.data) {
      operationLogs.value = res.data.data
    }
  } catch (e) {
    console.error('[OperationLogs] load failed', e)
  } finally {
    operationLogsLoading.value = false
  }
}

// 卡片 refs 映射
const cardRefs = ref<Record<string, HTMLElement>>({})

function setCardRef(cardId: string, el: any) {
  if (el) {
    cardRefs.value[cardId] = el
  }
}

function cancelAddUnit() {
  showAddUnit.value = false
  newUnitName.value = ''
}

async function loadProject() {
  projectLoading.value = true
  projectError.value = ''
  try {
    await projectStore.fetchProject(projectId.value)
    await projectStore.fetchProductUnits(projectId.value)
  } catch (e: any) {
    projectError.value = e?.response?.data?.message || e?.message || '项目加载失败'
  } finally {
    projectLoading.value = false
  }
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => { toastMsg.value = '' }, 3000)
}

const statusLabelMap: Record<ProjectStatus, string> = PROJECT_STATUS_LABELS

function statusLabel(status: ProjectStatus): string {
  return statusLabelMap[status] || status
}

// DS-04: 增加选择/指针工具
const tools = [
  { type: 'pointer' as const, icon: MousePointer2, label: '指针' },
  { type: 'pen' as const, icon: Pen, label: '画笔' },
  { type: 'rectangle' as const, icon: Square, label: '矩形' },
  { type: 'ellipse' as const, icon: Circle, label: '椭圆' },
  { type: 'arrow' as const, icon: ArrowUpRight, label: '箭头' },
  { type: 'text' as const, icon: Type, label: '文字' },
  { type: 'eraser' as const, icon: Eraser, label: '橡皮' },
]

const colors: AnnotationColor[] = ['#FF0000', '#FFCC00', '#0066FF', '#FFFFFF']
const widths: (PenWidth | ArrowWidth)[] = [3, 5, 10]
const activePenWidth = ref<PenWidth>(5)

async function selectUnit(unitId: string) {
  activeUnitId.value = unitId
  try {
    await projectStore.fetchImages(unitId)
  } catch (e) {
    showToast('加载图片失败', 'error')
  }
}

function selectImage(img: ImageMedia) {
  projectStore.setCurrentImage(img)
  annotationStore.setCurrentImageId(img.id)
  try {
    annotationStore.loadAnnotations(img.id)
    annotationStore.loadCommentCards(img.id)
    loadDiscussions(img.id)
  } catch (e) {
    // Non-critical: image still viewable without annotations
  }
}

function focusCard(card: CommentCard) {
  focusedCardId.value = card.id
}

async function toggleCardStatus(card: CommentCard) {
  const action = card.status === 'resolved' ? 'unresolve' : 'resolve'
  try {
    await annotationApi.updateCardStatus(card.id, action)
    // Reload comment cards to reflect the change
    if (projectStore.currentImage) {
      annotationStore.loadCommentCards(projectStore.currentImage.id)
    }
  } catch (e) {
    showToast('状态更新失败', 'error')
  }
}

const currentUnitImages = computed(() => projectStore.currentImages)
const currentImage = computed(() => projectStore.currentImage)

const currentImageUrl = computed(() => {
  const img = currentImage.value
  if (!img) return ''
  // Use the 600px thumbnail for display, fallback to original
  const thumbs = img.thumbnailUrls || []
  if (thumbs.length >= 2) return thumbs[1] // 600px
  if (thumbs.length >= 1) return thumbs[0] // 200px thumb
  return img.originalUrl || ''
})

function navigateImage(direction: number) {
  // UX-11: 保存工具栏状态
  saveToolState()
  const images = currentUnitImages.value
  if (images.length === 0) return
  const cur = currentImage.value
  if (!cur) { selectImage(images[0]); restoreToolState(); return }
  const idx = images.findIndex((i: ImageMedia) => i.id === cur.id)
  const newIdx = (idx + direction + images.length) % images.length
  selectImage(images[newIdx])
  // UX-11: 恢复工具栏状态
  restoreToolState()
}

function onAnnotationCreated(_annotation: Annotation) {
  // Annotation is already persisted in store.addAnnotation
  // UX-13: 清除草稿
  clearDraft()
  showToast('标注已记录，修图师会收到通知', 'success')
}

function onAnnotationDeleted(_id: string) {
  // Annotation is already removed in store.removeAnnotation
  showToast('标注已移除', 'success')
}

async function handleShare() {
  try {
    const res = await projectApi.generateShare(projectId.value, '7days')
    const shareUrl = res.data.data?.url || ''
    await navigator.clipboard.writeText(shareUrl)
    showToast('分享链接已复制，客户现在就能查看了', 'success')
  } catch (e) {
    console.error('分享失败:', e)
    showToast('分享失败，请稍后重试', 'error')
  }
}

async function handleExportComments() {
  try {
    const res = await annotationApi.exportComments(projectId.value, 'excel')
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comments-${projectId.value}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('导出失败:', e)
    showToast('导出失败，请稍后重试', 'error')
  }
}

async function handleAddUnit() {
  const name = newUnitName.value.trim()
  if (!name) return
  try {
    await projectStore.createProductUnit(projectId.value, name)
    newUnitName.value = ''
    showAddUnit.value = false
    showToast('添加成功', 'success')
  } catch (e) {
    console.error('添加单元失败:', e)
    showToast('添加失败，请稍后重试', 'error')
  }
}

// 4.1: 页面跳转
function navigateToPage(index: number) {
  const images = currentUnitImages.value
  if (images.length === 0 || index < 0 || index >= images.length) return
  selectImage(images[index])
}

// 4.7: 草稿恢复
function restoreCardDraft(text: string) {
  if (focusedCardId.value) {
    const card = annotationStore.commentCards.find(c => c.id === focusedCardId.value)
    if (card && card.annotationId) {
      // Fill the textarea - for now we update the card text
      annotationApi.updateCardText(card.id, text).catch(() => {})
      annotationStore.loadCommentCards(card.imageId)
    }
  }
}

function clearCardDraft() {
  if (focusedCardId.value) {
    const card = annotationStore.commentCards.find(c => c.id === focusedCardId.value)
    if (card) {
      card.draftText = ''
    }
  }
}

function focusNextCard() {
  const cards = annotationStore.commentCards
  if (cards.length === 0) return
  const currentIdx = cards.findIndex(c => c.id === focusedCardId.value)
  const nextIdx = (currentIdx + 1) % cards.length
  focusedCardId.value = cards[nextIdx].id
  const el = cardRefs.value[cards[nextIdx].id]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

function handleKeyboardSubmit() {
  // Find the current card and submit it
  const cards = annotationStore.commentCards
  const currentCard = cards.find((c: any) => c.imageId === currentImageId.value)
  if (currentCard) {
    handleSubmitAndNext(currentCard)
  }
}

function handleKeyboardToolChange(tool: string) {
  annotationStore.setTool(tool as AnnotationToolType)
}

function handleKeyboardCloseModal() {
  showComparison.value = false
  deliveryChecklistVisible.value = false
  showSubmitConfirmModal.value = false
}

function handleKeydown(e: KeyboardEvent) {
  // Don't capture when typing in inputs
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if (e.key === 'ArrowLeft') { e.preventDefault(); navigateImage(-1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); navigateImage(1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); annotationStore.undo()
  }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
    e.preventDefault(); annotationStore.redo()
  }
  else if (e.key === 'Escape') {
    annotationStore.setTool('pointer')
  }
  else if (e.key >= '1' && e.key <= '7') {
    const toolIndex = parseInt(e.key) - 1
    if (tools[toolIndex]) {
      annotationStore.setTool(tools[toolIndex].type)
    }
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 4.9: 右键菜单 & 跨图同步
function showCardContextMenu(event: MouseEvent, card: CommentCard) {
  contextMenuPos.value = { x: event.clientX, y: event.clientY }
  contextMenuCard.value = card
  contextMenuVisible.value = true
}

function openSyncModal() {
  contextMenuVisible.value = false
  syncModalVisible.value = true
  selectedSyncImageIds.value = new Set()

  // 预选当前图片
  if (currentImage.value) {
    selectedSyncImageIds.value.add(currentImage.value.id)
  }
}

function toggleSyncImage(imageId: string) {
  const s = new Set(selectedSyncImageIds.value)
  if (s.has(imageId)) {
    s.delete(imageId)
  } else {
    s.add(imageId)
  }
  selectedSyncImageIds.value = s
}

async function executeSync() {
  if (!contextMenuCard.value || selectedSyncImageIds.value.size === 0) return
  try {
    await annotationApi.syncCardToImages(
      contextMenuCard.value.id,
      Array.from(selectedSyncImageIds.value)
    )
    showToast('同步成功', 'success')
    syncModalVisible.value = false
  } catch (e) {
    showToast('同步失败', 'error')
  }
}

// 4.10: 抽查
async function openReviewModal() {
  reviewModalVisible.value = true
  reviewCurrentIndex.value = 0
  try {
    const res = await annotationApi.getReviewRecentResolved(projectId.value)
    reviewCards.value = res.data.data || []
  } catch (e) {
    showToast('加载抽查卡片失败', 'error')
    reviewCards.value = []
  }
}

async function reviewAction(action: 'approve' | 'reject') {
  if (reviewCards.value.length === 0) return
  const card = reviewCards.value[reviewCurrentIndex.value]
  if (!card) return
  try {
    await annotationApi.reviewCard(card.id, action)
    if (reviewCurrentIndex.value < reviewCards.value.length - 1) {
      reviewCurrentIndex.value++
    } else {
      showToast('抽查完成', 'success')
      reviewModalVisible.value = false
    }
  } catch (e) {
    showToast('操作失败', 'error')
  }
}

// 4.11: 最近操作
async function openRecentActions() {
  recentActionsVisible.value = true
  try {
    const res = await annotationApi.getRecentActions(projectId.value)
    recentActions.value = (res.data.data || []).slice(0, 20)
  } catch (e) {
    showToast('加载最近操作失败', 'error')
    recentActions.value = []
  }
}

async function undoAction(actionId: string) {
  try {
    await annotationApi.undoRecentAction(actionId)
    showToast('操作已撤回', 'success')
    // 刷新列表
    await openRecentActions()
  } catch (e) {
    showToast('撤回失败', 'error')
  }
}

// 4.14: 讨论
async function loadDiscussions(imageId: string) {
  try {
    const res = await annotationApi.getDiscussions(imageId)
    discussions.value = res.data.data || []
  } catch {
    discussions.value = []
  }
}

async function sendDiscussion() {
  if (!discussionText.value.trim() || !currentImage.value) return
  const text = discussionText.value.trim()
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match: RegExpExecArray | null
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }
  try {
    await annotationApi.createDiscussion(currentImage.value.id, { text, mentions })
    discussionText.value = ''
    await loadDiscussions(currentImage.value.id)
  } catch (e) {
    showToast('发送讨论失败', 'error')
  }
}

// UX-10: 争议历史
async function openRejectionHistory(cardId: string) {
  rejectionHistoryCardId.value = cardId
  showRejectionHistory.value = true
  rejectionHistoryLoading.value = true
  rejectionHistory.value = []
  rejectionHistoryImageId.value = null
  try {
    const res = await client.get(`/v1/cards/${cardId}/rejection-history`)
    if (res.data?.data) {
      rejectionHistory.value = res.data.data.history || []
      rejectionHistoryImageId.value = res.data.data.imageId || null
    }
  } catch (e) {
    console.error('[RejectionHistory] load failed', e)
  } finally {
    rejectionHistoryLoading.value = false
  }
}

// UX-42: 争议次数本月/累计拆分
function getDisputeCountThisMonth(_card: CommentCard): number {
  // 如果后端不返回 disputeCountThisMonth，前端从 rejectionHistory 计算
  // 使用当前月份过滤
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const cardHistory = rejectionHistory.value
  if (cardHistory.length === 0) return 0
  return cardHistory.filter(item => {
    const d = new Date(item.time)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length
}

function jumpToRejectionImage() {
  showRejectionHistory.value = false
  if (rejectionHistoryImageId.value) {
    const images = currentUnitImages.value
    const target = images.find((i: ImageMedia) => i.id === rejectionHistoryImageId.value)
    if (target) {
      selectImage(target)
    }
  }
}

// UX-11: 快速流转工具栏状态保持
function saveToolState() {
  sessionToolState.value = {
    tool: annotationStore.activeTool,
    color: annotationStore.activeColor,
    penWidth: annotationStore.activeWidth as number,
    arrowWidth: annotationStore.activeWidth as number,
  }
}

function restoreToolState() {
  if (sessionToolState.value) {
    annotationStore.setTool(sessionToolState.value.tool as any)
    annotationStore.setColor(sessionToolState.value.color as any)
    annotationStore.setWidth(sessionToolState.value.penWidth as any)
  }
}

// UX-13: 标注草稿自动保存
function saveDraft() {
  try {
    const draft = {
      annotations: annotationStore.annotations,
      projectId: projectId.value,
      imageId: currentImageId.value,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(draftKey.value, JSON.stringify(draft))
  } catch (e) { /* ignore quota errors */ }
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(draftKey.value)
    if (!raw) return false
    const draft = JSON.parse(raw)
    if (draft.projectId === projectId.value && draft.imageId === currentImageId.value && draft.annotations.length > 0) {
      annotationStore.annotations.splice(0, annotationStore.annotations.length, ...draft.annotations)
      showToast('已恢复未保存的标注', 'success')
      return true
    }
  } catch (e) { /* ignore */ }
  return false
}

function clearDraft() {
  sessionStorage.removeItem(draftKey.value)
}

// UX-15: @ 提及
function handleDiscussionInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  const value = target.value
  const cursorPos = target.selectionStart || 0

  const textBeforeCursor = value.slice(0, cursorPos)
  const lastAtPos = textBeforeCursor.lastIndexOf('@')

  if (lastAtPos !== -1 && (lastAtPos === 0 || textBeforeCursor[lastAtPos - 1] === ' ')) {
    mentionQuery.value = textBeforeCursor.slice(lastAtPos + 1)
    showMentionList.value = true
  } else {
    showMentionList.value = false
  }
}

function insertMention(member: { id: string; name: string }) {
  const textarea = document.querySelector('.discussion-input') as HTMLTextAreaElement
  if (!textarea) return
  const value = textarea.value
  const cursorPos = textarea.selectionStart || 0
  const textBeforeCursor = value.slice(0, cursorPos)
  const lastAtPos = textBeforeCursor.lastIndexOf('@')
  const before = value.slice(0, lastAtPos)
  const after = value.slice(cursorPos)
  textarea.value = `${before}@${member.name} ${after}`
  discussionText.value = textarea.value
  showMentionList.value = false
  textarea.focus()
}

const filteredMembers = computed(() => {
  if (!mentionQuery.value) return projectMembers.value
  return projectMembers.value.filter(m => m.name.includes(mentionQuery.value))
})

// UX-19: 修改前后对比
function openComparison() {
  const img = currentImage.value as any
  // Get the original image URL from the current image
  const originalUrl = img?.original_url || img?.originalUrl || ''
  // Get the processed image URL from the resolved comment card
  const resolvedCard = annotationStore.commentCards.find((c: any) => c.status === 'resolved')
  const processedUrl = (resolvedCard as any)?.processedImageUrl || ''
  
  compareOriginalUrl.value = originalUrl
  compareProcessedUrl.value = processedUrl
  showComparison.value = true
}

const currentImageId = computed(() => currentImage.value?.id || '')

watch(projectId, (id) => {
  if (id) {
    loadProject()
  }
}, { immediate: true })

watch(showAddUnit, (val) => {
  if (val) {
    newUnitName.value = '新产品单元'
    setTimeout(() => addUnitInputRef.value?.focus(), 50)
  }
})

watch(currentImageIndex, () => {
  preloadNextImages()
})

onMounted(() => {
  document.addEventListener('click', handleDownloadClickOutside)
  document.addEventListener('keydown', handleKeydown)
  // UX-13: 启动草稿自动保存和恢复
  draftTimer = setInterval(saveDraft, 3000)
  loadDraft()
  // V1.19: 加载支出记录
  loadExpenses()
})

onUnmounted(() => {
  document.removeEventListener('click', handleDownloadClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  stopDeliveryTaskPolling()
  // UX-13: 清除草稿定时器
  if (draftTimer) {
    clearInterval(draftTimer)
    draftTimer = null
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.project-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-topbar {
  height: 48px;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

// NAV-02: 面包屑导航
.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-sm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breadcrumb-link {
  color: $color-primary;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.breadcrumb-sep {
  color: $color-text-muted;
  flex-shrink: 0;
}

.breadcrumb-current {
  color: $color-text;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

  .btn-back {
    font-size: 13px;
    color: $color-text-secondary;
    padding: 4px 8px;
    border-radius: $radius-sm;
    white-space: nowrap;

    &:hover {
      background: $color-surface-hover;
    }
  }

.project-name {
  font-size: 15px;
  font-weight: 600;
  color: $color-text;
  white-space: nowrap;
}

.status-badge {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  color: #fff;
  white-space: nowrap;

  &.status--draft { background: $color-text-muted; }
  &.status--review { background: $color-warning; color: #5f4b00; }
  &.status--in_progress { background: $color-primary; }
  &.status--final_review { background: #ff8c00; }
  &.status--completed { background: $color-success; }
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-toolbar {
  padding: 5px 10px;
  font-size: 12px;
  color: $color-text-secondary;
  border-radius: $radius-sm;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.btn-toolbar--primary {
    color: $color-primary;
    font-weight: 500;
    &:hover { background: rgba($color-primary, 0.08); }
  }

  &.btn-toolbar--delivery {
    color: $color-success;
    font-weight: 500;
    &:hover:not(:disabled) {
      background: rgba($color-success, 0.08);
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  // UX-41: 提交确认开关高亮
  &.btn-toolbar--active {
    color: $color-primary;
    background: rgba($color-primary, 0.08);
    font-weight: 500;
  }
}

// DS-03: 下载 Split Button
.download-split-wrap {
  display: flex;
  align-items: center;
  position: relative;

  .btn-toolbar--download {
    border-radius: $radius-sm 0 0 $radius-sm;
    &:hover { background: rgba($color-primary, 0.08); color: $color-primary; }
  }

  .btn-toolbar--download-caret {
    padding: 5px 6px;
    border-radius: 0 $radius-sm $radius-sm 0;
    border-left: 1px solid $color-border;
    font-size: 10px;
    color: $color-text-muted;
    &:hover {
      background: $color-surface-hover;
      color: $color-text;
    }
  }
}

// DS-03: 工具菜单
.tools-menu-wrap {
  position: relative;
}

.tools-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  min-width: 140px;
  z-index: 100;
  padding: 4px;
}

.tools-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: $color-text;
  border-radius: $radius-sm;
  transition: background 0.15s;
  text-align: left;

  &:hover {
    background: $color-surface-hover;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// DS-03: 更多菜单
.more-menu-wrap {
  position: relative;
}

.more-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  min-width: 160px;
  z-index: 100;
  padding: 4px;
}

.more-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: $color-text;
  border-radius: $radius-sm;
  transition: background 0.15s;
  text-align: left;

  &:hover {
    background: $color-surface-hover;
  }
}

.more-group-label {
  font-size: 11px;
  font-weight: 600;
  color: $color-text-muted;
  text-transform: uppercase;
  padding: 4px 12px 2px;
  display: block;
}

.more-divider {
  height: 1px;
  background: $color-border-light;
  margin: 4px 8px;
}

// FB-014: 更多菜单中的切换开关
.more-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  gap: 8px;
}

.more-toggle-label {
  font-size: 12px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  gap: 6px;

  input {
    display: none;
  }
}

.toggle-slider {
  width: 36px;
  height: 18px;
  background: $color-border;
  border-radius: 9px;
  position: relative;
  transition: background 0.2s;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle-switch input:checked + & {
    background: $color-success;

    &::after {
      transform: translateX(18px);
    }
  }
}

.toggle-text {
  font-size: 11px;
  color: $color-text-muted;
  font-weight: 500;
}

// FB-014: 简化巡检报告面板
.simplified-report-modal {
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.simplified-report-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.simplified-report-body {
  padding: 16px;
}

.simplified-report-loading {
  text-align: center;
  padding: 32px;
  color: $color-text-secondary;
  font-size: 14px;
}

.simplified-report-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.simplified-report-summary {
  padding: 12px 16px;
  background: $color-surface-hover;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  line-height: 1.6;
  border-left: 3px solid $color-primary;
}

.simplified-report-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.simplified-report-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: $color-surface;
  border-radius: $radius-sm;
  border: 1px solid $color-border-light;
  font-size: 13px;
  color: $color-text;
  line-height: 1.5;
}

.simplified-report-item-idx {
  color: $color-text-muted;
  font-weight: 600;
  flex-shrink: 0;
}

.simplified-report-item-text {
  flex: 1;
}

.simplified-report-severity {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;

  &.severity-high {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-danger, #ef4444);
  }

  &.severity-medium {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning, #f59e0b);
  }

  &.severity-low {
    background: rgba(34, 197, 94, 0.15);
    color: $color-success;
  }
}

.simplified-report-empty {
  text-align: center;
  padding: 32px;
  color: $color-text-muted;
  font-size: 14px;
}

.detail-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 14px;
  background: #1a1a2e;
}

.skeleton-detail {
  display: flex;
  height: 100%;
  gap: 0;
}

.skeleton-viewer {
  flex: 1;
  background: #f5f5f5;
  border-radius: 4px;
  margin: 8px;
}

.skeleton-toolbar {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-left: 1px solid #e0e0e0;
  border-right: 1px solid #e0e0e0;
}

.skeleton-tool-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
}

.skeleton-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.skeleton-card {
  width: 100%;
  height: 100px;
  border-radius: 4px;
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;
  background: #1a1a2e;

  p {
    font-size: 15px;
    color: $color-error;
  }

  .btn-retry {
    padding: 8px 20px;
    background: $color-primary;
    color: #fff;
    font-size: 14px;
    border-radius: $radius-md;
    transition: background 0.2s;

    &:hover {
      background: $color-primary-dark;
    }
  }
}

.viewer-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  overflow: hidden;
}

.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-placeholder {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);

  .viewer-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
  }

  p {
    font-size: 18px;
    font-weight: 500;
  }

  .viewer-hint {
    font-size: 13px;
    margin-top: 8px;
    opacity: 0.7;
  }
}

.annotation-toolbar {
  width: 56px;
  background: $color-surface;
  border-left: 1px solid $color-border;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 6px;
  flex-shrink: 0;
  overflow-y: auto;
}

.tool-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

// DS-04: 标注工具栏视觉优化
.tool-btn {
  width: auto;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $color-text-secondary;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;

  .tool-icon {
    font-size: 14px;
  }

  .tool-icon-svg {
    flex-shrink: 0;
  }

  .tool-label {
    font-size: 11px;
  }

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
  }
}

.color-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

// DS-04: 颜色选择器增大+选中环
.color-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid $color-border;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  // DS-15: 触摸热区 44px
  padding: 12px;
  margin: -12px;
  background-clip: content-box;
  box-sizing: content-box;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    width: 28px;
    height: 28px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px $color-primary;
    transform: scale(1);
  }
}

.width-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

// DS-04: 画笔宽度可视化
.width-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: $color-text-secondary;
  padding: 4px 6px;
  border-radius: $radius-sm;
  transition: background 0.15s, color 0.15s;
  min-width: 36px;

  .width-preview-line {
    display: block;
    width: 24px;
    border-radius: 1px;
    background: $color-text-secondary;
    transition: background 0.15s;
  }

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 600;

    .width-preview-line {
      background: $color-primary;
    }
  }
}

.divider-h {
  width: 28px;
  height: 1px;
  background: $color-border-light;
  margin: 4px 0;
}

.comment-panel {
  width: $comment-panel-width;
  background: $color-surface;
  border-left: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.unit-tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid $color-border-light;
  padding: 6px 8px;
  gap: 4px;
  flex-shrink: 0;
}

.unit-tabs-scroll {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    height: 3px;
  }
}

.unit-tab {
  padding: 5px 12px;
  font-size: 12px;
  color: $color-text-secondary;
  border-radius: 20px;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 500;
  }
}

.btn-add-unit {
  width: 28px;
  height: 28px;
  font-size: 16px;
  color: $color-text-muted;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }
}

.add-unit-form {
  display: flex;
  gap: 6px;
  padding: 8px 0;

  .form-input--sm {
    flex: 1;
    height: 30px;
    padding: 0 8px;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    font-size: 13px;
    outline: none;

    &:focus {
      border-color: $color-primary;
    }
  }

  .btn-confirm {
    padding: 4px 12px;
    background: $color-primary;
    color: #fff;
    font-size: 13px;
    border-radius: $radius-sm;

    &:disabled {
      opacity: 0.5;
    }
  }

  .btn-cancel {
    padding: 4px 8px;
    font-size: 13px;
    color: $color-text-muted;
    border-radius: $radius-sm;

    &:hover {
      color: $color-text;
    }
  }
}

.thumbnail-strip {
  display: flex;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  flex-shrink: 0;
  border-bottom: 1px solid $color-border-light;

  &::-webkit-scrollbar {
    height: 3px;
  }
}

.thumbnail-item {
  width: 48px;
  height: 36px;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 2px solid transparent;
  flex-shrink: 0;
  padding: 0;
  transition: border-color 0.15s;

  &:hover {
    border-color: $color-border;
  }

  &.active {
    border-color: $color-primary;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  background: $color-border-light;
}

.thumbnail-empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 12px;
  color: $color-text-muted;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.comment-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.comment-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: $radius-md;
  border: 1px solid $color-border-light;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: $color-border;
  }

  &.focused {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba($color-primary, 0.15);
  }
}

.card-drag-handle {
  cursor: grab;
  color: $color-text-muted;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
  &:hover { color: $color-text-secondary; }
  &:active { cursor: grabbing; }
}

.comment-card:hover .card-drag-handle {
  opacity: 1;
}

.card-number {
  font-size: 13px;
  font-weight: 600;
  color: $color-text-muted;
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

.card-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-border-light;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.card-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: $color-border-light;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-text {
  font-size: 13px;
  color: $color-text;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-unresolved {
    background: $color-error;
  }

  &.dot-resolved {
    background: $color-success;
  }
}

.comment-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $color-text-muted;
}

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: $radius-md;
  font-size: 14px;
  z-index: 2000;
  animation: fadeIn 0.3s ease;

  &--success {
    background: $color-success;
    color: #fff;
  }

  &--error {
    background: $color-error;
    color: #fff;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

// ============ 4.2: 缩略图编号角标 ============

.thumbnail-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  font-weight: 500;
  pointer-events: none;
}

// ============ 4.8: 意见卡片最后编辑信息 ============

.card-edited-info {
  font-size: 11px;
  color: $color-text-muted;
  margin-top: 4px;
  line-height: 1.3;
}

// ============ 4.9: 右键上下文菜单 ============

.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 4px;
  border-radius: $radius-md;
  background: $color-surface;
  box-shadow: $shadow-lg;
  border: 1px solid $color-border;
}

.context-menu-item {
  padding: 8px 12px;
  font-size: 13px;
  color: $color-text;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
  }
}

// ============ 4.9: 跨图同步模态框 ============

.sync-modal-body {
  .sync-modal-hint {
    font-size: 13px;
    color: $color-text-secondary;
    margin-bottom: 12px;
  }
}

.sync-image-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.sync-image-item {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &.selected {
    border-color: $color-primary;
  }

  &:hover {
    border-color: $color-border;
  }
}

.sync-image-placeholder {
  width: 100%;
  height: 100%;
  background: $color-border-light;
}

.sync-check-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

// ============ 4.10: 抽查 ============

.review-modal-body {
  text-align: center;
}

.review-progress {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 16px;
}

.review-card-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.review-card-img {
  width: 200px;
  height: 150px;
  object-fit: cover;
  border-radius: $radius-md;
  border: 1px solid $color-border;
}

.review-card-text {
  font-size: 14px;
  color: $color-text;
  line-height: 1.5;
  max-width: 100%;
}

.review-empty {
  font-size: 14px;
  color: $color-text-muted;
  padding: 40px 0;
}

.btn-approve {
  padding: 8px 20px;
  border-radius: $radius-sm;
  background: $color-success;
  color: #fff;
  font-size: 14px;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-reject {
  padding: 8px 20px;
  border-radius: $radius-sm;
  background: $color-error;
  color: #fff;
  font-size: 14px;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

// ============ 4.11: 最近操作 ============

.recent-actions-body {
  max-height: 400px;
  overflow-y: auto;
}

.recent-empty {
  font-size: 14px;
  color: $color-text-muted;
  text-align: center;
  padding: 40px 0;
}

.recent-action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: none;
  }
}

.recent-action-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.recent-action-desc {
  font-size: 13px;
  color: $color-text;
}

.recent-action-time {
  font-size: 11px;
  color: $color-text-muted;
}

.btn-undo {
  padding: 4px 12px;
  border-radius: $radius-sm;
  background: rgba($color-primary, 0.1);
  color: $color-primary;
  font-size: 12px;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: rgba($color-primary, 0.2);
  }
}

// ============ 4.14: 讨论区 ============

.discussion-area {
  border-top: 1px solid $color-border;
  padding: 8px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 200px;
}

.discussion-header {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-secondary;
  margin-bottom: 6px;
}

.discussion-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.discussion-item {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid rgba($color-border-light, 0.5);

  &:last-child {
    border-bottom: none;
  }
}

.discussion-user {
  font-weight: 600;
  color: $color-primary;
  white-space: nowrap;
}

.discussion-text {
  color: $color-text;
  flex: 1;
  min-width: 0;
}

.discussion-time {
  font-size: 10px;
  color: $color-text-muted;
  white-space: nowrap;
}

.discussion-empty {
  font-size: 12px;
  color: $color-text-muted;
  text-align: center;
  padding: 8px 0;
}

.discussion-input-row {
  display: flex;
  gap: 4px;
}

.discussion-input {
  flex: 1;
  padding: 4px 8px;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
  font-size: 12px;
  outline: none;
  background: $color-bg;
  color: $color-text;

  &:focus {
    border-color: $color-primary;
  }
}

.discussion-send-btn {
  padding: 4px 10px;
  border-radius: $radius-sm;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: $radius-sm;
  background: $color-surface-hover;
  color: $color-text;
  font-size: 13px;
  transition: background 0.15s;

  &:hover {
    background: $color-border-light;
  }
}

.btn-confirm {
  padding: 8px 20px;
  border-radius: $radius-sm;
  background: $color-primary;
  color: #fff;
  font-size: 13px;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

// F-53: 下载格式选择
.download-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  z-index: 100;
  min-width: 200px;
  padding: 4px;
  animation: fadeIn 0.15s ease;
}

.download-option {
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  color: $color-text;
  text-align: left;
  border-radius: $radius-sm;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
  }
}

// F-53: 自定义尺寸弹窗
.custom-download-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-label {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.slider-input {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: $color-border-light;
  border-radius: 3px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: $color-primary;
    cursor: pointer;
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.15);
    }
  }
}

.slider-range {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: $color-text-muted;
}

// F-53: 异步打包进度
.delivery-task-body {
  text-align: center;
  padding: 16px 0;
}

.delivery-task-text {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 16px;
}

.delivery-task-progress-bar {
  height: 8px;
  background: $color-border-light;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.delivery-task-progress-fill {
  height: 100%;
  border-radius: 4px;
  background: $color-primary;
  transition: width 0.5s ease;
}

.delivery-task-percent {
  font-size: 13px;
  font-weight: 600;
  color: $color-text;
}

// ============ UX-10: 争议驳回历史 ============

.rejection-history-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rejection-history-panel {
  background: #fff;
  border-radius: 8px;
  width: 400px;
  max-height: 60vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.rejection-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  h3 { margin: 0; font-size: 16px; }
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
}

.rejection-history-list {
  padding: 16px 20px;
}

.rejection-history-item {
  padding: 12px;
  background: #fef7e0;
  border-radius: 6px;
  border-left: 3px solid #f9ab00;
  margin-bottom: 8px;

  &:last-child { margin-bottom: 0; }
}

.rejection-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rejection-loading, .rejection-empty {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  color: #999;
}

.rejection-time {
  font-size: 12px;
  color: #999;
}

.rejection-by {
  font-size: 12px;
  color: #666;
  margin-left: 8px;
}

.rejection-reason {
  margin: 8px 0 0;
  font-size: 13px;
  color: #333;
}

.rejection-history-footer {
  padding: 12px 20px;
  border-top: 1px solid #e0e0e0;
  text-align: right;
}

.btn-jump {
  padding: 6px 16px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.card-dispute-badge {
  cursor: pointer;
  font-size: 11px;
  color: #f9ab00;
  font-weight: 500;
  &:hover { text-decoration: underline; }
  // UX-42: 本月超过3次橙色预警
  &.dispute-warning {
    color: #e37400;
    font-weight: 600;
  }
}

// ============ DATA-04: 操作日志 ============

.operation-logs-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.operation-logs-panel {
  background: #fff;
  border-radius: 8px;
  width: 500px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.operation-logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  h3 { margin: 0; font-size: 16px; }
}

.operation-logs-filters {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.log-filter-btn {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #1a73e8; color: #1a73e8; }
  &.active {
    background: rgba(26,115,232,0.08);
    border-color: #1a73e8;
    color: #1a73e8;
    font-weight: 500;
  }
}

.operation-logs-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 20px;
}

.logs-loading, .logs-empty {
  text-align: center;
  padding: 40px 0;
  font-size: 13px;
  color: #999;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;

  &:last-child { border-bottom: none; }

  .log-icon { flex-shrink: 0; }
  .log-info { flex: 1; min-width: 0; }
  .log-action { font-weight: 500; color: #333; }
  .log-user { font-size: 11px; color: #999; }
  .log-detail { font-size: 12px; color: #666; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-time { font-size: 11px; color: #aaa; white-space: nowrap; flex-shrink: 0; }

  &.log--resolve_card .log-icon { color: #34a853; }
  &.log--dispute_card .log-icon { color: #ea4335; }
  &.log--create_card .log-icon { color: #1a73e8; }
  &.log--complete_project .log-icon { color: #1a73e8; }
}

// ============ UX-15: @ 提及 ============

.mention-list {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  width: 200px;
  z-index: 10;
}

.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  &:hover, &.active { background: #f0f7ff; }
}

.mention-name { font-size: 13px; font-weight: 500; }
.mention-role { font-size: 11px; color: #999; }

// ============ UX-19: 修改前后对比 ============

.btn-compare {
  padding: 4px 10px;
  font-size: 11px;
  color: $color-primary;
  border: 1px solid $color-primary;
  border-radius: $radius-sm;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: $color-primary;
    color: #fff;
  }
}

// FB-021: 版本对比按钮
.btn-version-compare {
  padding: 4px 10px;
  font-size: 11px;
  color: $color-warning;
  border: 1px solid $color-warning;
  border-radius: $radius-sm;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: $color-warning;
    color: #fff;
  }
}

// UX-41: 提交并下一张按钮
.btn-submit-next {
  padding: 4px 8px;
  font-size: 11px;
  color: $color-success;
  border: 1px solid $color-success;
  border-radius: $radius-sm;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: $color-success;
    color: #fff;
  }
}

// UX-41: 提交确认弹窗
.submit-confirm-checkbox {
  margin-bottom: 16px;
  text-align: left;
}

.checkbox-label {
  font-size: 13px;
  color: $color-text-secondary;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  input { cursor: pointer; }
}

// UX-41: 确认弹窗 overlay
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 8px;
  padding: 32px 28px;
  width: 360px;
  text-align: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.modal-text {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.comparison-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comparison-modal {
  background: #fff;
  border-radius: 8px;
  width: 90vw;
  max-width: 1000px;
  max-height: 80vh;
  overflow: auto;
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  h3 { margin: 0; }
}

.comparison-body {
  display: flex;
  padding: 20px;
  gap: 0;
}

.comparison-side {
  flex: 1;
  text-align: center;
  img { max-width: 100%; max-height: 60vh; object-fit: contain; }
}

.comparison-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
}
.comparison-unavailable {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
  font-size: 14px;
  background: #f5f5f5;
  border-radius: 8px;
}

.comparison-divider {
  width: 2px;
  background: #e0e0e0;
  margin: 0 16px;
}

// UX-35: 交付清单弹窗
.delivery-checklist-modal {
  max-width: 700px;
}

.delivery-checklist-body {
  padding: 20px;
}

.delivery-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #666;
}

.delivery-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
    text-align: left;
  }

  th {
    background: #fafbfc;
    font-weight: 600;
    color: #333;
    font-size: 12px;
  }

  .td-name {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .td-center {
    text-align: center;
  }
}

.checklist-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;

  &.status-resolved {
    background: #e6f4ea;
    color: #137333;
  }

  &.status-pending {
    background: #fef7e0;
    color: #e37400;
  }
}

.delivery-empty {
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
  color: #999;
}

// V1.19: 支出记录
.expense-modal {
  width: 600px;
  max-height: 80vh;
}
.expense-modal-body {
  padding: 16px;
  overflow-y: auto;
}
.expense-add-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.expense-category { width: 130px; }
.expense-amount { width: 100px; }
.expense-date { width: 140px; }
.expense-note { flex: 1; min-width: 120px; }
.expense-list {
  max-height: 300px;
  overflow-y: auto;
}
.expense-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}
.expense-cat { width: 90px; color: #666; }
.expense-amt { width: 90px; font-weight: 600; }
.expense-date { width: 100px; color: #999; }
.expense-note-text { flex: 1; color: #888; font-size: 12px; }
.expense-empty { text-align: center; color: #999; padding: 24px; }
.expense-total {
  text-align: right;
  padding: 12px 0;
  font-size: 15px;
  border-top: 2px solid #333;
  margin-top: 8px;
}
.btn-primary { background: $color-primary; color: #fff; border: none; border-radius: 4px; cursor: pointer; &:disabled { opacity: 0.5; } }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-icon-danger { background: none; border: none; color: #c62828; font-size: 18px; cursor: pointer; padding: 0 4px; &:hover { opacity: 0.7; } }
.profit-badge {
  margin-left: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}
.profit-positive { background: #e8f5e9; color: #2e7d32; }
.profit-negative { background: #ffebee; color: #c62828; }

// V1.19: 交付包选项
.delivery-options {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.delivery-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 13px;
}
.delivery-option-desc {
  color: #999;
  font-size: 12px;
}
.delivery-option-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #eee;
}
.delivery-option-save {
  font-size: 12px;
  color: #666;
  cursor: pointer;
}
.delivery-estimate {
  font-size: 12px;
  color: #999;
}

// ===== FB-002: 意见汇总面板 =====
.comments-summary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.comments-summary-panel {
  width: 420px;
  max-width: 90vw;
  height: 100vh;
  background: #fff;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.comments-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
}
.comments-summary-filters {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
}
.summary-filter-btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  &.active {
    background: #4a6cf7;
    color: #fff;
    border-color: #4a6cf7;
  }
}
.comments-summary-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.summary-loading,
.summary-empty {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}
.summary-group {
  margin-bottom: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}
.summary-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}
.summary-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}
.summary-thumb-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: #e8e8e8;
}
.summary-image-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.summary-group-count {
  font-size: 12px;
  color: #999;
}
.summary-items {
  padding: 8px 14px;
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed #f0f0f0;
  font-size: 12px;
  &:last-child {
    border-bottom: none;
  }
}
.summary-type-badge {
  padding: 2px 6px;
  background: #e8f0fe;
  color: #4a6cf7;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
}
.summary-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333;
}
.summary-status-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
  &.summary-resolved {
    background: #e6f7e6;
    color: #52c41a;
  }
  &.summary-unresolved {
    background: #fff3e0;
    color: #fa8c16;
  }
}
.summary-assignee {
  color: #999;
  font-size: 11px;
  white-space: nowrap;
}
.summary-date {
  color: #bbb;
  font-size: 11px;
  white-space: nowrap;
}

// ===== FB-008: 批量创建产品单元 =====
.batch-unit-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.batch-unit-hint {
  font-size: 13px;
  color: #666;
  margin: 0;
}
.batch-unit-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}
.batch-unit-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.batch-unit-image-item {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  &.selected {
    border-color: #4a6cf7;
  }
}
.batch-unit-img-placeholder {
  width: 100%;
  height: 100%;
  background: #e8e8e8;
}
.batch-unit-check-mark {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  background: #4a6cf7;
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.batch-unit-no-unassigned {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 20px;
}
.batch-unit-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-unit-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.batch-unit-name-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}
.batch-unit-row-count {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}
.btn-add-row {
  padding: 6px 12px;
  border: 1px dashed #ccc;
  border-radius: 6px;
  background: #fafafa;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
  &:hover {
    border-color: #4a6cf7;
    color: #4a6cf7;
  }
}

// ===== FB-010: 产品单元创建向导 =====
.btn-wizard-units {
  padding: 4px 10px;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  border-radius: $radius-sm;
  transition: background 0.2s;
  &:hover {
    background: $color-primary-dark;
  }
}

.wizard-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  gap: 0;
  border-bottom: 1px solid $color-border-light;
}

.wizard-progress-step {
  display: flex;
  align-items: center;
  gap: 0;

  .wizard-step-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    background: $color-border;
    color: $color-text-muted;
    flex-shrink: 0;
    transition: all 0.3s;
  }

  .wizard-step-label {
    font-size: 12px;
    color: $color-text-muted;
    margin-left: 8px;
    white-space: nowrap;
    transition: color 0.3s;
  }

  .wizard-step-line {
    width: 60px;
    height: 2px;
    background: $color-border;
    margin: 0 12px;
    transition: background 0.3s;
  }

  &.active {
    .wizard-step-dot {
      background: $color-primary;
      color: #fff;
    }
    .wizard-step-label {
      color: $color-primary;
      font-weight: 600;
    }
  }

  &.completed {
    .wizard-step-dot {
      background: $color-success;
      color: #fff;
    }
    .wizard-step-label {
      color: $color-success;
    }
    .wizard-step-line {
      background: $color-success;
    }
  }
}

.wizard-step-body {
  padding: 16px 24px;
  min-height: 200px;
  max-height: 50vh;
  overflow-y: auto;
}

.wizard-hint {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 12px;
}

.wizard-empty {
  text-align: center;
  padding: 32px;
  color: $color-text-muted;
  font-size: 14px;
}

.wizard-upload-row {
  margin-bottom: 12px;
}

.btn-wizard-upload {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: $color-surface-hover;
  border: 1px dashed $color-border;
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-primary;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    border-color: $color-primary;
    background: rgba($color-primary, 0.05);
  }
}

.wizard-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.wizard-image-item {
  position: relative;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  aspect-ratio: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.selected {
    border-color: $color-primary;
  }

  &:hover {
    border-color: $color-primary-light;
  }
}

.wizard-img-placeholder {
  width: 100%;
  height: 100%;
  background: $color-surface-hover;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wizard-img-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wizard-check-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: $color-primary;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.wizard-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.wizard-group {
  border: 1px solid $color-border;
  border-radius: $radius-md;
  overflow: hidden;
}

.wizard-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: $color-surface-hover;
  border-bottom: 1px solid $color-border-light;
}

.wizard-group-name-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid $color-border;
  border-radius: 4px;
  font-size: 13px;
}

.wizard-group-count {
  font-size: 12px;
  color: $color-text-muted;
  white-space: nowrap;
}

.wizard-group-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  min-height: 60px;
}

.wizard-group-drop-hint {
  width: 100%;
  text-align: center;
  color: $color-text-muted;
  font-size: 12px;
  padding: 16px;
  border: 1px dashed $color-border;
  border-radius: 4px;
}

.wizard-group-image {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 4px;
  overflow: hidden;
  cursor: grab;
  border: 1px solid $color-border-light;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:active {
    cursor: grabbing;
  }
}

.wizard-img-placeholder-sm {
  width: 100%;
  height: 100%;
  background: $color-surface-hover;
}

.wizard-group-img-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.wizard-group-image:hover .wizard-group-img-remove {
  opacity: 1;
}

.btn-add-group {
  padding: 8px 16px;
  border: 1px dashed $color-border;
  border-radius: $radius-md;
  background: $color-surface-hover;
  cursor: pointer;
  font-size: 13px;
  color: $color-text-secondary;
  transition: all 0.2s;
  &:hover {
    border-color: $color-primary;
    color: $color-primary;
  }
}

.wizard-unassigned-pool {
  margin-top: 12px;
  padding: 8px;
  background: $color-surface-hover;
  border-radius: $radius-md;
  border: 1px solid $color-border-light;
}

.wizard-pool-label {
  font-size: 12px;
  color: $color-text-muted;
  margin-bottom: 8px;
  font-weight: 500;
}

.wizard-pool-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wizard-pool-image {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  cursor: grab;
  border: 1px solid $color-border-light;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  &:active {
    cursor: grabbing;
  }
}

.wizard-review-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wizard-review-group {
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  overflow: hidden;
}

.wizard-review-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: $color-surface-hover;
  border-bottom: 1px solid $color-border-light;
  font-size: 13px;
  color: $color-text;
}

.wizard-review-images {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
}

.wizard-review-image {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid $color-border-light;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.wizard-footer-right {
  display: flex;
  gap: 8px;
}

// ===== FB-022: 讨论已读状态 + 提醒 =====
.discussion-read-status {
  font-size: 11px;
  color: #52c41a;
  white-space: nowrap;
  &.discussion-unread {
    color: #ccc;
  }
}
.btn-nudge-discussion {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  padding: 2px;
  border-radius: 3px;
  transition: color 0.2s;
  &:hover {
    color: #4a6cf7;
  }
}

// ===== FB-003: 移动端按钮热区优化 =====
@media (max-width: 768px) {
  .btn-toolbar,
  .btn-apply-style,
  .btn-ai-suggest,
  .btn-ai-style,
  .btn-lock-annotation,
  .btn-delivery,
  .btn-batch-units,
  .btn-add-unit,
  .btn-confirm,
  .btn-cancel,
  .btn-submit,
  .btn-save,
  .btn-icon-danger,
  .btn-add-row,
  .btn-nudge-discussion,
  .summary-filter-btn {
    min-height: 44px;
    min-width: 44px;
    font-size: 16px;
    padding: 12px;
  }
  .discussion-item {
    flex-wrap: wrap;
  }
}
</style>