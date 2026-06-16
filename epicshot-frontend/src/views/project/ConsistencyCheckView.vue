<template>
  <div class="consistency-page">
    <!-- 头部 -->
    <div class="check-header">
      <div class="header-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="page-title">光影一致性巡检</h1>
        <span class="badge badge--beta">BETA</span>
      </div>
      <div class="header-actions">
        <button class="btn-inspect" @click="runCheck" :disabled="checking">
          <span v-if="checking" class="spinner"></span>
          {{ checking ? '巡检中...' : '一键巡检' }}
        </button>
        <button class="btn-export" v-if="report && !checking" :disabled="exporting" @click="exportPdf">
          导出报告
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="checking" class="progress-bar-wrap">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="progress-text">正在分析光影一致性... {{ progress }}%</span>
    </div>

    <!-- 空状态 -->
    <div v-if="!report && !checking && !checkError" class="empty-state">
      <span class="empty-icon">💡</span>
      <p class="empty-title">光影一致性巡检</p>
      <p class="empty-desc">分析同场景组图的光影逻辑一致性，发现灯位偏移、高光不一致等问题</p>
      <button class="btn-start" @click="runCheck">开始巡检</button>
    </div>

    <!-- 错误状态 -->
    <div v-if="checkError && !checking" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>巡检失败，请检查网络后重试</p>
      <button class="btn-retry" @click="checkError = false; runCheck()">重新巡检</button>
    </div>

    <!-- 结果面板 -->
    <div v-if="report" class="results-container">
      <!-- 总览卡片 -->
      <div class="overview-row">
        <div class="score-card" :class="scoreClass">
          <div class="score-value">{{ report.overallScore }}</div>
          <div class="score-label">一致性评分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ report.totalImages }}</div>
          <div class="stat-label">总图片数</div>
        </div>
        <div class="stat-card stat-card--ok">
          <div class="stat-value">{{ report.consistentSceneGroups }}</div>
          <div class="stat-label">一致场景组</div>
        </div>
        <div class="stat-card stat-card--warn">
          <div class="stat-value">{{ report.inconsistentSceneGroups }}</div>
          <div class="stat-label">不一致场景组</div>
        </div>
        <div class="stat-card stat-card--danger">
          <div class="stat-value">{{ report.anomalies.length }}</div>
          <div class="stat-label">异常项</div>
        </div>
      </div>

      <!-- 场景组分析 -->
      <div class="section">
        <h3 class="section-title">场景组光影分析</h3>
        <div class="scene-grid">
          <div
            v-for="sg in report.sceneGroups"
            :key="sg.sceneId"
            class="scene-card"
            :class="'scene--' + sg.consistency"
          >
            <div class="scene-header">
              <span class="scene-name">{{ sg.sceneName }}</span>
              <span class="scene-status" :class="sg.consistency === 'consistent' ? 'status--ok' : 'status--warn'">
                {{ sg.consistency === 'consistent' ? '✓ 一致' : '⚠ 不一致' }}
              </span>
            </div>
            <div class="scene-body">
              <div class="scene-stat">
                <span class="scene-stat-label">图片数</span>
                <span class="scene-stat-value">{{ sg.imageCount }}</span>
              </div>
              <div class="scene-stat">
                <span class="scene-stat-label">主光源方向</span>
                <span class="scene-stat-value">{{ sg.dominantLightDirection }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 异常报告 -->
      <div class="section" v-if="report.anomalies.length > 0">
        <h3 class="section-title">
          异常报告
          <span class="section-count">{{ report.anomalies.length }}</span>
        </h3>
        <div class="anomaly-list">
          <div
            v-for="anomaly in report.anomalies"
            :key="anomaly.id"
            class="anomaly-card"
            :class="'anomaly--' + anomaly.severity"
          >
            <div class="anomaly-header">
              <span class="anomaly-severity" :class="'severity--' + anomaly.severity">
                {{ severityLabel(anomaly.severity) }}
              </span>
              <span class="anomaly-type">{{ anomalyTypeLabel(anomaly.type) }}</span>
            </div>
            <p class="anomaly-desc">{{ anomaly.description }}</p>
            <div class="anomaly-images">
              <div class="anomaly-image-group">
                <span class="anomaly-image-label anomaly-label--bad">异常图片</span>
                <div class="anomaly-image-row">
                  <div
                    v-for="imgId in anomaly.affectedImageIds"
                    :key="imgId"
                    class="anomaly-thumb"
                    :class="{ selected: selectedImage === imgId }"
                    @click="selectedImage = imgId"
                  >
                    <span class="thumb-id">{{ imgId }}</span>
                  </div>
                </div>
              </div>
              <div class="anomaly-image-group">
                <span class="anomaly-image-label anomaly-label--good">正常参考</span>
                <div class="anomaly-image-row">
                  <div
                    v-for="imgId in anomaly.normalImageIds"
                    :key="imgId"
                    class="anomaly-thumb anomaly-thumb--normal"
                    :class="{ selected: selectedImage === imgId }"
                    @click="selectedImage = imgId"
                  >
                    <span class="thumb-id">{{ imgId }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="anomaly-suggestion">
              <span class="suggestion-icon">💡</span>
              <span class="suggestion-text">{{ anomaly.suggestion }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 全部一致 -->
      <div v-else class="all-clear">
        <span class="clear-icon">🎉</span>
        <p>所有场景组光影一致，无需处理</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { aiApi } from '@/api/ai'
import type { ConsistencyReport, ConsistencyAnomaly } from '@/types/models'

const router = useRouter()
const route = useRoute()

const projectId = computed(() => route.params.id as string)
const checking = ref(false)
const exporting = ref(false)
const progress = ref(0)
const report = ref<ConsistencyReport | null>(null)
const checkError = ref(false)
const selectedImage = ref<string | null>(null)

let progressTimer: ReturnType<typeof setInterval> | null = null
let aborted = false

const scoreClass = computed(() => {
  if (!report.value) return ''
  const s = report.value.overallScore
  if (s >= 80) return 'score--good'
  if (s >= 50) return 'score--warn'
  return 'score--bad'
})

function severityLabel(s: ConsistencyAnomaly['severity']): string {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return map[s] || s
}

function anomalyTypeLabel(t: ConsistencyAnomaly['type']): string {
  const map: Record<string, string> = {
    light_direction: '光源方向',
    highlight_position: '高光位置',
    shadow_angle: '阴影角度',
    color_temperature: '色温',
    exposure: '曝光',
    reflection: '反光',
  }
  return map[t] || t
}

function exportPdf() {
  exporting.value = true
  setTimeout(() => {
    window.print()
    exporting.value = false
  }, 100)
}

async function runCheck() {
  if (checking.value || !projectId.value) return

  checking.value = true
  progress.value = 0
  report.value = null
  checkError.value = false
  aborted = false

  const startTime = Date.now()
  const MAX_DURATION = 90_000

  progressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime
    if (elapsed >= MAX_DURATION) { progress.value = 100; return }
    const p = Math.min(90, Math.round(30 * Math.log2(1 + elapsed / 3000)))
    progress.value = Math.max(progress.value, p)
  }, 800)

  try {
    const res = await aiApi.runConsistencyCheck(projectId.value)
    const taskId = res.data.data.taskId

    let result = null
    let attempts = 0
    while (attempts < 45 && !aborted) {
      await new Promise((r) => setTimeout(r, 2000))
      attempts++
      try {
        const r = await aiApi.getConsistencyCheckResult(taskId)
        if (r.data.data && r.data.data.sceneGroups) {
          result = r.data.data
          break
        }
      } catch { /* continue polling */ }
    }

    if (result) {
      report.value = result
    } else {
      checkError.value = true
    }
    progress.value = 100
  } catch (err: any) {
    console.error('[ConsistencyCheck] Error:', err)
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

.consistency-page {
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
  gap: 10px;

  .btn-back {
    font-size: 13px;
    color: $color-text-secondary;
    padding: 4px 8px;
    border-radius: $radius-sm;
    &:hover { background: $color-surface-hover; }
  }

  .page-title {
    font-size: 16px;
    font-weight: 600;
    color: $color-text;
  }
}

.badge--beta {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
}

.header-actions {
  display: flex;
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

  &:hover:not(:disabled) { background: $color-primary-dark; }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
}

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.btn-export {
  padding: 6px 16px;
  background: $color-surface-hover;
  color: $color-text-secondary;
  font-size: 13px;
  border-radius: $radius-md;
  &:hover { background: $color-border-light; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
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
  background: linear-gradient(90deg, #667eea, #764ba2);
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
  gap: 8px;
  color: $color-text-secondary;

  .empty-icon { font-size: 56px; }
  .empty-title { font-size: 18px; font-weight: 600; color: $color-text; }
  .empty-desc { font-size: 14px; max-width: 360px; text-align: center; line-height: 1.5; }
}

.btn-start {
  margin-top: 12px;
  padding: 10px 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: $radius-lg;
  &:hover { opacity: 0.9; }
}

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;

  .error-icon { font-size: 48px; }
  p { font-size: 15px; }
}

.btn-retry {
  padding: 8px 20px;
  background: $color-primary;
  color: #fff;
  font-size: 14px;
  border-radius: $radius-md;
  &:hover { background: $color-primary-dark; }
}

.results-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// 总览行
.overview-row {
  display: flex;
  gap: 12px;
}

.score-card {
  width: 120px;
  height: 100px;
  border-radius: $radius-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;

  &.score--good { background: linear-gradient(135deg, #2d9249, #43a047); }
  &.score--warn { background: linear-gradient(135deg, #ed8936, #f6ad55); }
  &.score--bad { background: linear-gradient(135deg, #e53e3e, #fc8181); }

  .score-value { font-size: 32px; font-weight: 700; }
  .score-label { font-size: 12px; opacity: 0.9; margin-top: 2px; }
}

.stat-card {
  flex: 1;
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 16px;
  text-align: center;

  .stat-value { font-size: 24px; font-weight: 700; color: $color-text; }
  .stat-label { font-size: 12px; color: $color-text-muted; margin-top: 4px; }

  &.stat-card--ok .stat-value { color: $color-success; }
  &.stat-card--warn .stat-value { color: #ed8936; }
  &.stat-card--danger .stat-value { color: $color-error; }
}

// 场景组
.section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-count {
    font-size: 12px;
    padding: 2px 8px;
    background: $color-error;
    color: #fff;
    border-radius: 10px;
  }
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.scene-card {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 14px;
  transition: box-shadow 0.15s;

  &:hover { box-shadow: $shadow-sm; }

  &.scene--consistent { border-left: 3px solid $color-success; }
  &.scene--inconsistent { border-left: 3px solid #ed8936; }
}

.scene-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  .scene-name { font-size: 14px; font-weight: 600; color: $color-text; }
}

.scene-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;

  &.status--ok { color: $color-success; background: rgba($color-success, 0.1); }
  &.status--warn { color: #ed8936; background: rgba(#ed8936, 0.1); }
}

.scene-body {
  display: flex;
  gap: 16px;
}

.scene-stat {
  display: flex;
  flex-direction: column;

  .scene-stat-label { font-size: 11px; color: $color-text-muted; }
  .scene-stat-value { font-size: 14px; font-weight: 600; color: $color-text; }
}

// 异常项
.anomaly-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.anomaly-card {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 16px;
  transition: box-shadow 0.15s;

  &:hover { box-shadow: $shadow-sm; }

  &.anomaly--high { border-left: 4px solid $color-error; }
  &.anomaly--medium { border-left: 4px solid #ed8936; }
  &.anomaly--low { border-left: 4px solid #ecc94b; }
}

.anomaly-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.anomaly-severity {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 10px;
  color: #fff;

  &.severity--high { background: $color-error; }
  &.severity--medium { background: #ed8936; }
  &.severity--low { background: #ecc94b; color: #333; }
}

.anomaly-type {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.anomaly-desc {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 12px;
  line-height: 1.4;
}

.anomaly-images {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.anomaly-image-group {
  .anomaly-image-label {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    display: block;
  }
  .anomaly-label--bad { color: $color-error; }
  .anomaly-label--good { color: $color-success; }
}

.anomaly-image-row {
  display: flex;
  gap: 8px;
}

.anomaly-thumb {
  width: 80px;
  height: 56px;
  background: $color-border-light;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s;

  &:hover { border-color: $color-primary; }
  &.selected { border-color: $color-primary; }

  .thumb-id {
    font-size: 11px;
    color: $color-text-muted;
  }

  &.anomaly-thumb--normal {
    background: rgba($color-success, 0.08);
  }
}

.anomaly-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: rgba($color-primary, 0.05);
  border-radius: $radius-md;

  .suggestion-icon { font-size: 14px; flex-shrink: 0; }
  .suggestion-text { font-size: 13px; color: $color-text-secondary; line-height: 1.4; }
}

.all-clear {
  text-align: center;
  padding: 48px 0;
  color: $color-text-secondary;

  .clear-icon { font-size: 48px; display: block; margin-bottom: 12px; }
  p { font-size: 15px; }
}
</style>