<template>
  <div class="color-check-page">
    <div class="check-header">
      <div class="header-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="page-title">组图色差巡检</h1>
      </div>
      <div class="header-actions">
        <button class="btn-inspect" @click="runCheck" :disabled="checking">
          <span v-if="checking" class="spinner"></span>
          {{ checking ? '巡检中...' : '一键巡检' }}
        </button>
        <button class="btn-export" v-if="report" :disabled="exporting">
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
    <div v-if="!report && !checking" class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>点击"一键巡检"开始分析组图色差</p>
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
          <button class="btn-ignore" @click="ignoreItem(item.imageId)">
            忽略
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

let progressTimer: ReturnType<typeof setInterval> | null = null

const visibleItems = computed(() => {
  if (!report.value) return []
  return report.value.items.filter((item) => !ignoredIds.value.has(item.imageId))
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

async function runCheck() {
  if (checking.value || !projectId.value) return

  const apiUrl = (import.meta.env.VITE_API_URL as string) || ''
  if (!apiUrl) {
    // Use mock data
    const mockReport = projectStore.getMockColorCheckReport()
    report.value = mockReport as unknown as ColorCheckReport
    progress.value = 100
    return
  }

  checking.value = true
  progress.value = 0
  report.value = null
  ignoredIds.value = new Set()

  // 模拟进度
  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      progress.value += Math.floor(Math.random() * 15) + 5
      if (progress.value > 90) progress.value = 90
    }
  }, 500)

  try {
    const res = await aiApi.runColorCheck(projectId.value)
    const taskId = res.data.data.taskId

    // 轮询获取结果
    const pollResult = async (): Promise<ColorCheckReport> => {
      const result = await aiApi.getColorCheckResult(taskId)
      return result.data.data
    }

    // 简单轮询
    let result: ColorCheckReport | null = null
    let attempts = 0
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000))
      attempts++
      try {
        const r = await pollResult()
        if (r && r.items) {
          result = r
          break
        }
      } catch {
        // continue polling
      }
    }

    if (result) {
      report.value = result
      progress.value = 100
    } else {
      // fallback: mock data
      report.value = {
        id: taskId,
        projectId: projectId.value,
        totalImages: 12,
        abnormalCount: 5,
        items: [],
        createdAt: new Date().toISOString(),
      }
      progress.value = 100
    }
  } catch {
    // fallback mock data
    report.value = {
      id: 'mock',
      projectId: projectId.value,
      totalImages: 12,
      abnormalCount: 5,
      items: [],
      createdAt: new Date().toISOString(),
    }
    progress.value = 100
  } finally {
    if (progressTimer) clearInterval(progressTimer)
    checking.value = false
  }
}
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
</style>