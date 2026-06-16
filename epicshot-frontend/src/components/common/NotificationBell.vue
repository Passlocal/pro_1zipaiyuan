<template>
  <div class="notification-bell" ref="bellRef">
    <button class="bell-btn" @click="toggle" :class="{ active: showDropdown }">
      <span class="bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

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
          :class="{ unread: !n.isRead, ['type-' + n.type]: true }"
          @click="handleClick(n)"
        >
          <div class="notif-icon">{{ typeIcon(n.type) }}</div>
          <div class="notif-body">
            <div class="notif-title">{{ n.title }}</div>
            <div class="notif-content">{{ n.content }}</div>
            <div class="notif-time">{{ formatTime(n.createdAt) }}</div>
          </div>
          <div v-if="!n.isRead" class="notif-dot"></div>
        </div>
      </div>

      <div v-else class="notification-empty">
        <span>暂无通知</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard'
import type { Notification } from '@/types/models'

const router = useRouter()
const showDropdown = ref(false)
const unreadCount = ref(0)
const notifications = ref<Notification[]>([])
const bellRef = ref<HTMLElement | null>(null)

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    annotation: '💬', dispute: '⚠️', deadline: '⏰',
    status_change: '📌', mention: '👋', assign: '📋', confirm_request: '✅'
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
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  // 初次加载未读数
  dashboardApi.getNotifications(1, 0).then(r => { unreadCount.value = r.data.unread }).catch(() => {})
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

.notification-dropdown {
  position: absolute;
  top: 44px;
  right: 0;
  width: 380px;
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
</style>