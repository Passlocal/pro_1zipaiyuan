<template>
  <div class="war-room">
    <!-- DS-02: 健康度警报横幅 -->
    <div v-if="alertBannerVisible" class="alert-banner">
      <AlertTriangle :size="18" class="alert-icon-svg" />
      <span class="alert-text">
        {{ stats.red }} 个项目需要关注（{{ stats.red }} 红灯<span v-if="stats.yellow"> · {{ stats.yellow }} 黄灯</span>）
      </span>
    </div>

    <!-- 统计卡片 -->
    <section class="stats-row">
      <StatCard :value="stats.total" label="全部项目" clickable @click="drillToProjects({})" />
      <StatCard :value="stats.active" label="进行中" variant="active" @click="drillToProjects({ filter: 'active' })" />
      <StatCard :value="stats.red" label="红灯预警" variant="red" />
      <StatCard :value="stats.yellow" label="黄灯提醒" variant="yellow" />
      <StatCard :value="stats.totalUnresolved" label="待处理意见" />
      <StatCard variant="profit" label="总利润">
        <template #value>
          <span :class="analytics.profit >= 0 ? '' : 'text-red'">¥{{ analytics.profit >= 0 ? '+' : '' }}{{ analytics.profit.toLocaleString() }}</span>
        </template>
      </StatCard>
    </section>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'health' }"
        @click="activeTab = 'health'"
      >项目健康度</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'member' }"
        @click="activeTab = 'member'"
      >成员负载</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'analytics' }"
        @click="activeTab = 'analytics'"
      >数据看板</button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      <Transition name="tab-fade" mode="out-in">
        <!-- 项目健康度看板 -->
        <section v-if="activeTab === 'health'" key="health" class="panel panel--projects">
          <h2 class="panel-title">
            <span class="dot dot--red"></span>
            <span class="dot dot--yellow"></span>
            <span class="dot dot--green"></span>
            项目健康度
            <button class="btn-help" @click.stop="healthRulesVisible = !healthRulesVisible">?</button>
            <button class="btn-help btn-gear" @click.stop="showAlertRulesModal = true" title="配置告警规则">
              <Settings :size="14" />
            </button>
          </h2>
          <div v-if="healthRulesVisible" class="health-rules-popover">
            <p><span class="dot dot--red"></span> 红灯：严重超期 / 存在争议 / 客户卡顿超过阈值</p>
            <p><span class="dot dot--yellow"></span> 黄灯：即将到期 / 有未读反馈</p>
            <p><span class="dot dot--green"></span> 绿灯：一切正常</p>
            <p class="health-rules-thresholds">阈值：黄灯 {{ alertRules.yellowInactiveDays }}天 / {{ alertRules.yellowOverdueCards }}张，红灯 {{ alertRules.redInactiveDays }}天 / {{ alertRules.redOverdueCards }}张</p>
          </div>
          <div v-if="loading" class="loading-state skeleton-war-room">
            <div class="skeleton-stats">
              <div v-for="i in 5" :key="'stat-' + i" class="skeleton skeleton-stat-card"></div>
            </div>
            <div class="skeleton-projects">
              <div v-for="i in 3" :key="'proj-' + i" class="skeleton skeleton-project-row"></div>
            </div>
          </div>
          <div v-else-if="projects.length === 0" class="empty-state">
            <div class="empty-illustration">
              <span class="empty-icon">📸</span>
            </div>
            <h3 class="empty-title">开始你的第一个项目</h3>
            <p class="empty-desc">创建项目后，这里将显示项目健康度、团队负载和关键指标</p>
            <button class="btn-primary-empty" @click="router.push('/projects')">
              + 创建第一个项目
              <span class="btn-arrow">→</span>
            </button>
            <div class="onboarding-steps">
              <div class="step-card">
                <span class="step-num">①</span>
                <span class="step-title">创建项目</span>
                <span class="step-desc">设置项目名称、截止日期和客户信息</span>
              </div>
              <div class="step-card">
                <span class="step-num">②</span>
                <span class="step-title">上传图片</span>
                <span class="step-desc">按产品单元组织图片，支持批量上传</span>
              </div>
              <div class="step-card">
                <span class="step-num">③</span>
                <span class="step-title">分享给客户</span>
                <span class="step-desc">生成分享链接，客户在微信中即可审片</span>
              </div>
            </div>
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
              <!-- DATA-05: 催稿状态图标 -->
              <span
                v-if="nudgeStatusMap[proj.id]"
                class="nudge-status-icon"
                :class="'nudge-status--' + nudgeStatusMap[proj.id]"
                :title="nudgeStatusLabel(nudgeStatusMap[proj.id])"
              >{{ nudgeStatusIcon(nudgeStatusMap[proj.id]) }}</span>
              <button
                v-if="proj.health === 'red' || proj.health === 'yellow'"
                class="btn-nudge"
                :class="{ 'btn-nudge--done': nudgeStatus[proj.id]?.done }"
                :disabled="nudgeStatus[proj.id]?.loading || nudgeStatus[proj.id]?.done"
                @click.stop="nudgeClient(proj)"
              >
                <template v-if="nudgeStatus[proj.id]?.done">✓ 已催稿 {{ nudgeStatus[proj.id]?.time }}</template>
                <template v-else-if="nudgeStatus[proj.id]?.loading">催稿中...</template>
                <template v-else>提醒客户</template>
              </button>
            </div>
          </div>
        </section>

        <!-- 成员负载 -->
        <section v-else-if="activeTab === 'member'" key="member" class="panel panel--members">
          <h2 class="panel-title">成员负载</h2>
          <div v-if="loading" class="loading-state skeleton-war-room">
            <div class="skeleton-members">
              <div v-for="i in 3" :key="'member-' + i" class="skeleton skeleton-member-row"></div>
            </div>
          </div>
          <div v-else class="member-list">
            <div v-for="m in memberLoads" :key="m.id" class="member-row" @click="toggleMemberDetail(m.id)">
              <div class="member-avatar">{{ m.name.charAt(0) }}</div>
              <div class="member-info">
                <span class="member-name">{{ m.name }}</span>
                <span class="member-role">{{ m.role === 'owner' ? '拥有者' : '编辑者' }}</span>
              </div>
              <div class="member-load">
                <span class="load-count">{{ m.taskCount }} / {{ memberLoadLimit }}</span>
                <span class="load-label">待办</span>
              </div>
              <div v-if="expandedMember === m.id" class="member-detail">
                <div v-for="task in m.tasks" :key="task.id" class="member-task">
                  <span class="task-project">{{ task.projectName }}</span>
                  <span class="task-type">{{ task.type }}</span>
                  <span class="task-deadline" :class="{ 'task-urgent': task.urgent }">{{ task.deadline }}</span>
                </div>
                <div v-if="!m.tasks?.length" class="member-no-tasks">暂无任务</div>
              </div>
            </div>
          </div>
        </section>

        <!-- UX-23: 数据看板 -->
        <div v-else-if="activeTab === 'analytics' && showAnalytics" key="analytics" class="analytics-panel">
          <div class="panel-header">
            <h3>数据看板</h3>
            <div class="panel-period-row">
              <input
                type="month"
                class="month-selector"
                :value="analyticsMonth"
                @change="onMonthChange"
              />
            </div>
          </div>
          <div class="analytics-grid">
            <div class="analytics-card" @click="drillToProjects({ filter: 'total' })" title="点击查看本月项目">
              <span class="analytics-value">{{ analytics.totalProjects }}</span>
              <span class="analytics-label">本月项目数</span>
            </div>
            <div class="analytics-card" @click="drillToProjects({ filter: 'avgReview' })" title="点击查看本月项目">
              <span class="analytics-value">{{ analytics.avgReviewDays }}天</span>
              <span class="analytics-label">平均确稿周期</span>
            </div>
            <div class="analytics-card" @click="drillToProjects({ filter: 'completion' })" title="点击查看本月项目">
              <span class="analytics-value">{{ analytics.completionRate }}%</span>
              <span class="analytics-label">按时完成率</span>
            </div>
            <div class="analytics-card" @click="drillToProjects({ filter: 'images' })" title="点击查看本月项目">
              <span class="analytics-value">{{ analytics.totalImages }}</span>
              <span class="analytics-label">处理图片数</span>
            </div>
            <!-- DATA-06: 营收和利润 KPI -->
            <div class="analytics-card analytics-card--revenue">
              <span class="analytics-value">¥{{ analytics.revenue?.toLocaleString() || '0' }}</span>
              <span class="analytics-label">本月营收</span>
            </div>
            <div class="analytics-card analytics-card--profit">
              <span class="analytics-value" :class="{ 'profit-negative': analytics.profit < 0 }">¥{{ analytics.profit?.toLocaleString() || '0' }}</span>
              <span class="analytics-label">本月利润</span>
            </div>
          </div>
          <div class="analytics-subtitle">修图师效率排行</div>
          <div class="efficiency-list">
            <div v-for="(member, idx) in analytics.memberEfficiency" :key="member.id" class="efficiency-row" @click="toggleMemberAnalyticsDetail(member.id)">
              <span class="efficiency-rank">#{{ idx + 1 }}</span>
              <span class="efficiency-name">{{ member.name }}</span>
              <div class="efficiency-bar-wrap">
                <div class="efficiency-bar" :style="{ width: (member.efficiency / analytics.maxEfficiency * 100) + '%' }"></div>
              </div>
              <span class="efficiency-score">{{ member.efficiency }}张/天</span>
            </div>
            <div v-if="expandedAnalyticsMember" class="member-analytics-detail">
              <div v-if="memberDetailLoading" class="member-detail-loading">加载中...</div>
              <div v-else-if="memberDetailData.length > 0" class="member-detail-cards">
                <div v-for="item in memberDetailData" :key="item.id" class="member-detail-card-item">
                  <span class="detail-card-project">{{ item.projectName }}</span>
                  <span class="detail-card-status" :class="'status-' + item.status">{{ item.statusLabel }}</span>
                  <span class="detail-card-count">{{ item.cardCount }} 张卡片</span>
                </div>
              </div>
              <div v-else class="member-detail-empty">暂无本月处理数据</div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- FB-006: 告警规则配置模态框 -->
    <div v-if="showAlertRulesModal" class="modal-overlay" @click.self="showAlertRulesModal = false">
      <div class="modal-content modal-alert-rules">
        <h3 class="modal-title">告警规则配置</h3>
        <div class="alert-rules-form">
          <div class="alert-rule-group">
            <h4 class="alert-rule-group-title">项目活动告警</h4>
            <div class="alert-rule-row">
              <label class="alert-rule-label">
                <span class="dot dot--yellow"></span> 黄灯警告：无活动天数
              </label>
              <input type="number" v-model.number="alertRules.yellowInactiveDays" class="form-input alert-rule-input" min="1" />
              <span class="alert-rule-unit">天</span>
            </div>
            <div class="alert-rule-row">
              <label class="alert-rule-label">
                <span class="dot dot--red"></span> 红灯告警：无活动天数
              </label>
              <input type="number" v-model.number="alertRules.redInactiveDays" class="form-input alert-rule-input" min="1" />
              <span class="alert-rule-unit">天</span>
            </div>
          </div>
          <div class="alert-rule-group">
            <h4 class="alert-rule-group-title">卡片积压告警</h4>
            <div class="alert-rule-row">
              <label class="alert-rule-label">
                <span class="dot dot--yellow"></span> 黄灯警告：逾期卡片数
              </label>
              <input type="number" v-model.number="alertRules.yellowOverdueCards" class="form-input alert-rule-input" min="0" />
              <span class="alert-rule-unit">张</span>
            </div>
            <div class="alert-rule-row">
              <label class="alert-rule-label">
                <span class="dot dot--red"></span> 红灯告警：逾期卡片数
              </label>
              <input type="number" v-model.number="alertRules.redOverdueCards" class="form-input alert-rule-input" min="0" />
              <span class="alert-rule-unit">张</span>
            </div>
          </div>
        </div>
        <div class="alert-rules-actions">
          <button class="btn-cancel" @click="showAlertRulesModal = false">取消</button>
          <button class="btn-confirm" @click="saveAlertRules">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import client from '@/api/client'
