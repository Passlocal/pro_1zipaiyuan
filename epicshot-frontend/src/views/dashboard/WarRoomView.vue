<template>
  <div class="war-room">
    <!-- 统计卡片 -->
    <section class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">全部项目</span>
      </div>
      <div class="stat-card stat-card--active">
        <span class="stat-value">{{ stats.active }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-card stat-card--red">
        <span class="stat-value">{{ stats.red }}</span>
        <span class="stat-label">红灯预警</span>
      </div>
      <div class="stat-card stat-card--yellow">
        <span class="stat-value">{{ stats.yellow }}</span>
        <span class="stat-label">黄灯提醒</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalUnresolved }}</span>
        <span class="stat-label">待处理意见</span>
      </div>
    </section>

    <div class="war-room-grid">
      <!-- 项目健康度看板 -->
      <section class="panel panel--projects">
        <h2 class="panel-title">
          <span class="dot dot--red"></span>
          <span class="dot dot--yellow"></span>
          <span class="dot dot--green"></span>
          项目健康度
        </h2>
        <div v-if="loading" class="loading-state">加载中...</div>
        <div v-else-if="projects.length === 0" class="empty-state">
          <p>暂无进行中的项目</p>
        </div>
        <div v-else class="project-list">
          <div
            v-for="proj in projects"
            :key="proj.id"
            class="project-row"
            :class="'health-' + proj.health"
            @click="goToProject(proj.id)"
          >
            <div class="health-indicator" :class="proj.health"></div>
            <div class="project-info">
              <div class="project-name">{{ proj.name }}</div>
              <div class="project-meta">
                <span class="client-name">{{ proj.clientName || '未命名客户' }}</span>
                <span class="status-badge">{{ statusLabel(proj.status) }}</span>
              </div>
              <div v-if="proj.healthReasons.length" class="health-reasons">
                <span v-for="(reason, i) in proj.healthReasons" :key="i" class="reason-tag">{{ reason }}</span>
              </div>
            </div>
            <div class="project-counts">
              <span v-if="proj.unresolvedCount" class="count-badge">{{ proj.unresolvedCount }} 待处理</span>
              <span v-if="proj.disputedCount" class="count-badge count-badge--dispute">{{ proj.disputedCount }} 争议</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 成员负载 -->
      <section class="panel panel--members">
        <h2 class="panel-title">成员负载</h2>
        <div v-if="loading" class="loading-state">加载中...</div>
        <div v-else class="member-list">
          <div v-for="m in memberLoads" :key="m.id" class="member-row">
            <div class="member-avatar">{{ m.name.charAt(0) }}</div>
            <div class="member-info">
              <span class="member-name">{{ m.name }}</span>
              <span class="member-role">{{ m.role === 'owner' ? '拥有者' : '编辑者' }}</span>
            </div>
            <div class="member-load">
              <span class="load-count">{{ m.taskCount }}</span>
              <span class="load-label">待办</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard'
import { PROJECT_STATUS_LABELS } from '@/types/models'
import type { DashboardStats, ProjectHealth, MemberLoad } from '@/types/models'

const router = useRouter()
const loading = ref(true)
const stats = ref<DashboardStats>({ total: 0, active: 0, red: 0, yellow: 0, totalUnresolved: 0 })
const projects = ref<ProjectHealth[]>([])
const memberLoads = ref<MemberLoad[]>([])

function statusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] || status
}

function goToProject(id: string) {
  router.push('/project/' + id)
}

onMounted(async () => {
  try {
    const res = await dashboardApi.getDashboard()
    const data = res.data.data
    stats.value = data.stats
    projects.value = data.projects
    memberLoads.value = data.memberLoads
  } catch (e) {
    console.error('[WarRoom] load failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.war-room {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  flex: 1;
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 20px 24px;
  border: 1px solid $color-border-light;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: $color-text;
  }
  .stat-label {
    font-size: 13px;
    color: $color-text-secondary;
  }

  &--active { border-left: 3px solid $color-primary; }
  &--red { border-left: 3px solid #ea4335; .stat-value { color: #ea4335; } }
  &--yellow { border-left: 3px solid #f9ab00; .stat-value { color: #f9ab00; } }
}

.war-room-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}

.panel {
  background: $color-surface;
  border-radius: $radius-lg;
  border: 1px solid $color-border-light;
  padding: 20px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &--red { background: #ea4335; }
  &--yellow { background: #f9ab00; }
  &--green { background: #34a853; }
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: $radius-md;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;

  &:hover { background: $color-surface-hover; }

  &.health-red { border-color: rgba(#ea4335, 0.3); background: rgba(#ea4335, 0.04); }
  &.health-yellow { border-color: rgba(#f9ab00, 0.3); background: rgba(#f9ab00, 0.04); }
}

.health-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  &.green { background: #34a853; }
  &.yellow { background: #f9ab00; }
  &.red { background: #ea4335; animation: pulse 1.5s infinite; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $color-text-secondary;
}

.status-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: $color-surface-hover;
  font-size: 11px;
}

.health-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.reason-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #fce8e6;
  color: #c5221f;
}

.project-counts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.count-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: $color-surface-hover;
  color: $color-text-secondary;

  &--dispute {
    background: #fce8e6;
    color: #c5221f;
  }
}

// 成员负载
.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid $color-border-light;
  &:last-child { border-bottom: none; }
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: $color-primary;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  display: block;
}

.member-role {
  font-size: 12px;
  color: $color-text-secondary;
}

.member-load {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.load-count {
  font-size: 18px;
  font-weight: 700;
  color: $color-text;
}

.load-label {
  font-size: 11px;
  color: $color-text-muted;
}

.loading-state, .empty-state {
  padding: 40px 0;
  text-align: center;
  color: $color-text-secondary;
  font-size: 14px;
}

@media (max-width: 1024px) {
  .war-room-grid {
    grid-template-columns: 1fr;
  }
}
</style>