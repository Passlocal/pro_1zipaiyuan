<template>
  <div class="client-project">
    <!-- 顶部标题栏 -->
    <header class="top-bar" v-if="project">
      <div class="top-left">
        <h1 class="project-name">{{ project.clientName || '项目' }}</h1>
        <span class="status-label">{{ statusLabel }}</span>
      </div>
      <div class="top-center">
        <div class="progress-area">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="progress-text">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="top-right" v-if="project.deadline">
        <span class="deadline-label">预计完成时间</span>
        <span class="deadline-date">{{ formatDate(project.deadline) }}</span>
      </div>
    </header>

    <!-- 主体区 -->
    <div class="main-area" v-if="project">
      <!-- 图片查看器 -->
      <div class="viewer-area">
        <div class="image-viewer" v-if="currentImageUrl">
          <img
            :src="currentImageUrl"
            alt="项目图片"
            class="viewer-image"
          />
          <div v-if="projectImages.length > 1" class="image-counter">
            {{ currentImageIndex + 1 }} / {{ projectImages.length }}
          </div>
          <button v-if="currentImageIndex > 0" class="nav-btn nav-prev" @click="currentImageIndex--">◀</button>
          <button v-if="currentImageIndex < projectImages.length - 1" class="nav-btn nav-next" @click="currentImageIndex++">▶</button>
        </div>
        <div v-else class="viewer-placeholder">
          <span class="viewer-icon">🖼️</span>
          <p>暂无图片</p>
        </div>
      </div>

      <!-- 底部面板：意见卡片 -->
      <aside class="bottom-panel">
        <div class="panel-header">
          <h2 class="panel-title">意见反馈</h2>
          <span class="card-count">{{ cards.length }} 条</span>
        </div>
        <div class="card-list" v-if="cards.length > 0">
          <div
            v-for="(card, idx) in cards"
            :key="card.id"
            class="comment-card"
          >
            <div class="card-header">
              <span class="card-index">#{{ idx + 1 }}</span>
              <img
                v-if="card.thumbnailUrl"
                :src="card.thumbnailUrl"
                class="card-thumb"
              />
              <div v-else class="card-thumb-placeholder"></div>
            </div>
            <div class="card-body">
              <p class="card-text">{{ card.text }}</p>
            </div>
            <div class="card-actions">
              <div class="card-reply-row">
                <textarea
                  v-model="cardReplies[card.id]"
                  class="card-reply-input"
                  placeholder="输入反馈文字..."
                  rows="2"
                ></textarea>
                <button
                  class="btn-reply-submit"
                  :disabled="!cardReplies[card.id]?.trim() || replySubmitting[card.id]"
                  @click="submitReply(card.id)"
                >
                  {{ replySubmitting[card.id] ? '...' : '发送' }}
                </button>
              </div>
              <div class="card-btns">
                <button
                  class="btn-card"
                  :class="{ active: cardStates[card.id] === 'confirmed' }"
                  @click="toggleCardState(card.id, 'confirmed')"
                >
                  确认
                </button>
                <button
                  class="btn-card btn-card--modify"
                  :class="{ active: cardStates[card.id] === 'modify' }"
                  @click="toggleCardState(card.id, 'modify')"
                >
                  继续修改
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="card-empty">
          <span>暂无意见卡片</span>
        </div>
      </aside>
    </div>

    <!-- 加载/错误 -->
    <div v-else-if="loading" class="loading-state">
      <span class="loading-pulse">加载中...</span>
    </div>
    <div v-else class="error-state">
      <p>项目不存在或链接已失效</p>
    </div>

    <!-- 底部确认栏 -->
    <div v-if="project && cards.length > 0" class="confirm-bar">
      <button
        class="btn-preview-confirm"
        :disabled="confirming"
        @click="showPreviewModal = true"
      >
        全部确稿
      </button>
    </div>

    <!-- 确稿前预览弹窗 -->
    <div v-if="showPreviewModal" class="modal-overlay" @click.self="showPreviewModal = false">
      <div class="modal-content preview-modal">
        <h3 class="modal-title">确稿确认</h3>
        <p class="modal-desc">请确认以下意见处理结果后点击「确认确稿」</p>

        <div class="preview-list">
          <div v-for="(card, idx) in cards" :key="card.id" class="preview-item">
            <span class="preview-index">#{{ idx + 1 }}</span>
            <span class="preview-text">{{ card.text }}</span>
            <span
              class="preview-state"
              :class="cardStates[card.id] === 'confirmed' ? 'state-confirmed' : 'state-modify'"
            >
              {{ cardStates[card.id] === 'confirmed' ? '已确认' : '待修改' }}
            </span>
          </div>
        </div>

        <p class="modal-warning" v-if="pendingCount > 0">
          还有 {{ pendingCount }} 条意见未标记确认
        </p>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showPreviewModal = false">返回修改</button>
          <button
            class="btn-confirm"
            :disabled="confirming"
            @click="confirmAll"
          >
            {{ confirming ? '提交中...' : '确认确稿' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 确稿成功弹窗 -->
    <div v-if="showCompleteModal" class="modal-overlay" @click.self="goToDownload">
      <div class="modal-content">
        <span class="modal-icon">🎉</span>
        <h3 class="modal-title">确稿成功</h3>
        <p class="modal-text">所有意见已确认，即将跳转到下载页面</p>
        <button class="btn-download" @click="goToDownload">前往下载</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectApi } from '@/api/projects'
import { useToast } from '@/composables/useToast'
import type { Project, CommentCard, ImageMedia, ProjectStatus } from '@/types/models'

const toast = useToast()

const route = useRoute()
const router = useRouter()

const shareToken = computed(() => route.params.shareToken as string)
const project = ref<Project | null>(null)
const cards = ref<CommentCard[]>([])
const projectImages = ref<ImageMedia[]>([])
const currentImageIndex = ref(0)
const loading = ref(true)
const confirming = ref(false)
const showCompleteModal = ref(false)
const showPreviewModal = ref(false)
const replySubmitting = ref<Record<string, boolean>>({})

const pendingCount = computed(() => {
  return cards.value.filter(c => cardStates.value[c.id] !== 'confirmed').length
})

const cardReplies = ref<Record<string, string>>({})
const cardStates = ref<Record<string, 'confirmed' | 'modify' | null>>({})

const statusLabelMap: Record<ProjectStatus, string> = {
  draft: '草稿',
  review: '待确认',
  in_progress: '修改中',
  final_review: '待确稿',
  completed: '已完成',
  archived: '已归档',
}

const statusLabel = computed(() => {
  if (!project.value) return ''
  return statusLabelMap[project.value.status] || project.value.status
})

const progressPercent = computed(() => {
  if (!project.value) return 0
  const map: Record<ProjectStatus, number> = {
    draft: 10,
    review: 30,
    in_progress: 55,
    final_review: 80,
    completed: 100,
    archived: 100,
  }
  return map[project.value.status] || 0
})

const currentImageUrl = computed(() => {
  if (projectImages.value.length > 0) {
    return projectImages.value[currentImageIndex.value]?.thumbnailUrl || projectImages.value[currentImageIndex.value]?.url || ''
  }
  return project.value?.thumbnailUrl || ''
})

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function toggleCardState(cardId: string, state: 'confirmed' | 'modify') {
  cardStates.value[cardId] = cardStates.value[cardId] === state ? null : state
  // Persist to sessionStorage so it survives refresh
  try {
    sessionStorage.setItem('client_card_states', JSON.stringify(cardStates.value))
  } catch { /* ignore */ }
}

async function submitReply(cardId: string) {
  const reply = cardReplies.value[cardId]
  if (!reply?.trim()) return
  replySubmitting.value[cardId] = true
  try {
    await projectApi.submitCardReply(cardId, reply.trim())
    cardReplies.value[cardId] = ''
    toast.success('回复已提交')
  } catch (e: any) {
    console.error('提交反馈失败:', e)
    toast.error('提交失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    replySubmitting.value[cardId] = false
  }
}

async function fetchProject() {
  loading.value = true
  try {
    const res = await projectApi.getByShareToken(shareToken.value)
    project.value = res.data.data.project
    cards.value = res.data.data.cards
    // Load project images
    if (res.data.data.images && res.data.data.images.length > 0) {
      projectImages.value = res.data.data.images
    }
  } catch (e: any) {
    console.error('获取项目失败:', e)
    project.value = null
  } finally {
    loading.value = false
  }
}

async function confirmAll() {
  showPreviewModal.value = false
  confirming.value = true
  try {
    if (project.value) {
      await projectApi.completeProject(project.value.id)
    }
    showCompleteModal.value = true
  } catch (e: any) {
    console.error('确稿失败:', e)
    toast.error('确稿失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    confirming.value = false
  }
}

function goToDownload() {
  showCompleteModal.value = false
  router.push(`/client/assets?token=${shareToken.value}`)
}

onMounted(() => {
  // Restore card states from sessionStorage
  try {
    const saved = sessionStorage.getItem('client_card_states')
    if (saved) cardStates.value = JSON.parse(saved)
  } catch { /* ignore */ }
  fetchProject()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.client-project {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $color-bg;
  overflow: hidden;
}

.top-bar {
  height: 56px;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  gap: 20px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .project-name {
    font-size: 16px;
    font-weight: 600;
    color: $color-text;
  }

  .status-label {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 500;
  }
}

.top-center {
  flex: 1;
  max-width: 300px;
}

.progress-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: $color-border-light;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: $color-primary;
  transition: width 0.4s ease;
}

.progress-text {
  font-size: 12px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;

  .deadline-label {
    color: $color-text-secondary;
  }

  .deadline-date {
    color: $color-text;
    font-weight: 500;
  }
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.image-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  position: relative;
}

.image-counter {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 13px;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover { background: rgba(0, 0, 0, 0.7); }
}

.nav-prev { left: 12px; }
.nav-next { right: 12px; }

.viewer-placeholder {
  text-align: center;
  color: rgba(255, 255, 255, 0.35);

  .viewer-icon {
    font-size: 56px;
    display: block;
    margin-bottom: 12px;
  }

  p {
    font-size: 16px;
  }
}

.viewer-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bottom-panel {
  height: 240px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.card-count {
  font-size: 12px;
  color: $color-text-muted;
}

.card-list {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  gap: 10px;
  padding: 12px 16px;
}

.comment-card {
  width: 220px;
  flex-shrink: 0;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: $color-bg;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-index {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-muted;
  width: 18px;
}

.card-thumb {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  object-fit: cover;
}

.card-thumb-placeholder {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  background: $color-border-light;
}

.card-body {
  flex: 1;
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

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-reply-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;

  .card-reply-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: 12px;
  color: $color-text;
  resize: none;
  outline: none;
  background: $color-surface;
  transition: border-color 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
  }
}

.btn-reply-submit {
  padding: 6px 12px;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  border-radius: $radius-sm;
  flex-shrink: 0;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.card-btns {
  display: flex;
  gap: 6px;
}

.btn-card {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  font-weight: 500;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
  color: $color-text-secondary;
  background: $color-surface;
  transition: all 0.15s;

  &:hover {
    background: $color-surface-hover;
  }

  &.active {
    background: rgba($color-success, 0.1);
    border-color: $color-success;
    color: $color-success;
  }

  &.btn-card--modify {
    &.active {
      background: rgba($color-warning, 0.1);
      border-color: $color-warning;
      color: #b06000;
    }
  }
}

.card-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $color-text-muted;
}

.loading-state, .error-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: $color-text-secondary;
}

.confirm-bar {
  height: 52px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-preview-confirm {
  padding: 10px 40px;
  background: $color-success;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2d9249;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// Preview modal
.preview-modal {
  width: 480px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-desc {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 16px;
}

.preview-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  max-height: 300px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: none;
  }
}

.preview-index {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-muted;
  min-width: 28px;
}

.preview-text {
  flex: 1;
  font-size: 13px;
  color: $color-text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-state {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;

  &.state-confirmed {
    background: rgba($color-success, 0.1);
    color: $color-success;
  }

  &.state-modify {
    background: rgba($color-warning, 0.1);
    color: #b06000;
  }
}

.modal-warning {
  font-size: 13px;
  color: $color-warning;
  margin-bottom: 16px;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 8px 20px;
  font-size: 14px;
  color: $color-text-secondary;
  background: $color-surface-hover;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-border-light;
  }
}

.btn-confirm {
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: $color-success;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2d9249;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 确稿成功弹窗
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 40px 32px;
  width: 360px;
  text-align: center;
  animation: slideUp 0.3s ease;
}

.modal-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 8px;
}

.modal-text {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 24px;
}

.btn-download {
  padding: 10px 32px;
  background: $color-primary;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}
</style>