import { dashboardApi } from '@/api/dashboard'
import { PROJECT_STATUS_LABELS } from '@/types/models'
import type { DashboardStats, ProjectHealth, MemberLoad } from '@/types/models'
import { AlertTriangle, Settings } from 'lucide-vue-next'
import StatCard from '@/components/common/StatCard.vue'

const router = useRouter()
const loading = ref(true)
const stats = ref<DashboardStats>({ total: 0, active: 0, red: 0, yellow: 0, totalUnresolved: 0 })
const projects = ref<ProjectHealth[]>([])
const memberLoads = ref<MemberLoad[]>([])
const healthRulesVisible = ref(false)
const memberLoadLimit = ref(15)
const nudgeStatus = reactive<Record<string, { loading?: boolean; done?: boolean; time?: string }>>({})
// DATA-05: 催稿已读状态追踪
const nudgeStatusMap = ref<Record<string, string>>({})

// FB-006: 告警规则配置
const showAlertRulesModal = ref(false)
const alertRules = reactive({
  yellowInactiveDays: 7,
  redInactiveDays: 14,
  yellowOverdueCards: 5,
  redOverdueCards: 10,
})

async function loadAlertRules() {
  try {
    const res = await client.get('/v1/workspace/alert-rules')
    if (res.data?.data) {
      const data = res.data.data
      alertRules.yellowInactiveDays = data.yellowInactiveDays ?? 7
      alertRules.redInactiveDays = data.redInactiveDays ?? 14
      alertRules.yellowOverdueCards = data.yellowOverdueCards ?? 5
      alertRules.redOverdueCards = data.redOverdueCards ?? 10
    }
  } catch {
    // use defaults
  }
}

