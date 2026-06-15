<template>
  <div class="timeline-page">
    <div class="timeline-header">
      <div class="header-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="page-title">修改溯源时间轴</h1>
      </div>
      <button class="btn-export" @click="handleExportPdf">导出PDF报告</button>
    </div>

    <div v-if="projectStore.loading" class="loading-state">
      <span class="loading-pulse">加载中...</span>
    </div>
    <div v-else-if="projectStore.timeline.length === 0" class="empty-state">
      <span class="empty-icon">📅</span>
      <p>暂无时间轴记录</p>
    </div>
    <div v-else class="timeline-container">

      <!-- 日期筛选栏 -->
      <div class="date-filter-bar">
        <div class="date-filter-group">
          <label class="date-label">从</label>
          <input type="date" v-model="dateFrom" class="date-input" />
        </div>
        <div class="date-filter-group">
          <label class="date-label">到</label>
          <input type="date" v-model="dateTo" class="date-input" />
        </div>
        <button
          v-if="dateFrom || dateTo"
          class="date-clear-btn"
          @click="clearDateFilter"
        >重置</button>
        <span class="date-filter-count" v-if="filteredTimeline.length !== projectStore.timeline.length">
          筛选结果：{{ filteredTimeline.length }} / {{ projectStore.timeline.length }} 条
        </span>
      </div>

      <div class="timeline-line"></div>
      <div
        v-for="(node, index) in filteredTimeline"
        :key="node.id"
        class="timeline-node"
        :class="{ 'node-left': index % 2 === 0, 'node-right': index % 2 !== 0 }"
      >
        <div class="node-connector">
          <span class="node-dot"></span>
        </div>
        <div
          class="node-card"
          :class="{ clickable: node.type === 'revision' && node.revision }"
          @click="node.type === 'revision' && node.revision ? openComparison(node) : undefined"
        >
          <div class="node-header">
            <div class="node-avatar" :style="{ background: avatarColor(index) }">
              {{ node.userName?.charAt(0) || 'U' }}
            </div>
            <span class="node-icon">{{ typeIcon(node.type) }}</span>
          </div>
          <div class="node-body">
            <p class="node-description">{{ node.description }}</p>
            <span class="node-time">{{ formatTime(node.timestamp) }}</span>
          </div>
          <div v-if="node.type === 'revision'" class="node-revision-hint">
            <span>点击查看对比</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 对比弹窗 -->
    <div v-if="showComparison" class="modal-overlay" @click.self="showComparison = false">
      <div class="comparison-modal">
        <h2 class="modal-title">版本对比</h2>
        <div class="comparison-images">
          <div class="comparison-side">
            <p class="comparison-label">修改前</p>
            <div class="comparison-img-wrap">
              <div class="comparison-placeholder">
                <span>📷</span>
                <p>修改前</p>
              </div>
            </div>
          </div>
          <div class="comparison-divider">
            <span>VS</span>
          </div>
          <div class="comparison-side">
            <p class="comparison-label">修改后</p>
            <div class="comparison-img-wrap">
              <img
                v-if="selectedRevision?.uploadedImageUrl"
                :src="selectedRevision.uploadedImageUrl"
                alt="修改后"
              />
              <div v-else class="comparison-placeholder">
                <span>📷</span>
                <p>修改后</p>
              </div>
            </div>
          </div>
        </div>
        <div class="overlay-slider">
          <input
            type="range"
            min="0"
            max="100"
            v-model="overlayValue"
            class="slider-input"
          />
          <span class="slider-label">叠加对比: {{ overlayValue }}%</span>
        </div>
        <div v-if="selectedRevision?.paramChanges && selectedRevision.paramChanges.length > 0" class="param-changes">
          <h3 class="param-title">参数变更</h3>
          <div class="param-list">
            <span
              v-for="pc in selectedRevision.paramChanges"
              :key="pc.key"
              class="param-item"
            >
              {{ pc.key }}: {{ pc.value }}
            </span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showComparison = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import type { TimelineNode } from '@/types/models'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)

function handleExportPdf() {
  // 导出时间线为PDF - 打印当前页面
  window.print()
}

const showComparison = ref(false)
const selectedRevision = ref<TimelineNode | null>(null)
const overlayValue = ref(50)

// Date range filter
const dateFrom = ref('')
const dateTo = ref('')

const filteredTimeline = computed(() => {
  let items = projectStore.timeline
  if (dateFrom.value) {
    const from = new Date(dateFrom.value)
    items = items.filter(e => new Date(e.timestamp) >= from)
  }
  if (dateTo.value) {
    const to = new Date(dateTo.value)
    to.setDate(to.getDate() + 1)
    items = items.filter(e => new Date(e.timestamp) <= to)
  }
  return items
})

