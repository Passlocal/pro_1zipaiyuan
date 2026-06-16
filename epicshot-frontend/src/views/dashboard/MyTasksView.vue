<template>
  <div class="my-tasks">
    <h1 class="page-title">我的待办</h1>

    <div v-if="loading" class="loading-state">加载中...</div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      <span class="empty-icon">📋</span>
      <p>暂无待处理任务</p>
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="task-card"
        :class="'priority-' + task.priority"
        @click="goToProject(task.projectId)"
      >
        <div class="task-priority-bar"></div>
        <div class="task-thumb" v-if="task.thumbnailUrl">
          <img :src="task.thumbnailUrl" alt="" />
        </div>
        <div class="task-body">
          <div class="task-header">
            <span class="task-project">{{ task.projectName }}</span>
            <span class="task-priority-tag" v-if="task.priority === 'dispute'">争议</span>
            <span class="task-priority-tag priority-urgent" v-else-if="task.priority === 'urgent'">临期</span>
          </div>
          <p class="task-text">{{ task.text || '无描述' }}</p>
          <div class="task-meta">
            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-resolve" @click.stop="resolveTask(task)">标记已解决</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard'
import type { MyTask } from '@/types/models'

const router = useRouter()
const loading = ref(true)
const tasks = ref<MyTask[]>([])

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
  } catch (e) {
    console.error('[MyTasks] resolve failed', e)
  }
}

onMounted(async () => {
  try {
    const res = await dashboardApi.getMyTasks()
    tasks.value = res.data.data
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

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: $color-text-secondary;
  font-size: 14px;
  gap: 8px;

  .empty-icon { font-size: 48px; }
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
    .task-priority-bar { background: #ea4335; }
  }
  &.priority-urgent {
    border-color: rgba(#f9ab00, 0.3);
    .task-priority-bar { background: #f9ab00; }
  }
}

.task-priority-bar {
  width: 4px;
  height: 48px;
  border-radius: 2px;
  flex-shrink: 0;
}

.task-thumb {
  width: 48px;
  height: 48px;
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

.task-meta {
  margin-top: 4px;
  font-size: 12px;
  color: $color-text-muted;
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
</style>