async function saveAlertRules() {
  try {
    await client.put('/v1/workspace/alert-rules', {
      yellowInactiveDays: alertRules.yellowInactiveDays,
      redInactiveDays: alertRules.redInactiveDays,
      yellowOverdueCards: alertRules.yellowOverdueCards,
      redOverdueCards: alertRules.redOverdueCards,
    })
    showAlertRulesModal.value = false
  } catch (e) {
    console.error('保存告警规则失败:', e)
  }
}

function nudgeStatusIcon(status: string): string {
  const map: Record<string, string> = { sent: '📨', viewed: '👁', reviewing: '✏️' }
  return map[status] || ''
}

function nudgeStatusLabel(status: string): string {
  const map: Record<string, string> = { sent: '已发送催稿', viewed: '客户已查看', reviewing: '客户审阅中' }
  return map[status] || ''
}

async function fetchNudgeStatus(projectId: string) {
  try {
    const res = await client.get(`/v1/projects/${projectId}/nudge-status`)
    if (res.data?.data?.status) {
      nudgeStatusMap.value[projectId] = res.data.data.status
    }
  } catch {
    // ignore
  }
}

const expandedMember = ref<string | null>(null)

// UX-23: 数据看板
const showAnalytics = ref(true)
const activeTab = ref('health')
const analytics = ref({
  totalProjects: 0,
  avgReviewDays: 0,
  completionRate: 0,
  totalImages: 0,
  maxEfficiency: 0,
  memberEfficiency: [] as Array<{ id: string; name: string; efficiency: number }>,
  // DATA-06: 营收和利润
  revenue: 0,
  profit: 0,
})
const analyticsLoading = ref(false)
const analyticsMonth = ref(new Date().toISOString().slice(0, 7))

