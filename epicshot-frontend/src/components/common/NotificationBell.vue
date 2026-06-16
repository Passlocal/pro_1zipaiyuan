<template>
  <div class="notification-bell" ref="bellRef">
    <button class="bell-btn" @click="toggle" :class="{ active: showDropdown }">
      <span class="bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <!-- 8.1 偏好设置齿轮图标 -->
    <button class="bell-gear-btn" @click.stop="showPrefPanel = !showPrefPanel" title="通知偏好">
      <span>⚙️</span>
    </button>

    <!-- 8.1 通知偏好面板 -->
    <div v-if="showPrefPanel" class="pref-panel" @click.stop>
      <div class="pref-panel-header">
        <span class="pref-panel-title">通知偏好设置</span>
        <button class="pref-close" @click="showPrefPanel = false">✕</button>
      </div>

      <div class="pref-section" v-for="section in prefSections" :key="section.key">
        <h4 class="pref-section-title">{{ section.label }}</h4>
        <div class="pref-toggle-row" v-for="toggle in section.toggles" :key="toggle.key">
          <span class="pref-toggle-label">{{ toggle.label }}</span>
          <button
            class="pref-toggle"
            :class="{ active: prefSettings[section.key]?.[toggle.key] }"
            @click="togglePref(section.key, toggle.key)"
          >
            <span class="pref-toggle-knob"></span>
          </button>
        </div>
      </div>

      <div class="pref-panel-actions">
        <button class="btn-pref-save" :disabled="savingPrefs" @click="savePrefs">
          {{ savingPrefs ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="showDropdown" class="notification-dropdown">
      <div class="dropdown-header">
        <span class="dropdown-title">通知 ({{ unreadCount }} 条未读)</span>
        <button v-if="unreadCount > 0" class="btn-mark-all" @click="markAllRead">全部已读</button>
      </div>

      <div class="notification-list" v-if="notifications.length > 0">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="notification-item"
          :class="{ unread: !n.isRead }"
          @click="handleClick(n)"
        >
          <div class="notif-icon">{{ typeIcon(n.type) }}</div>
          <div class="notif-body">
            <div class="notif-title">{{ n.title }}</div>
            <!-- 8.3 内容可视化通知 -->
            <div class="notif-content" v-html="enrichContent(n)"></div>
            <div class="notif-time">{{ formatTime(n.createdAt) }}</div>
          </div>
          <div v-if="!n.isRead" class="notif-dot"></div>

          <!-- 8.2 快捷处理按钮 -->
          <div v-if="n.type === 'modify_request'" class="notif-quick-actions" @click.stop>
            <button
              class="btn-quick-approve"
              :disabled="quickActionLoading[n.id]"
              @click="quickAction(n.id, 'approve')"
            >
              {{ quickActionLoading[n.id] === 'approve' ? '...' : '同意驳回' }}
            </button>
            <button
              class="btn-quick-reject"
              :disabled="quickActionLoading[n.id]"
              @click="quickAction(n.id, 'reject')"
            >
              {{ quickActionLoading[n.id] === 'reject' ? '...' : '拒绝' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="notification-empty">
        <span>暂无通知</span>
      </div>
    </div>

    <!-- 快捷操作确认弹窗 -->
    <div v-if="confirmQuickAction" class="quick-confirm-overlay" @click.self="confirmQuickAction = null">
      <div class="quick-confirm-card">
        <p class="quick-confirm-text">确认{{ confirmQuickAction.action === 'approve' ? '同意驳回' : '拒绝' }}此修改请求？</p>
        <div class="quick-confirm-actions">
          <button class="btn-cancel" @click="confirmQuickAction = null">取消</button>
          <button class="btn-confirm" @click="executeQuickAction">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard'
import client from '@/api/client'
import type { Notification } from '@/types/models'

const router = useRouter()
const showDropdown = ref(false)
const unreadCount = ref(0)
const notifications = ref<Notification[]>([])
const bellRef = ref<HTMLElement | null>(null)

// 8.1 偏好设置
const showPrefPanel = ref(false)
const savingPrefs = ref(false)
const prefSettings = ref<Record<string, Record<string, boolean>>>({
  in_app: { assign: true, dispute: true, mention: true, status: true, system: true },
  email: { assign: true, dispute: true, mention: true },
  wechat: { assign: true, dispute: true },
})

const prefSections = [
  {
    key: 'in_app',
    label: '站内通知',
    toggles: [
      { key: 'assign', label: '任务指派' },
      { key: 'dispute', label: '争议预警' },
      { key: 'mention', label: '提及' },
      { key: 'status', label: '状态变更' },
      { key: 'system', label: '系统通知' },
    ],
  },
  {
    key: 'email',
    label: '邮件通知',
    toggles: [
      { key: 'assign', label: '任务指派' },
      { key: 'dispute', label: '争议预警' },
      { key: 'mention', label: '提及' },
    ],
  },
  {
    key: 'wechat',
    label: '微信通知',
    toggles: [
      { key: 'assign', label: '任务指派' },
      { key: 'dispute', label: '争议预警' },
    ],
  },
]

// 8.2 快捷操作
const quickActionLoading = ref<Record<string, string>>({})
const confirmQuickAction = ref<{ id: string; action: string } | null>(null)

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    annotation: '💬', dispute: '⚠️', deadline: '⏰',
    status_change: '📌', mention: '👋', assign: '📋', confirm_request: '✅',
    modify_request: '✏️',
  }
  return icons[type] || '📌'
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z')
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}

// 8.3 内容可视化：解析通知内容，提取上下文信息
function enrichContent(n: Notification): string {
  let content = n.content
  // 高亮图片索引和批注内容
  content = content.replace(/【图(\d+)】/g, '<strong class="notif-highlight-img">【图$1】</strong>')
  // 高亮：后面的内容
  content = content.replace(/：(.+)/, '：<em class="notif-highlight-text">$1</em>')
  // 批注关键词
  content = content.replace(/批注(：|:)/g, '<span class="notif-keyword">批注</span>$1')
  return content
}

function toggle() {
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) loadNotifications()
}

function handleClick(n: Notification) {
  if (!n.isRead) {
    dashboardApi.markNotificationRead(n.id)
    n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  showDropdown.value = false
  if (n.link) router.push(n.link)
}

async function markAllRead() {
  await dashboardApi.markAllNotificationsRead()
  notifications.value.forEach(n => n.isRead = true)
  unreadCount.value = 0
}

async function loadNotifications() {
  try {
    const res = await dashboardApi.getNotifications(20, 0)
    notifications.value = res.data.data
    unreadCount.value = res.data.unread
  } catch { /* ignore */ }
}

function onDocClick(e: MouseEvent) {
  if (bellRef.value && !bellRef.value.contains(e.target as Node)) {
    showDropdown.value = false
    showPrefPanel.value = false
  }
}

// 8.1 偏好设置
function togglePref(sectionKey: string, toggleKey: string) {
  if (!prefSettings.value[sectionKey]) {
    prefSettings.value[sectionKey] = {}
  }
  prefSettings.value[sectionKey][toggleKey] = !prefSettings.value[sectionKey]?.[toggleKey]
}

async function fetchPrefs() {
  try {
    const res = await client.get('/v1/user/notification-preferences')
    if (res.data?.data) {
      prefSettings.value = res.data.data
    }
  } catch { /* ignore */ }
}

async function savePrefs() {
  savingPrefs.value = true
  try {
    await client.put('/v1/user/notification-preferences', prefSettings.value)
    showPrefPanel.value = false
  } catch { /* ignore */ }
  finally {
    savingPrefs.value = false
  }
}

// 8.2 快捷处理
function quickAction(notifId: string, action: string) {
  confirmQuickAction.value = { id: notifId, action }
}

async function executeQuickAction() {
  if (!confirmQuickAction.value) return
  const { id, action } = confirmQuickAction.value
  confirmQuickAction.value = null
  quickActionLoading.value[id] = action
  try {
    await client.post(`/v1/notifications/${id}/quick-action`, { action })
    // 标记为已读
    const n = notifications.value.find(x => x.id === id)
    if (n && !n.isRead) {
      n.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  } catch { /* ignore */ }
  finally {
    delete quickActionLoading.value[id]
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  dashboardApi.getNotifications(1, 0).then(r => { unreadCount.value = r.data.unread }).catch(() => {})
  fetchPrefs()
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.notification-bell {
  position: relative;
}

.bell-btn {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  &:hover { background: $color-surface-hover; }
  &.active { background: $color-surface-hover; }
}

.bell-icon {
  font-size: 18px;
}

.bell-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: $color-error;
  border-radius: 8px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 8.1 偏好设置齿轮
.bell-gear-btn {
  position: absolute;
  top: 6px;
  right: -28px;
  width: 24px;
  height: 24px;
  font-size: 12px;
  color: $color-text-muted;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background: $color-surface-hover; color: $color-text-secondary; }
}

// 8.1 偏好面板
.pref-panel {
  position: absolute;
  top: 44px;
  right: -28px;
  width: 320px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  z-index: 101;
  padding: 16px;
}

.pref-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.pref-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.pref-close {
  font-size: 14px;
  color: $color-text-muted;
  padding: 2px 6px;
  &:hover { color: $color-text; }
}

.pref-section {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border-light;

  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.pref-section-title {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-secondary;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.pref-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.pref-toggle-label {
  font-size: 13px;
  color: $color-text;
}

.pref-toggle {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: $color-border-light;
  position: relative;
  transition: background 0.2s;

  &.active {
    background: $color-primary;
  }

  .pref-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    transition: left 0.2s;
  }

  &.active .pref-toggle-knob {
    left: 20px;
  }
}

.pref-panel-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.btn-pref-save {
  padding: 6px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  &:hover:not(:disabled) { background: $color-primary-dark; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.notification-dropdown {
  position: absolute;
  top: 44px;
  right: 0;
  width: 400px;
  max-height: 480px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.dropdown-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.btn-mark-all {
  font-size: 12px;
  color: $color-primary;
  &:hover { text-decoration: underline; }
}

.notification-list {
  overflow-y: auto;
  flex: 1;
}

.notification-item {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid $color-border-light;
  flex-wrap: wrap;

  &:hover { background: $color-surface-hover; }
  &.unread { background: rgba($color-primary, 0.04); }
}

.notif-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 2px;
}

.notif-content {
  font-size: 12px;
  color: $color-text-secondary;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;

  // 8.3 内容可视化样式
  :deep(.notif-highlight-img) {
    color: $color-primary;
    font-weight: 600;
  }

  :deep(.notif-highlight-text) {
    color: $color-text;
    font-style: normal;
    background: rgba($color-warning, 0.15);
    padding: 0 2px;
    border-radius: 2px;
  }

  :deep(.notif-keyword) {
    color: $color-primary;
    font-weight: 600;
  }
}

.notif-time {
  font-size: 11px;
  color: $color-text-muted;
  margin-top: 4px;
}

.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-primary;
  flex-shrink: 0;
  margin-top: 4px;
}

.notification-empty {
  padding: 40px 0;
  text-align: center;
  color: $color-text-muted;
  font-size: 13px;
}

// 8.2 快捷操作按钮
.notif-quick-actions {
  width: 100%;
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid $color-border-light;
}

.btn-quick-approve {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  font-weight: 500;
  color: $color-success;
  border: 1px solid $color-success;
  border-radius: $radius-sm;
  transition: all 0.15s;
  &:hover:not(:disabled) { background: rgba($color-success, 0.08); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.btn-quick-reject {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  font-weight: 500;
  color: $color-error;
  border: 1px solid $color-error;
  border-radius: $radius-sm;
  transition: all 0.15s;
  &:hover:not(:disabled) { background: rgba($color-error, 0.08); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

// 快捷确认弹窗
.quick-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.quick-confirm-card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 24px 28px;
  text-align: center;
  max-width: 320px;
}

.quick-confirm-text {
  font-size: 14px;
  color: $color-text;
  margin-bottom: 20px;
}

.quick-confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
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
  background: $color-primary;
  border-radius: $radius-md;
  &:hover { background: $color-primary-dark; }
}
</style>