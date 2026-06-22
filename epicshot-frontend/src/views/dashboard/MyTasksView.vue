<template>
  <div class="my-tasks">
    <h1 class="page-title">我的待办</h1>

    <!-- UX-43: 批量操作栏 -->
    <div v-if="selectedTaskIds.size > 0" class="batch-bar">
      <span class="batch-count">已选 {{ selectedTaskIds.size }} 张</span>
      <button class="btn-batch" @click="batchMarkViewed">标记已查看</button>
      <button class="btn-batch btn-batch--primary" @click="batchStartProcessing">批量开始处理</button>
    </div>

    <!-- UX-52: 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-tab"
          :class="{ active: activeFilter === f.key }"
          @click="activeFilter = f.key"
        >
          {{ f.label }}
          <span class="filter-count" v-if="f.key !== 'all'">{{ getFilterCount(f.key) }}</span>
        </button>
      </div>
      <select v-model="selectedProjectFilter" class="filter-project-select">
        <option value="">全部项目</option>
        <option v-for="p in projectOptions" :key="p" :value="p">{{ p }}</option>
      </select>
      <!-- FB-019: 按预计时间排序 -->
      <select v-model="sortBy" class="filter-project-select">
        <option value="">默认排序</option>
        <option value="time-asc">预计时间 ↑</option>
        <option value="time-desc">预计时间 ↓</option>
      </select>
    </div>

    <!-- FB-018: 快速流转暂停/继续 -->
    <div class="flow-control-bar" v-if="tasks.length > 0">
      <button
        class="btn-flow-toggle"
        :class="{ 'btn-flow-paused': flowPaused }"
        @click="flowPaused = !flowPaused"
        :title="flowPaused ? '继续流转' : '暂停流转'"
      >
        <Pause :size="14" v-if="!flowPaused" />
        <Play :size="14" v-else />
        <span>{{ flowPaused ? '继续流转' : '暂停流转' }}</span>
      </button>
      <span v-if="flowPaused" class="flow-paused-indicator">⏸ 流转已暂停</span>
    </div>

    <div v-if="loading" class="skeleton-tasks">
      <div v-for="i in 3" :key="'task-' + i" class="skeleton skeleton-task-card"></div>
    </div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      <span class="empty-icon">🎉</span>
      <h3 class="empty-title">全都搞定了！</h3>
      <p class="empty-desc">所有待处理任务已完成</p>
      <button class="btn-primary-empty" @click="router.push('/projects')">前往项目看板</button>
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        :class="'priority-' + task.priority"
        @click="goToProject(task.projectId)"
      >
        <!-- UX-43: 多选复选框 -->
        <div class="task-checkbox" @click.stop="toggleSelectTask(task.id)">
          <input
            type="checkbox"
            :checked="selectedTaskIds.has(task.id)"
            @click.stop
            @change="toggleSelectTask(task.id)"
          />
        </div>
        <div class="task-priority-bar"></div>
        <div class="task-thumb" v-if="task.thumbnailUrl" @mouseenter="showPreview($event, task)" @mouseleave="hidePreview">
          <img :src="task.thumbnailUrl" alt="" />
        </div>
        <div class="task-body">
          <div class="task-header">
            <span class="task-project">{{ task.projectName }}</span>
            <span class="task-priority-tag" v-if="task.priority === 'dispute'">争议</span>
            <span class="task-priority-tag priority-urgent" v-else-if="task.priority === 'urgent'">临期</span>
          </div>
          <p class="task-text">{{ task.text || '无描述' }}</p>
          <div class="task-breadcrumb" v-if="task.projectName && task.unitName">
            <span>{{ task.projectName }}</span>
            <span class="breadcrumb-sep">&gt;</span>
            <span>{{ task.unitName }}</span>
          </div>
          <div class="task-meta">
            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
            <!-- FB-019: 预计时间显示 -->
            <span v-if="task.estimatedTime" class="task-estimated-time" @click.stop="startEditEstimatedTime(task)">
              <Clock :size="12" /> 预计 {{ task.estimatedTime }} 分钟
            </span>
            <span v-else class="task-estimated-time task-estimated-time--add" @click.stop="startEditEstimatedTime(task)">
              <Clock :size="12" /> 设置预计时间
            </span>
          </div>
          <!-- FB-019: 预计时间编辑 -->
          <div v-if="editingTimeTaskId === task.id" class="task-estimated-edit" @click.stop>
            <input
              v-model.number="editingTimeValue"
              type="number"
              min="1"
              max="480"
              class="time-input"
              placeholder="分钟"
              @keydown.enter="saveEstimatedTime(task)"
              @keydown.escape="cancelEditTime"
            />
            <button class="btn-time-save" @click="saveEstimatedTime(task)">保存</button>
            <button class="btn-time-cancel" @click="cancelEditTime">取消</button>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-resolve" @click.stop="resolveTask(task)">标记已解决</button>
        </div>
      </div>
    </div>

    <!-- 任务预览浮窗 -->
    <div
      v-if="previewTask"
      class="preview-overlay"
      :style="{ left: previewPos.x + 'px', top: previewPos.y + 'px' }"
    >
      <img :src="previewTask.thumbnailUrl" alt="" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard'
