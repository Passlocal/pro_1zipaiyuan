<template>
  <div class="project-detail">
    <!-- 顶部工具栏 -->
    <div class="detail-topbar">
      <div class="topbar-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="project-name">{{ projectStore.currentProject?.name || projectStore.currentProject?.clientName || '项目详情' }}</h1>
        <span
          v-if="projectStore.currentProject"
          class="status-badge"
          :class="'status--' + projectStore.currentProject.status"
        >
          {{ statusLabel(projectStore.currentProject.status) }}
        </span>
      </div>
      <div class="topbar-right">
        <button class="btn-toolbar" title="抽查" @click="openReviewModal">
          <span>🔍</span> 抽查
        </button>
        <button class="btn-toolbar" title="最近操作" @click="openRecentActions">
          <span>📋</span> 最近操作
        </button>
        <button class="btn-toolbar" title="分享" @click="handleShare">
          <span>🔗</span> 分享
        </button>
        <button class="btn-toolbar" title="色差巡检" @click="router.push(`/project/${projectId}/color-check`)">
          <span>✨</span> 色差巡检
        </button>
        <button class="btn-toolbar" title="光影一致性巡检" @click="router.push(`/project/${projectId}/consistency-check`)">
          <span>💡</span> 光影巡检
        </button>
        <button class="btn-toolbar" title="导出意见" @click="handleExportComments">
          <span>📥</span> 导出意见
        </button>
        <button class="btn-toolbar" title="作品集" @click="router.push(`/project/${projectId}/portfolio`)">
          <span>📖</span> 作品集
        </button>
        <button class="btn-toolbar" title="时间轴" @click="router.push(`/project/${projectId}/timeline`)">
          <span>📅</span> 时间轴
        </button>
        <!-- 11.1 一键交付包下载 -->
        <button
          class="btn-toolbar btn-toolbar--delivery"
          title="打包下载交付包"
          :disabled="downloadingDelivery"
          @click="downloadDeliveryPackage"
        >
          <span>{{ downloadingDelivery ? '⏳' : '📦' }}</span>
          {{ downloadingDelivery ? '打包中...' : '交付包' }}
        </button>
        <button class="btn-toolbar" title="回收站" @click="router.push(`/project/${projectId}?tab=recycle`)">
          <span>🗑️</span> 回收站
        </button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="detail-body">
      <!-- 加载中 -->
      <div v-if="projectLoading" class="loading-state">
        <span class="loading-pulse">加载中...</span>
      </div>
      <!-- 加载失败 -->
      <div v-else-if="projectError" class="error-state">
        <span>⚠️</span>
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
          :active-width="annotationStore.activeWidth"
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
            <span>{{ tool.icon }}</span>
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
            @click="annotationStore.setColor(c)"
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
            {{ w }}px
          </button>
        </div>
        <div class="divider-h"></div>
        <div class="tool-group">
          <button class="tool-btn" title="撤销" @click="annotationStore.undo()">
            <span>↩</span>
          </button>
          <button class="tool-btn" title="重做" @click="annotationStore.redo()">
            <span>↪</span>
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
            <div class="card-content">
              <p class="card-text">{{ card.text }}</p>
              <p v-if="card.lastEditedBy" class="card-edited-info">
                最后由{{ card.lastEditedBy }}编辑于{{ formatDate(card.lastEditedAt) }}
              </p>
            </div>
            <div class="card-status-dot"
              :class="card.status === 'resolved' ? 'dot-resolved' : 'dot-unresolved'"
              :title="card.status === 'resolved' ? '标记为未解决' : '标记为已解决'"
              @click.stop="toggleCardStatus(card)"
            ></div>
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
            </div>
          </div>
          <div v-else class="discussion-empty">暂无讨论</div>
          <div class="discussion-input-row">
            <input
              v-model="discussionText"
              class="discussion-input"
              placeholder="输入讨论内容，使用 @ 提及成员..."
              @keyup.enter="sendDiscussion"
            />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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

async function downloadDeliveryPackage() {
  downloadingDelivery.value = true
  try {
    const res = await client.get(`/v1/projects/${projectId.value}/delivery-package`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `delivery-${projectId.value}.zip`
    a.click()
    URL.revokeObjectURL(url)
    showToast('交付包下载已开始', 'success')
  } catch (e) {
    console.error('下载交付包失败:', e)
    showToast('下载失败，请稍后重试', 'error')
  } finally {
    downloadingDelivery.value = false
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

const tools: { type: AnnotationToolType; label: string; icon: string }[] = [
  { type: 'pen', label: '画笔', icon: '✏️' },
  { type: 'arrow', label: '箭头', icon: '➡️' },
  { type: 'rectangle', label: '矩形', icon: '⬜' },
  { type: 'ellipse', label: '椭圆', icon: '⭕' },
  { type: 'text', label: '文字', icon: '🔤' },
  { type: 'eraser', label: '橡皮擦', icon: '🧹' },
]

const colors: AnnotationColor[] = ['#FF0000', '#FFCC00', '#0066FF', '#FFFFFF']
const widths: (PenWidth | ArrowWidth)[] = [3, 5, 10]

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
  const images = currentUnitImages.value
  if (images.length === 0) return
  const cur = currentImage.value
  if (!cur) { selectImage(images[0]); return }
  const idx = images.findIndex((i: ImageMedia) => i.id === cur.id)
  const newIdx = (idx + direction + images.length) % images.length
  selectImage(images[newIdx])
}

function onAnnotationCreated(_annotation: Annotation) {
  // Annotation is already persisted in store.addAnnotation
  showToast('标注已添加', 'success')
}

function onAnnotationDeleted(_id: string) {
  // Annotation is already removed in store.removeAnnotation
  showToast('标注已删除', 'success')
}

async function handleShare() {
  try {
    const res = await projectApi.generateShare(projectId.value, '7days')
    const code = res.data.data?.shareCode || res.data.data?.code || ''
    const shareUrl = `${window.location.origin}/client/project/${code}`
    await navigator.clipboard.writeText(shareUrl)
    showToast('分享链接已复制到剪贴板', 'success')
  } catch (e) {
    console.error('分享失败:', e)
    showToast('分享失败，请稍后重试', 'error')
  }
}

async function handleExportComments() {
  try {
    const res = await annotationApi.exportComments(projectId.value)
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
    showToast('撤回成功', 'success')
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
  gap: 4px;
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
  width: 48px;
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

.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  font-size: 16px;
  color: $color-text-secondary;
  transition: background 0.15s, color 0.15s;

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
  gap: 4px;
}

.color-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid $color-border;
  transition: transform 0.15s, border-color 0.15s;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    border-color: $color-text;
    transform: scale(1.15);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
  }
}

.width-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.width-btn {
  font-size: 11px;
  color: $color-text-secondary;
  padding: 3px 6px;
  border-radius: $radius-sm;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 600;
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
</style>