function onMonthChange(e: Event) {
  const target = e.target as HTMLInputElement
  analyticsMonth.value = target.value
  fetchAnalytics()
}

function toggleMemberDetail(memberId: string) {
  expandedMember.value = expandedMember.value === memberId ? null : memberId
}

// DS-02: 警报横幅是否显示
const alertBannerVisible = computed(() => stats.value.red > 0 || stats.value.yellow > 0)

function statusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] || status
}

function goToProject(id: string) {
  router.push('/project/' + id)
}

async function nudgeClient(proj: ProjectHealth) {
  if (nudgeStatus[proj.id]?.loading || nudgeStatus[proj.id]?.done) return
  nudgeStatus[proj.id] = { loading: true }
  try {
    await client.post(`/v1/projects/${proj.id}/nudge`)
    const now = new Date()
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
    nudgeStatus[proj.id] = { done: true, time }
    // DATA-05: 更新催稿状态为已发送
    nudgeStatusMap.value[proj.id] = 'sent'
  } catch (e) {
    console.error('[WarRoom] nudge failed', e)
    delete nudgeStatus[proj.id]
  }
}

onMounted(async () => {
  try {
    const res = await dashboardApi.getDashboard()
    const data = res.data.data
    stats.value = data.stats
    projects.value = data.projects
    memberLoads.value = data.memberLoads
    // DATA-05: 获取每个项目的催稿状态
    data.projects.forEach((proj: ProjectHealth) => {
      fetchNudgeStatus(proj.id)
    })
    // FB-006: 加载告警规则
    loadAlertRules()
  } catch (e) {
    console.error('[WarRoom] load failed', e)
  } finally {
    loading.value = false
  }

  // DATA-02: 加载数据看板真实数据
  fetchAnalytics()

  // load member load limit from workspace
  try {
    const wsRes = await client.get('/v1/workspace')
    if (wsRes.data?.data?.memberLoadLimit) {
      memberLoadLimit.value = wsRes.data.data.memberLoadLimit
    }
  } catch {
    // ignore, use default 15
  }
})

