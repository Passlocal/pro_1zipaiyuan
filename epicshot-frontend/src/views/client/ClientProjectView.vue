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
        <div class="image-viewer">
          <div class="viewer-placeholder">
            <span class="viewer-icon">🖼️</span>
            <p>图片查看区域</p>
          </div>
        </div>
        <!-- 标注工具栏 -->
        <div class="anno-toolbar">
          <span class="toolbar-label">标注工具</span>
          <div class="toolbar-btns">
            <button class="tool-btn"><span>🖌️</span></button>
            <button class="tool-btn"><span>⬜</span></button>
            <button class="tool-btn"><span>↗️</span></button>
            <button class="tool-btn"><span>💬</span></button>
          </div>
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
              <textarea
                v-model="cardReplies[card.id]"
                class="card-reply-input"
                placeholder="输入反馈文字..."
                rows="2"
              ></textarea>
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
        class="btn-confirm-all"
        :disabled="confirming"
        @click="confirmAll"
      >
        {{ confirming ? '提交中...' : '全部确稿' }}
      </button>
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
import type { Project, CommentCard, ProjectStatus } from '@/types/models'

const route = useRoute()
const router = useRouter()

const shareToken = computed(() => route.params.shareToken as string)
const project = ref<Project | null>(null)
const cards = ref<CommentCard[]>([])
const loading = ref(true)
const confirming = ref(false)
const showCompleteModal = ref(false)

const cardReplies = ref<Record<string, string>>({})
const cardStates = ref<Record<string, 'confirmed' | 'modify' | null>>({})

const statusLabelMap: Record<ProjectStatus, string> = {
  draft: '草稿',
  review: '待确认',
  in_progress: '修改中',
  final_review: '待确稿',
  completed: '已完成',
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
  }
  return map[project.value.status] || 0
})

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function toggleCardState(cardId: string, state: 'confirmed' | 'modify') {
  cardStates.value[cardId] = cardStates.value[cardId] === state ? null : state
}

async function fetchProject() {
  // 项目通过 share_token 由 API client 拦截器自动附加
  // 此处模拟数据，实际应从 API 获取
  loading.value = true
  try {
    // 实际调用: projectApi.getByShareToken(shareToken.value)
    // 由于项目结构中没有专门的方法，此处模拟一个占位
    project.value = {
      id: '',
      workspaceId: '',
      clientName: '示例项目',
      status: 'final_review',
      pendingCount: 3,
      recentActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    cards.value = []
  } finally {
    loading.value = false
  }
}

async function confirmAll() {
  confirming.value = true
  try {
    // await projectApi.completeProject(project.value!.id)
    showCompleteModal.value = true
  } finally {
    confirming.value = false
  }
}

function goToDownload() {
  showCompleteModal.value = false
  router.push('/client/assets')
}

onMounted(() => {
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
}

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

.anno-toolbar {
  height: 44px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
}

.toolbar-label {
  font-size: 12px;
  color: $color-text-muted;
  font-weight: 500;
}

.toolbar-btns {
  display: flex;
  gap: 4px;
}

.tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  font-size: 14px;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
  }
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

.card-reply-input {
  width: 100%;
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

.btn-confirm-all {
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