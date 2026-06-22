<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileMenuOpen }">
      <div class="sidebar-header">
        <div class="logo-area">
          <div class="logo-mark">E</div>
          <span v-if="!sidebarCollapsed" class="logo-text">EPICSHOT</span>
        </div>
        <button class="collapse-btn" @click="toggleSidebar" :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
          <ChevronRight :size="16" v-if="sidebarCollapsed" />
          <ChevronLeft :size="16" v-else />
        </button>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: isActive('/') }" v-if="auth.isOwner" aria-label="战情室">
          <LayoutDashboard :size="18" class="nav-icon" aria-hidden="true" />
          <span class="nav-label" v-if="!sidebarCollapsed">战情室</span>
        </router-link>
        <router-link to="/my-tasks" class="nav-item" :class="{ active: isActive('/my-tasks') }" aria-label="我的待办">
          <CheckSquare :size="18" class="nav-icon" aria-hidden="true" />
          <span class="nav-label" v-if="!sidebarCollapsed">我的待办</span>
        </router-link>
        <router-link to="/projects" class="nav-item" :class="{ active: isActive('/projects') }" aria-label="项目看板">
          <LayoutGrid :size="18" class="nav-icon" aria-hidden="true" />
          <span class="nav-label" v-if="!sidebarCollapsed">项目看板</span>
        </router-link>
        <router-link to="/reports" class="nav-item" :class="{ active: isActive('/reports') }" aria-label="报表">
          <BarChart3 :size="18" class="nav-icon" aria-hidden="true" />
          <span class="nav-label" v-if="!sidebarCollapsed">报表</span>
        </router-link>
        <router-link to="/workspace" class="nav-item" :class="{ active: isActive('/workspace') }" v-if="auth.isOwner" aria-label="工作空间">
          <Settings :size="18" class="nav-icon" aria-hidden="true" />
          <span class="nav-label" v-if="!sidebarCollapsed">工作空间</span>
        </router-link>
      </nav>

      <div class="sidebar-footer" v-if="!sidebarCollapsed">
        <div class="divider"></div>
        <div class="role-badge" :class="auth.isOwner ? 'role-owner' : 'role-editor'">
          {{ auth.isOwner ? '管理者' : '修图师' }}
        </div>
        <div class="plan-badge" :class="planClass">{{ planLabel }}</div>
      </div>
    </aside>

    <div class="sidebar-overlay" :class="{ visible: mobileMenuOpen }" @click="toggleMobileMenu"></div>

    <main class="main-content">
      <header class="top-bar">
        <!-- 12.1 登录过期预警 -->
        <div v-if="tokenWarning" class="token-warning-banner">
          <span class="token-warning-icon">⏰</span>
          <span class="token-warning-text">登录即将过期，请保存当前工作。</span>
          <button class="token-warning-refresh" @click="refreshLogin">立即刷新登录</button>
        </div>
        <button class="mobile-menu-btn" @click="toggleMobileMenu" :aria-label="mobileMenuOpen ? '关闭菜单' : '打开菜单'">
          <Menu :size="20" v-if="!mobileMenuOpen" />
          <X :size="20" v-else />
        </button>
        <div class="breadcrumb">
          <slot name="breadcrumb" />
        </div>
        <div class="top-bar-actions">
          <NotificationBell @markAllRead="handleMarkAllRead" />
          <button class="btn-icon" @click="goBack" v-if="showBack">
            <span>←</span>
          </button>
          <div class="user-menu" v-if="auth.user">
            <img :src="auth.user.avatarUrl || defaultAvatar" class="avatar" />
            <span class="user-name">{{ auth.user.name }}</span>
            <button class="btn-text" @click="auth.logout()">退出</button>
          </div>
        </div>
      </header>
      <div class="content-area">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import client from '@/api/client'