async function fetchAnalytics() {
  analyticsLoading.value = true
  try {
    const res = await client.get('/v1/analytics/dashboard', { params: { month: analyticsMonth.value } })
    if (res.data?.data) {
      analytics.value = { ...analytics.value, ...res.data.data }
    }
    // DATA-06: 同时请求财务数据
    const financeRes = await client.get('/v1/analytics/finance', { params: { month: analyticsMonth.value } })
    if (financeRes.data?.data) {
      analytics.value.revenue = financeRes.data.data.totalRevenue
      analytics.value.profit = financeRes.data.data.totalProfit
    }
  } catch (e) {
    console.error('[WarRoom] analytics load failed', e)
  } finally {
    analyticsLoading.value = false
  }
}

// UX-34: 数据看板下钻
function drillToProjects(params: Record<string, string>) {
  const query = new URLSearchParams({ month: analyticsMonth.value, ...params }).toString()
  router.push('/projects?' + query)
}

// UX-34: 效率排行展开成员详情
const expandedAnalyticsMember = ref<string | null>(null)
const memberDetailData = ref<Array<{ id: string; projectName: string; status: string; statusLabel: string; cardCount: number }>>([])
const memberDetailLoading = ref(false)

async function toggleMemberAnalyticsDetail(memberId: string) {
  if (expandedAnalyticsMember.value === memberId) {
    expandedAnalyticsMember.value = null
    memberDetailData.value = []
    return
  }
  expandedAnalyticsMember.value = memberId
  memberDetailLoading.value = true
  memberDetailData.value = []
  try {
    const res = await client.get('/v1/analytics/member-detail', {
      params: { month: analyticsMonth.value, memberId }
    })
    if (res.data?.data) {
      memberDetailData.value = res.data.data
    }
  } catch (e) {
    console.error('[WarRoom] member detail load failed', e)
  } finally {
    memberDetailLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.war-room {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}

// ===== 统计卡片（紧凑版） =====
.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 12px 16px;
  border: 1px solid $color-border-light;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: $color-text;
  }
  .stat-label {
    font-size: 12px;
    color: $color-text-secondary;
  }

  &--active { border-top: 3px solid $color-primary; }
  &--red { border-top: 3px solid #ea4335; .stat-value { color: #ea4335; font-weight: 800; } }
  &--yellow { border-top: 3px solid #f9ab00; .stat-value { color: #f9ab00; } }
}

// DS-02: 警报横幅
.alert-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #fef7f6;
  border: 1px solid #f5c6cb;
  border-radius: $radius-md;
  margin-bottom: 16px;
  font-size: 14px;
  color: #c5221f;
  font-weight: 500;

  .alert-icon-svg {
    color: #c5221f;
    flex-shrink: 0;
  }
}

// ===== Tab 导航栏 =====
.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 2px solid $color-border-light;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-secondary;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;

  &:hover {
    color: $color-text;
  }

  &.active {
    color: $color-primary;
    border-bottom-color: $color-primary;
    font-weight: 600;
  }
}

// ===== Tab 内容区域 =====
.tab-content {
  min-height: 200px;
}

