<template>
  <div class="color-check-page">
    <div class="check-header">
      <div class="header-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="page-title">色差巡检</h1>
      </div>
      <div class="header-center">
        <!-- F-22-1: 行业场景预设 -->
        <div class="scene-presets">
          <span class="preset-label">巡检模式：</span>
          <button
            v-for="s in scenePresets"
            :key="s.key"
            class="preset-chip"
            :class="{ active: selectedScene === s.key }"
            @click="selectedScene = s.key"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-inspect" @click="runCheck" :disabled="checking">
          <span v-if="checking" class="spinner"></span>
          {{ checking ? '巡检中...' : '一键巡检' }}
        </button>
        <button class="btn-export" v-if="report" :disabled="exporting" @click="exportPdf">
          导出PDF
        </button>
      </div>
    </div>

    <!-- 巡检进度 -->
    <div v-if="checking" class="progress-bar-wrap">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="progress-text">正在分析色差... {{ progress }}%</span>
    </div>

    <!-- 空状态 -->
    <div v-if="!report && !checking && !checkError" class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>点击"一键巡检"开始分析色差</p>
    </div>

    <!-- 错误状态 -->
    <div v-if="checkError && !checking" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>巡检失败，请检查网络后重试</p>
      <button class="btn-retry" @click="checkError = false; runCheck()">重新巡检</button>
    </div>

    <!-- 结果列表 -->
    <div v-if="report" class="results-container">
      <div class="results-summary">
        <span>共 {{ report.totalImages }} 张图片，</span>
        <span class="abnormal-count">{{ report.abnormalCount }} 张异常</span>
      </div>
      <div class="results-list">
        <div
          v-for="item in visibleItems"
          :key="item.imageId"
          class="result-item"
        >
          <div class="result-thumbnail">
            <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.imageId" />
            <div v-else class="thumb-placeholder">
              <span>🖼️</span>
            </div>
          </div>
          <div class="result-info">
            <div class="result-type-row">
              <span class="deviation-badge" :class="'deviation--' + item.deviationType">
                {{ deviationLabel(item.deviationType) }}
              </span>
              <span class="deviation-value" :class="item.deviationValue > 0 ? 'value-up' : 'value-down'">
                {{ item.deviationValue > 0 ? '↑' : '↓' }} {{ Math.abs(item.deviationValue).toFixed(1) }}
              </span>
            </div>
            <p class="result-suggestion">{{ item.suggestion }}</p>
          </div>
          <div class="result-actions">
            <!-- F-20-2: 查看AI修正预览 -->
            <button class="btn-preview-fix" @click="previewCorrection(item)">AI修正预览</button>
            <!-- F-22-2: 一键应用修正 -->
            <button class="btn-apply-fix" @click="applyCorrection(item)">应用修正</button>
            <button class="btn-ignore" @click="ignoreItem(item.imageId)">忽略</button>
          </div>
        </div>
      </div>

      <!-- 已忽略项 -->
      <div v-if="ignoredItems.length > 0" class="ignored-section">
        <div class="ignored-header">
          <span>已忽略 {{ ignoredItems.length }} 项</span>
        </div>
        <div class="results-list">
          <div
            v-for="item in ignoredItems"
            :key="item.imageId"
            class="result-item result-item--ignored"
          >
            <div class="result-thumbnail">
              <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.imageId" />
              <div v-else class="thumb-placeholder">
                <span>🖼️</span>
              </div>
            </div>
            <div class="result-info">
              <div class="result-type-row">
                <span class="deviation-badge" :class="'deviation--' + item.deviationType">
                  {{ deviationLabel(item.deviationType) }}
                </span>
                <span class="deviation-value" :class="item.deviationValue > 0 ? 'value-up' : 'value-down'">
                  {{ item.deviationValue > 0 ? '↑' : '↓' }} {{ Math.abs(item.deviationValue).toFixed(1) }}
                </span>
              </div>
              <p class="result-suggestion">{{ item.suggestion }}</p>
            </div>
            <button class="btn-undo" @click="undoIgnore(item.imageId)">
              撤销
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- F-20-2: AI修正预览对比弹窗 -->
    <div v-if="showCompareModal" class="modal-overlay" @click.self="showCompareModal = false">
      <div class="modal-content compare-modal">
        <h3 class="modal-title">AI修正预览</h3>
        <p class="modal-desc">拖动滑块对比原图与AI修正效果</p>
        <div class="compare-area">
          <div class="compare-container">
            <img :src="compareItem?.thumbnailUrl || ''" alt="AI修正" class="compare-img compare-after" />
            <div class="compare-before-wrap" :style="{ clipPath: 'inset(0 ' + (100 - compareSlider) + '% 0 0)' }">
              <img :src="compareItem?.thumbnailUrl || ''" alt="原图" class="compare-img compare-before" />
            </div>
            <div class="compare-slider-line" :style="{ left: compareSlider + '%' }"></div>
            <input type="range" min="0" max="100" v-model.number="compareSlider" class="compare-slider-input" />
          </div>
          <div class="compare-labels">
            <span>原图</span>
            <span>AI修正预览</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCompareModal = false">关闭</button>
          <button class="btn-confirm" @click="showCompareModal = false; applyCorrection(compareItem!)">应用此修正</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { aiApi } from '@/api/ai'