import client from '@/api/client'
import { Clock, Pause, Play } from 'lucide-vue-next'
import type { MyTask } from '@/types/models'

const router = useRouter()
const loading = ref(true)
const tasks = ref<MyTask[]>([])

// UX-52: 筛选
const activeFilter = ref<'all' | 'dispute' | 'urgent' | 'normal'>('all')
const selectedProjectFilter = ref('')
// FB-018: 快速流转暂停
const flowPaused = ref(false)
// FB-019: 按预计时间排序
const sortBy = ref('')
const filters = [
  { key: 'all' as const, label: '全部' },
  { key: 'dispute' as const, label: '争议' },
  { key: 'urgent' as const, label: '临期' },
  { key: 'normal' as const, label: '正常' },
]

const projectOptions = computed(() => {
  const names = new Set<string>()
  tasks.value.forEach(t => { if (t.projectName) names.add(t.projectName) })
  return Array.from(names).sort()
})

const filteredTasks = computed(() => {
  let result = tasks.value
  if (activeFilter.value === 'dispute') {
    result = result.filter(t => t.disputed)
  } else if (activeFilter.value === 'urgent') {
    result = result.filter(t => t.priority === 'urgent')
  } else if (activeFilter.value === 'normal') {
    result = result.filter(t => t.priority !== 'urgent' && !t.disputed)
  }
  if (selectedProjectFilter.value) {
    result = result.filter(t => t.projectName === selectedProjectFilter.value)
  }
  // FB-019: 按预计时间排序
  if (sortBy.value === 'time-asc') {
    result = [...result].sort((a: any, b: any) => (a.estimatedTime || 0) - (b.estimatedTime || 0))
  } else if (sortBy.value === 'time-desc') {
    result = [...result].sort((a: any, b: any) => (b.estimatedTime || 0) - (a.estimatedTime || 0))
  }
  return result
})

function getFilterCount(key: string): number {
  if (key === 'dispute') return tasks.value.filter(t => t.disputed).length
  if (key === 'urgent') return tasks.value.filter(t => t.priority === 'urgent').length
  if (key === 'normal') return tasks.value.filter(t => t.priority !== 'urgent' && !t.disputed).length
  return tasks.value.length
}

// UX-43: 多选批量操作
const selectedTaskIds = ref<Set<string>>(new Set())

// FB-019: 预计时间编辑
const editingTimeTaskId = ref<string | null>(null)
const editingTimeValue = ref<number>(0)

function startEditEstimatedTime(task: any) {
  editingTimeTaskId.value = task.id
  editingTimeValue.value = task.estimatedTime || 15
}

function cancelEditTime() {
  editingTimeTaskId.value = null
  editingTimeValue.value = 0
}

async function saveEstimatedTime(task: any) {
  if (!editingTimeValue.value || editingTimeValue.value < 1) return
  try {
    await client.post(`/v1/cards/${task.id}/update`, {
      estimatedTime: editingTimeValue.value,
    })
    task.estimatedTime = editingTimeValue.value
    editingTimeTaskId.value = null
    editingTimeValue.value = 0
  } catch (e: any) {
    console.error('[MyTasks] save estimated time failed', e)
  }
}