// Tab 切换淡入淡出动画
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}

// ===== Panel 通用样式 =====
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

  &.health-red {
    border-left: 3px solid #ea4335;
    border-color: rgba(#ea4335, 0.3);
    background: rgba(#ea4335, 0.06);
    .project-name { font-weight: 600; color: #c5221f; }
  }
  &.health-yellow {
    border-color: rgba(#f9ab00, 0.3);
    background: rgba(#f9ab00, 0.04);
  }
}

.health-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  &.green { background: #34a853; }
  &.yellow { background: #f9ab00; }
  &.red {
    background: #ea4335;
    animation: pulse-glow 1.5s infinite;
    box-shadow: 0 0 6px rgba(#ea4335, 0.4);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(#ea4335, 0.4); }
  50% { opacity: 0.5; box-shadow: 0 0 12px rgba(#ea4335, 0.7); }
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

// 健康度规则弹窗
.btn-help {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid $color-border;
  background: $color-surface-hover;
  color: $color-text-secondary;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  transition: all 0.15s;

  &:hover {
    background: $color-border-light;
    color: $color-text;
  }
}

.health-rules-popover {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: $shadow-md;

  p {
    font-size: 13px;
    color: $color-text;
    line-height: 1.8;
    margin: 0;
  }
}

// 催稿按钮
.btn-nudge {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  color: $color-primary;
  background: rgba($color-primary, 0.08);
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: $radius-sm;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba($color-primary, 0.15);
    border-color: $color-primary;
  }

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
}

.btn-nudge--done {
  color: #137333;
  background: #e6f4ea;
  border-color: #a8dab5;
  animation: popIn 0.3s ease;
}

// DATA-05: 催稿状态图标
.nudge-status-icon {
  flex-shrink: 0;
  font-size: 16px;
  margin-right: 4px;
  cursor: default;
  opacity: 0.6;

  &.nudge-status--sent {
    color: #999;
  }
  &.nudge-status--viewed {
    color: #1a73e8;
    opacity: 1;
  }
  &.nudge-status--reviewing {
    color: #34a853;
    opacity: 1;
  }
}

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
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
  cursor: pointer;
  flex-wrap: wrap;
  &:last-child { border-bottom: none; }
  &:hover { background: rgba(0,0,0,0.02); }
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

.member-detail {
  padding: 8px 12px 12px;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  width: 100%;
}

.member-task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  font-size: 12px;
}

.task-project { flex: 1; color: #333; }
.task-type { color: #666; }
.task-deadline { color: #999; }
.task-urgent { color: #ea4335; font-weight: 600; }
.member-no-tasks { font-size: 12px; color: #999; padding: 4px 0; }

// UX-23: 数据看板
.analytics-panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h3 { margin: 0; font-size: 15px; font-weight: 600; }
}

.panel-period-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-selector {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  color: #333;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: #1a73e8;
  }
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.analytics-card {
  text-align: center;
  padding: 16px 12px;
  background: #fafbfc;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border-color: #1a73e8;
  }
}

.analytics-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #1a73e8;
}

.analytics-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

// DATA-06: 营收和利润 KPI 卡片
.analytics-card--revenue {
  .analytics-value { color: #34a853; }
}

.analytics-card--profit {
  .analytics-value { color: #34a853; }
  .profit-negative { color: #ea4335; }
}

.analytics-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.efficiency-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.efficiency-rank {
  font-size: 13px;
  font-weight: 600;
  color: #1a73e8;
  width: 24px;
}

.efficiency-name {
  font-size: 13px;
  width: 60px;
  flex-shrink: 0;
}

.efficiency-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.efficiency-bar {
  height: 100%;
  background: linear-gradient(90deg, #1a73e8, #4a9af5);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.efficiency-score {
  font-size: 12px;
  color: #666;
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

// UX-34: 成员详情展开面板
.member-analytics-detail {
  padding: 8px 12px 12px;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}

.member-detail-loading {
  font-size: 12px;
  color: #999;
  text-align: center;
  padding: 8px 0;
}

.member-detail-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-detail-card-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  font-size: 12px;
}

.detail-card-project {
  flex: 1;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-card-status {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  &.status-in_progress { background: #e8f0fe; color: #1a73e8; }
  &.status-completed { background: #e6f4ea; color: #137333; }
  &.status-review { background: #fef7e0; color: #e37400; }
}

.detail-card-count {
  color: #999;
  flex-shrink: 0;
}

.member-detail-empty {
  font-size: 12px;
  color: #999;
  text-align: center;
  padding: 8px 0;
}

// DS-05: 空状态重新设计
// EMO-03: 骨架屏替换加载状态
.skeleton-war-room {
  padding: 0;
}

.skeleton-stats {
  display: flex;
  gap: 16px;
}

.skeleton-stat-card {
  width: 120px;
  height: 80px;
  flex-shrink: 0;
}

.skeleton-projects {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.skeleton-project-row {
  width: 100%;
  height: 60px;
}

.skeleton-members {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-member-row {
  width: 100%;
  height: 52px;
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
  padding: 40px 0;
  text-align: center;
  color: $color-text-secondary;
  font-size: 14px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  max-width: 640px;
  margin: 0 auto;

  .empty-illustration {
    margin-bottom: 20px;

    .empty-icon {
      font-size: 64px;
      opacity: 0.5;
    }
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: $color-primary;
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    border-radius: $radius-md;
    transition: all 0.2s;
    margin-bottom: 32px;

    .btn-arrow {
      transition: transform 0.2s;
    }

    &:hover {
      background: $color-primary-dark;

      .btn-arrow {
        transform: translateX(4px);
      }
    }
  }

  .onboarding-steps {
    display: flex;
    gap: 16px;
    justify-content: center;

    .step-card {
      flex: 1;
      max-width: 180px;
      padding: 16px 12px;
      background: $color-surface-hover;
      border-radius: $radius-md;
      border: 1px solid $color-border-light;

      .step-num {
        display: inline-block;
        width: 28px;
        height: 28px;
        line-height: 28px;
        border-radius: 50%;
        background: $color-primary;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .step-title {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: $color-text;
        margin-bottom: 4px;
      }

      .step-desc {
        font-size: 12px;
        color: $color-text-secondary;
        line-height: 1.4;
      }
    }
  }

  @media (max-width: 768px) {
    .onboarding-steps {
      flex-direction: column;
      align-items: center;

      .step-card {
        width: 100%;
        max-width: 100%;
      }
    }
  }
}

// V1.19: 利润汇总
.stat-card--profit {
  border-top: 3px solid #34a853;
  .stat-value { color: #34a853; }
}
.text-red { color: #ea4335 !important; }

// ===== FB-006: 告警规则配置 =====
.btn-gear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: #e8e8e8;
  }
}
.health-rules-thresholds {
  font-size: 11px;
  color: #888;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #eee;
}
.modal-alert-rules {
  max-width: 480px;
}
.alert-rules-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.alert-rule-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.alert-rule-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}
.alert-rule-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.alert-rule-label {
  flex: 1;
  font-size: 13px;
  color: #555;
  display: flex;
  align-items: center;
  gap: 6px;
}
.alert-rule-input {
  width: 70px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}
.alert-rule-unit {
  font-size: 13px;
  color: #999;
  min-width: 24px;
}
.alert-rules-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

@media (max-width: 768px) {
  .stats-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .stat-card {
    flex: 1 1 calc(33.33% - 8px);
    min-width: 90px;
  }
  
  .tab-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0;
  }
  
  .tab-btn {
    padding: 10px 14px;
    font-size: 13px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .alert-banner {
    padding: 10px 12px;
    font-size: 13px;
  }
  
  .project-row {
    flex-wrap: wrap;
    padding: 12px;
    gap: 8px;
  }
  
  .project-info {
    flex: 1 1 60%;
  }
  
  .project-counts {
    flex: 1 1 40%;
    justify-content: flex-end;
  }
  
  .btn-nudge {
    flex: 0 0 auto;
    min-height: 44px;
  }
  
  .member-row {
    flex-wrap: wrap;
    padding: 12px;
    gap: 8px;
  }
  
  .analytics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .efficiency-row {
    padding: 10px 12px;
  }
  
  .modal-content {
    width: 95vw;
    max-width: 95vw;
  }
}
</style>