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
        <button class="btn-toolbar" title="分享" @click="handleShare">
          <span>🔗</span> 分享
        </button>
        <button class="btn-toolbar" title="色差巡检" @click="router.push(`/project/${projectId}/color-check`)">
          <span>✨</span> 色差巡检
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
          @prev="navigateImage(-1)"
          @next="navigateImage(1)"
          @annotation-created="onAnnotationCreated"
          @annotation-deleted="onAnnotationDeleted"
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
            v-for="img in currentUnitImages"
            :key="img.id"
            class="thumbnail-item"
            :class="{ active: projectStore.currentImage?.id === img.id }"
            @click="selectImage(img)"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
            <div v-else class="thumb-placeholder"></div>
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
            @click="focusCard(card)"
          >
            <div class="card-number">#{{ index + 1 }}</div>
            <div class="card-thumbnail">
              <img v-if="card.thumbnailUrl" :src="card.thumbnailUrl" :alt="'card ' + (index + 1)" />
              <div v-else class="card-thumb-placeholder"></div>
            </div>
            <div class="card-content">
              <p class="card-text">{{ card.text }}</p>
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
      </aside>
      </template>
    </div>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast" :class="toastType === 'error' ? 'toast--error' : 'toast--success'">
      {{ toastMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useAnnotationStore } from '@/stores/annotation'
import { annotationApi } from '@/api/annotations'
import { projectApi } from '@/api/projects'
import ImageViewer from '@/components/viewer/ImageViewer.vue'
import type { ProjectStatus, AnnotationToolType, AnnotationColor, PenWidth, ArrowWidth, ImageMedia, CommentCard, Annotation } from '@/types/models'
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
</style>