function toggleSelectTask(id: string) {
  const next = new Set(selectedTaskIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedTaskIds.value = next
}

async function batchMarkViewed() {
  if (selectedTaskIds.value.size === 0) return
  try {
    await client.post('/v1/cards/batch-update', {
      cardIds: Array.from(selectedTaskIds.value),
      action: 'mark_viewed',
    })
    selectedTaskIds.value = new Set()
    // 重新加载任务列表
    const res = await dashboardApi.getMyTasks()
    tasks.value = res.data.data
  } catch (e) {
    console.error('[MyTasks] batch mark viewed failed', e)
  }
}

async function batchStartProcessing() {
  if (selectedTaskIds.value.size === 0) return
  try {
    await client.post('/v1/cards/batch-update', {
      cardIds: Array.from(selectedTaskIds.value),
      action: 'start_processing',
    })
    selectedTaskIds.value = new Set()
    // 重新加载任务列表
    const res = await dashboardApi.getMyTasks()
    tasks.value = res.data.data
  } catch (e) {
    console.error('[MyTasks] batch start processing failed', e)
  }
}

// 预览浮窗
const previewTask = ref<MyTask | null>(null)
const previewPos = reactive({ x: 0, y: 0 })

function showPreview(e: MouseEvent, task: MyTask) {
  previewTask.value = task
  previewPos.x = e.clientX + 16
  previewPos.y = e.clientY + 16
}

function hidePreview() {
  previewTask.value = null
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z')
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}

function goToProject(projectId: string) {
  router.push('/project/' + projectId)
}

async function resolveTask(task: MyTask) {
  try {
    const { annotationApi } = await import('@/api/annotations')
    await annotationApi.updateCardStatus(task.id, 'resolve')
    tasks.value = tasks.value.filter(t => t.id !== task.id)
    // FB-018: 快速流转 - 暂停则不自动滚动
    if (flowPaused.value) return
    // 快速流转：自动滚动到下一个任务
    const nextCard = document.querySelector('.task-card')
    if (nextCard) {
      nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } catch (e) {
    console.error('[MyTasks] resolve failed', e)
  }
}

onMounted(async () => {
  try {
    const res = await dashboardApi.getMyTasks()
    const raw = res.data.data || []
    // UX-33: mock 缺失字段（projectName, unitName, thumbnailUrl, projectStatus）
    tasks.value = raw.map((task: any) => ({
      ...task,
      projectName: task.projectName || '未命名项目',
      unitName: task.unitName || '默认单元',
      thumbnailUrl: task.thumbnailUrl || '',
      projectStatus: task.projectStatus || 'green',
    }))
  } catch (e) {
    console.error('[MyTasks] load failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.my-tasks {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 20px;
}

// UX-43: 批量操作栏
.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #e8f0fe;
  border: 1px solid #c6d9f5;
  border-radius: $radius-md;
  margin-bottom: 12px;
}

.batch-count {
  font-size: 13px;
  font-weight: 500;
  color: $color-primary;
  margin-right: auto;
}

.btn-batch {
  padding: 5px 14px;
  font-size: 12px;
  color: $color-text-secondary;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: $color-surface-hover; color: $color-text; }
  &.btn-batch--primary {
    color: #fff;
    background: $color-primary;
    border-color: $color-primary;
    &:hover { background: $color-primary-dark; }
  }
}

// UX-43: 多选复选框
.task-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 4px;
  cursor: pointer;
  input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
}

// DS-05: 空状态重新设计
// EMO-03: 骨架屏
.skeleton-tasks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-task-card {
  width: 100%;
  height: 100px;
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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: $color-text-secondary;
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: $color-text-secondary;
  text-align: center;

  .empty-icon {
    font-size: 56px;
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: $color-text;
    margin: 0 0 8px;
  }

  .empty-desc {
    font-size: 14px;
    color: $color-text-secondary;
    margin: 0 0 24px;
  }

  .btn-primary-empty {
    padding: 10px 24px;
    background: $color-primary;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    border-radius: $radius-md;
    transition: background 0.2s;

    &:hover {
      background: $color-primary-dark;
    }
  }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 12px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s;
  overflow: hidden;

  &:hover { box-shadow: $shadow-md; }

  &.priority-dispute {
    border-color: rgba(#ea4335, 0.3);
  }
  &.priority-urgent {
    border-color: rgba(#f9ab00, 0.3);
  }
}

.task-status-bar {
  width: 3px;
  height: 100%;
  min-height: 50px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: stretch;

  &.status-red { background: #ea4335; }
  &.status-yellow { background: #f9ab00; }
  &.status-green { background: #34a853; }
}

.task-thumb {
  width: 50px;
  height: 50px;
  border-radius: $radius-sm;
  overflow: hidden;
  flex-shrink: 0;
  background: $color-border-light;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.task-body {
  flex: 1;
  min-width: 0;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.task-project {
  font-size: 12px;
  color: $color-text-secondary;
  background: $color-surface-hover;
  padding: 1px 8px;
  border-radius: 4px;
}

.task-priority-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #fce8e6;
  color: #c5221f;
  &.priority-urgent { background: #fef7e0; color: #e37400; }
}

.task-text {
  font-size: 14px;
  color: $color-text;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-breadcrumb {
  font-size: 11px;
  color: $color-text-muted;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb-sep {
    flex-shrink: 0;
    color: $color-text-muted;
  }
}

.task-meta {
  margin-top: 4px;
  font-size: 12px;
  color: $color-text-muted;
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-estimated-time {
  color: $color-primary;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: rgba($color-primary, 0.08);
  }

  &.task-estimated-time--add {
    color: $color-text-muted;
    font-weight: 400;
    font-style: italic;
    font-size: 11px;
  }
}

// FB-019: 预计时间编辑
.task-estimated-edit {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid $color-border-light;
}

.time-input {
  width: 70px;
  padding: 4px 8px;
  border: 1px solid $color-border;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.btn-time-save {
  padding: 4px 10px;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  transition: background 0.15s;
  &:hover { background: $color-primary-dark; }
}

.btn-time-cancel {
  padding: 4px 10px;
  background: transparent;
  color: $color-text-muted;
  font-size: 12px;
  border: 1px solid $color-border;
  border-radius: 4px;
  transition: all 0.15s;
  &:hover { border-color: $color-text-muted; color: $color-text; }
}

.task-actions {
  flex-shrink: 0;
}

.btn-resolve {
  padding: 6px 14px;
  font-size: 12px;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  transition: background 0.15s;
  &:hover { background: $color-primary-dark; }
}

// 预览浮窗
.preview-overlay {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 2px solid $color-border-light;
  background: #fff;

  img {
    display: block;
    width: 280px;
    height: 210px;
    object-fit: cover;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 4px;
}
.filter-tabs {
  display: flex;
  gap: 4px;
}
.filter-tab {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  background: #fff;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-tab.active {
  background: #1a73e8;
  color: #fff;
  border-color: #1a73e8;
}
.filter-count {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.8;
}
.filter-project-select {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  background: #fff;
}

// ===== FB-018: 快速流转暂停 =====
.flow-control-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 8px;
}
.btn-flow-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #555;
  transition: all 0.2s;
  &:hover {
    background: #f5f5f5;
  }
  &.btn-flow-paused {
    background: #fff3e0;
    border-color: #fa8c16;
    color: #fa8c16;
  }
}
.flow-paused-indicator {
  font-size: 13px;
  color: #fa8c16;
  font-weight: 500;
}

// ===== FB-003: 移动端按钮热区优化 =====
@media (max-width: 768px) {
  .my-tasks {
    padding: 16px;
  }

  .page-title {
    font-size: 20px;
    margin-bottom: 12px;
  }

  .filter-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    width: 100%;
  }

  .filter-project-select {
    margin-left: 0;
    width: 100%;
  }

  .task-item {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .task-actions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .btn-resolve,
  .btn-flow-toggle,
  .btn-batch,
  .filter-tab {
    min-height: 44px;
    min-width: 44px;
    font-size: 16px;
    padding: 12px;
  }

  .batch-bar {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }
}
</style>