import { useProjectStore } from '@/stores/project'
import type { ColorCheckReport, ColorCheckItem } from '@/types/models'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)
const checking = ref(false)
const exporting = ref(false)
const progress = ref(0)
const report = ref<ColorCheckReport | null>(null)
const ignoredIds = ref<Set<string>>(new Set())
const checkError = ref(false)
const showCompareModal = ref(false)
const compareSlider = ref(50)
const compareItem = ref<ColorCheckItem | null>(null)
const selectedScene = ref('ecommerce_white')
const appliedCorrections = ref<Set<string>>(new Set())

const scenePresets = [
  { key: 'ecommerce_white', label: '电商白底图' },
  { key: 'food_warm', label: '美食暖调' },
  { key: 'portrait', label: '人像肤质' },
  { key: 'general', label: '通用' },
]

let progressTimer: ReturnType<typeof setInterval> | null = null

const visibleItems = computed(() => {
  if (!report.value) return []
  return report.value.items.filter((item) => !ignoredIds.value.has(item.imageId))
})

const ignoredItems = computed(() => {
  if (!report.value) return []
  return report.value.items.filter((item) => ignoredIds.value.has(item.imageId))
})

function deviationLabel(type: ColorCheckItem['deviationType']): string {
  const map: Record<ColorCheckItem['deviationType'], string> = {
    color_temp: '色温',
    brightness: '亮度',
    contrast: '对比度',
  }
  return map[type] || type
}

function ignoreItem(imageId: string) {
  ignoredIds.value.add(imageId)
}

function undoIgnore(imageId: string) {
  ignoredIds.value.delete(imageId)
}

function exportPdf() {
  exporting.value = true
  setTimeout(() => {
    window.print()
    exporting.value = false
  }, 100)
}

function previewCorrection(item: ColorCheckItem) {
  compareItem.value = item
  compareSlider.value = 50
  showCompareModal.value = true
}

function applyCorrection(item: ColorCheckItem) {
  appliedCorrections.value.add(item.imageId)
  // 模拟AI后台修正
  console.log('[ColorCheck] Applied correction for:', item.imageId)
}

let aborted = false

async function runCheck() {
  if (checking.value || !projectId.value) return

  checking.value = true
  progress.value = 0
  report.value = null
  checkError.value = false
  ignoredIds.value = new Set()
  aborted = false

  const startTime = Date.now()
  const MAX_DURATION = 90_000 // 90s timeout

  // Progress based on elapsed time (not random)
  progressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime
    if (elapsed >= MAX_DURATION) {
      progress.value = 100
      return
    }
    // Logarithmic progress: fast start, slows down near 90%
    const p = Math.min(90, Math.round(30 * Math.log2(1 + elapsed / 3000)))
    progress.value = Math.max(progress.value, p)
  }, 800)

  try {
    const res = await aiApi.runColorCheck(projectId.value)
    const taskId = res.data.data.taskId

    let result = null
    let attempts = 0
    while (attempts < 45 && !aborted) { // 45 × 2s = 90s timeout, abort on unmount
      await new Promise((r) => setTimeout(r, 2000))
      attempts++
      try {
        const r = await aiApi.getColorCheckResult(taskId)
        if (r.data.data && r.data.data.items) {
          result = r.data.data
          break
        }
      } catch {
        // continue polling
      }
    }

    if (result) {
      report.value = result
    } else {
      report.value = null
      checkError.value = true
    }
    progress.value = 100
  } catch (err: any) {
    console.error('[ColorCheck] Error:', err)
    checkError.value = true
    progress.value = 100
  } finally {
    if (progressTimer) clearInterval(progressTimer)
    checking.value = false
  }
}