function clearDateFilter() {
  dateFrom.value = ''
  dateTo.value = ''
}

const avatarColors = ['#1a73e8', '#34a853', '#ea4335', '#fbbc04', '#8e24aa', '#00acc1', '#f4511e', '#43a047']

function avatarColor(index: number): string {
  return avatarColors[index % avatarColors.length]
}

function typeIcon(type: TimelineNode['type']): string {
  const map: Record<TimelineNode['type'], string> = {
    annotation: '💬',
    revision: '📷',
    confirm: '✅',
    status_change: '🔄',
  }
  return map[type] || '📌'
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openComparison(node: TimelineNode) {
  selectedRevision.value = node
  overlayValue.value = 50
  showComparison.value = true
}

onMounted(() => {
  if (projectId.value) {
    projectStore.fetchTimeline(projectId.value)
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.timeline-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-header {
  height: 48px;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .btn-back {
    font-size: 13px;
    color: $color-text-secondary;
    padding: 4px 8px;
    border-radius: $radius-sm;

    &:hover {
      background: $color-surface-hover;
    }
  }

  .page-title {
    font-size: 16px;
    font-weight: 600;
    color: $color-text;
  }
}

.btn-export {
  padding: 6px 16px;
  background: $color-primary;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 14px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;

  .empty-icon {
    font-size: 48px;
  }

  p {
    font-size: 15px;
  }
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px 24px;
  position: relative;
}

.date-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid $color-border-light;
}

.date-filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-label {
  font-size: 13px;
  color: $color-text-secondary;
  font-weight: 500;
}

.date-input {
  padding: 4px 8px;
  font-size: 13px;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text;
  background: $color-surface;
  outline: none;

  &:focus {
    border-color: $color-primary;
  }
}

.date-clear-btn {
  font-size: 12px;
  color: $color-primary;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.date-filter-count {
  font-size: 12px;
  color: $color-text-muted;
  margin-left: auto;
}

.timeline-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: $color-border;
  transform: translateX(-50%);
}

.timeline-node {
  display: flex;
  align-items: flex-start;
  margin-bottom: 32px;
  position: relative;
}

.node-connector {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  z-index: 1;

  .node-dot {
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: $color-primary;
    border: 2px solid $color-surface;
    box-shadow: 0 0 0 2px $color-border;
  }
}

.node-left {
  justify-content: flex-start;
  padding-right: calc(50% + 28px);

  .node-connector {
    left: 100%;
  }
}

.node-right {
  justify-content: flex-end;
  padding-left: calc(50% + 28px);

  .node-connector {
    left: 0;
  }
}

.node-card {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 14px 16px;
  max-width: 380px;
  width: 100%;
  box-shadow: $shadow-sm;
  transition: box-shadow 0.2s, border-color 0.2s;

  &.clickable {
    cursor: pointer;

    &:hover {
      box-shadow: $shadow-md;
      border-color: $color-primary;
    }
  }
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.node-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.node-icon {
  font-size: 16px;
}

.node-body {
  margin-bottom: 6px;
}

.node-description {
  font-size: 14px;
  color: $color-text;
  line-height: 1.5;
}

.node-time {
  font-size: 12px;
  color: $color-text-muted;
  margin-top: 4px;
  display: block;
}

.node-revision-hint {
  font-size: 12px;
  color: $color-primary;
  font-weight: 500;
}

// 对比弹窗
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

.comparison-modal {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 28px 32px;
  width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 20px;
}

.comparison-images {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.comparison-side {
  flex: 1;
}

.comparison-label {
  font-size: 13px;
  font-weight: 500;
  color: $color-text-secondary;
  margin-bottom: 8px;
}

.comparison-img-wrap {
  aspect-ratio: 16 / 9;
  border-radius: $radius-md;
  overflow: hidden;
  background: $color-border-light;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.comparison-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  color: $color-text-muted;
  gap: 8px;

  span {
    font-size: 32px;
  }

  p {
    font-size: 13px;
  }
}

.comparison-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 28px;

  span {
    font-size: 13px;
    font-weight: 600;
    color: $color-text-secondary;
    background: $color-surface-hover;
    padding: 4px 10px;
    border-radius: 20px;
  }
}

.overlay-slider {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-input {
  flex: 1;
  accent-color: $color-primary;
}

.slider-label {
  font-size: 13px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.param-changes {
  margin-bottom: 20px;
}

.param-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 8px;
}

.param-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.param-item {
  font-size: 12px;
  color: $color-text-secondary;
  background: $color-surface-hover;
  padding: 4px 10px;
  border-radius: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 8px 20px;
  background: $color-surface-hover;
  color: $color-text-secondary;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-border-light;
  }
}
</style>