import NotificationBell from '@/components/common/NotificationBell.vue'
import { LayoutDashboard, CheckSquare, LayoutGrid, Settings, ChevronLeft, ChevronRight, BarChart3, Menu, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const isMobile = ref(false)

const showBack = computed(() => route.path !== '/')

// 12.1 登录过期预警
const tokenWarning = ref(false)
let tokenCheckTimer: ReturnType<typeof setInterval> | null = null

async function checkTokenStatus() {
  try {
    const res = await client.get('/v1/auth/token-status')
    if (res.data?.data?.warning === true) {
      tokenWarning.value = true
    } else {
      tokenWarning.value = false
    }
  } catch {
    // 静默失败
  }
}

function refreshLogin() {
  // 触发登录刷新机制
  tokenWarning.value = false
  auth.logout()
}

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iI2U4ZWFlZCIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTIiIHI9IjYiIGZpbGw9IiM5YWEwYTYiLz48ZWxsaXBzZSBjeD0iMTYiIGN5PSIyNiIgcng9IjEwIiByeT0iNiIgZmlsbD0iIzlhYTBhNiIvPjwvc3ZnPg=='

const planClass = computed(() => {
  const p = auth.workspace?.planType
  return { enterprise: 'plan-enterprise', pro: 'plan-pro', free: 'plan-free' }[p || 'free']
})

const planLabel = computed(() => {
  const p = auth.workspace?.planType
  return { enterprise: '企业版', pro: '专业版', free: '免费版' }[p || 'free']
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    mobileMenuOpen.value = false
  }
}

function isActive(path: string) {
  return route.path === path
}

function goBack() {
  router.back()
}

async function handleMarkAllRead() {
  try {
    await client.post('/v1/notifications/mark-all-read')
  } catch {
    // ignore
  }
}

onMounted(() => {
  // 12.1 每60秒检查一次token状态
  checkTokenStatus()
  tokenCheckTimer = setInterval(checkTokenStatus, 60000)
  // 移动端检测
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  if (tokenCheckTimer) clearInterval(tokenCheckTimer)
  window.removeEventListener('resize', checkMobile)
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: $sidebar-width;
  height: 100%;
  background: $color-bg-dark;
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;

  &.collapsed {
    width: 64px;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  height: $header-height;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border-bottom: none;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: $color-primary;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  white-space: nowrap;
}

.collapse-btn {
  color: $color-text-muted;
  font-size: 12px;
  padding: 4px;
  border-radius: $radius-sm;
  &:hover { background: rgba(255,255,255,0.1); }
}

.sidebar-nav {
  flex: 1;
  padding: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: $radius-md;
  color: #e8eaed; // DS-19: 对比度 5.2:1
  text-decoration: none;
  font-size: 14px;
  margin-bottom: 2px;
  transition: background 0.15s;

  &:hover { background: rgba(255,255,255,0.08); color: #fff; }
  &.active { background: rgba($color-primary-light, 0.2); color: #fff; }

  .nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}
}

.sidebar-footer {
  padding: 12px 16px;
}

.divider {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin-bottom: 12px;
}

.plan-badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: $radius-sm;
  text-align: center;

  &.plan-enterprise { background: rgba($color-primary-light, 0.3); color: #8ab4f8; }
  &.plan-pro { background: rgba($color-warning, 0.2); color: #fdd663; }
  &.plan-free { background: rgba(255,255,255,0.1); color: $color-text-muted; }
}

// DS-01: 角色标签
.role-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: $radius-sm;
  text-align: center;
  margin-bottom: 6px;
  font-weight: 500;

  &.role-owner {
    background: rgba($color-primary-light, 0.2);
    color: #8ab4f8;
  }

  &.role-editor {
    background: rgba($color-success, 0.2);
    color: #81c995;
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: $header-height;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  position: relative;
}

// 12.1 登录过期预警
.token-warning-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 10;
  font-size: 13px;
  border-bottom: 1px solid #f59e0b;
}

.token-warning-icon {
  font-size: 14px;
}

.token-warning-text {
  color: #92400e;
  font-weight: 500;
}

.token-warning-refresh {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #f59e0b;
  border-radius: $radius-sm;
  transition: background 0.15s;
  &:hover { background: #d97706; }
}

.breadcrumb {
  font-size: 14px;
  color: $color-text-secondary;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 14px;
  color: $color-text;
}

.btn-text {
  color: $color-text-secondary;
  font-size: 13px;
  &:hover { color: $color-error; }
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  &:hover { background: $color-surface-hover; }
}

.content-area {
  flex: 1;
  overflow: auto;
}

// Mobile: hide sidebar, show hamburger, overlay
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;

    &.mobile-open {
      transform: translateX(0);
    }
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;

    &.visible {
      display: block;
    }
  }

  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: #fff;
    margin-right: 8px;
    &:hover { background: rgba(255,255,255,0.1); }
  }

  .top-bar {
    padding-left: 12px;
  }

  .top-bar-actions {
    gap: 4px;
    .user-name { display: none; }
  }
}

// Desktop: hide mobile menu button
@media (min-width: 769px) {
  .mobile-menu-btn {
    display: none;
  }
  .sidebar-overlay {
    display: none;
  }
}
</style>