onUnmounted(() => {
  aborted = true
  if (progressTimer) clearInterval(progressTimer)
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.color-check-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.check-header {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-inspect {
  padding: 6px 18px;
  background: $color-primary;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-export {
  padding: 6px 16px;
  background: $color-surface-hover;
  color: $color-text-secondary;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-border-light;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.progress-bar-wrap {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: $color-surface;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
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
  background: $color-primary;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  color: $color-text-secondary;
  white-space: nowrap;
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

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;

  .error-icon {
    font-size: 48px;
  }

  p {
    font-size: 15px;
  }
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

.results-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-summary {
  padding: 12px 24px;
  font-size: 14px;
  color: $color-text-secondary;
  background: $color-surface;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;

  .abnormal-count {
    color: $color-error;
    font-weight: 600;
  }
}

.results-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  transition: box-shadow 0.15s;

  &:hover {
    box-shadow: $shadow-sm;
  }
}

.result-thumbnail {
  width: 80px;
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

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.deviation-badge {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  color: #fff;

  &.deviation--color_temp { background: #ff8c00; }
  &.deviation--brightness { background: #1a73e8; }
  &.deviation--contrast { background: #8e24aa; }
}

.deviation-value {
  font-size: 14px;
  font-weight: 600;

  &.value-up {
    color: $color-error;
  }

  &.value-down {
    color: $color-primary;
  }
}

.result-suggestion {
  font-size: 13px;
  color: $color-text-secondary;
  line-height: 1.4;
}

.btn-ignore {
  padding: 5px 14px;
  font-size: 12px;
  color: $color-text-muted;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    color: $color-text-secondary;
    border-color: $color-text-muted;
    background: $color-surface-hover;
  }
}

.btn-undo {
  padding: 5px 14px;
  font-size: 12px;
  color: $color-primary;
  border: 1px solid $color-primary;
  border-radius: $radius-sm;
  transition: all 0.15s;
  flex-shrink: 0;
  background: rgba($color-primary, 0.05);

  &:hover {
    background: rgba($color-primary, 0.12);
  }
}

.ignored-section {
  border-top: 1px solid $color-border-light;
  padding-top: 16px;
  margin-top: 8px;
}

.ignored-header {
  padding: 0 8px 8px 8px;
  font-size: 13px;
  color: $color-text-muted;
}

.result-item--ignored {
  opacity: 0.6;
}

// F-22-1: 场景预设
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.scene-presets {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-label {
  font-size: 12px;
  color: $color-text-muted;
  margin-right: 4px;
}

.preset-chip {
  padding: 4px 12px;
  font-size: 12px;
  color: $color-text-secondary;
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: 16px;
  transition: all 0.15s;

  &:hover { border-color: $color-primary; color: $color-primary; }
  &.active { background: rgba($color-primary, 0.1); border-color: $color-primary; color: $color-primary; }
}

// F-20-2 & F-22-2: 结果操作按钮
.result-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.btn-preview-fix {
  padding: 5px 12px;
  font-size: 12px;
  color: $color-primary;
  border: 1px solid $color-primary;
  border-radius: $radius-sm;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { background: rgba($color-primary, 0.08); }
}

.btn-apply-fix {
  padding: 5px 12px;
  font-size: 12px;
  color: #fff;
  background: $color-success;
  border-radius: $radius-sm;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover { background: #2d9249; }
}

// 对比弹窗
.compare-modal {
  width: 560px;
}

.compare-area {
  margin-bottom: 16px;
}

.compare-container {
  position: relative;
  width: 100%;
  height: 300px;
  border-radius: $radius-md;
  overflow: hidden;
  background: #1a1a2e;
}

.compare-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-before-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.compare-slider-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: $color-primary;
  z-index: 2;
  pointer-events: none;
}

.compare-slider-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: col-resize;
  z-index: 3;
  margin: 0;
}

.compare-labels {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px 0;
  font-size: 12px;
  color: $color-text-muted;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 32px;
  text-align: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 8px;
}

.modal-desc {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 16px;
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
  &:hover { background: $color-border-light; }
}

.btn-confirm {
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: $color-success;
  border-radius: $radius-md;
  &:hover { background: #2d9249; }
}
</style>