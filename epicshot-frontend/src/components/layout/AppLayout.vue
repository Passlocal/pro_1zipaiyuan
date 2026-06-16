<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo" v-if="!sidebarCollapsed">
          <span class="logo-icon">EPX</span>
          <span class="logo-text">易拍选</span>
        </div>
        <div class="logo logo-compact" v-else>EPX</div>
        <button class="collapse-btn" @click="toggleSidebar">
          <span class="icon">{{ sidebarCollapsed ? '▶' : '◀' }}</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: isActive('/') }">
          <span class="nav-icon">🏠</span>
          <span class="nav-label" v-if="!sidebarCollapsed">战情室</span>
        </router-link>
        <router-link to="/my-tasks" class="nav-item" :class="{ active: isActive('/my-tasks') }">
          <span class="nav-icon">✅</span>
          <span class="nav-label" v-if="!sidebarCollapsed">我的待办</span>
        </router-link>
        <router-link to="/projects" class="nav-item" :class="{ active: isActive('/projects') }">
          <span class="nav-icon">📋</span>
          <span class="nav-label" v-if="!sidebarCollapsed">项目看板</span>
        </router-link>
        <router-link to="/workspace" class="nav-item" :class="{ active: isActive('/workspace') }">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label" v-if="!sidebarCollapsed">工作空间</span>
        </router-link>
      </nav>

      <div class="sidebar-footer" v-if="!sidebarCollapsed">
        <div class="divider"></div>
        <div class="plan-badge" :class="planClass">{{ planLabel }}</div>
      </div>
    </aside>

    <main class="main-content">
      <header class="top-bar">
        <div class="breadcrumb">
          <slot name="breadcrumb" />
        </div>
        <div class="top-bar-actions">
          <NotificationBell />
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
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import NotificationBell from '@/components/common/NotificationBell.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const sidebarCollapsed = ref(false)

const showBack = computed(() => route.path !== '/')

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

function isActive(path: string) {
  return route.path === path
}

function goBack() {
  router.back()
}
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

.logo {
  display: flex;
  align-items: center;
  gap: 8px;

  .logo-icon {
    font-weight: 800;
    font-size: 18px;
    color: $color-primary-light;
    letter-spacing: 1px;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 600;
  }
}

.logo-compact {
  font-weight: 800;
  font-size: 16px;
  color: $color-primary-light;
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
  color: #bdc1c6;
  text-decoration: none;
  font-size: 14px;
  margin-bottom: 2px;
  transition: background 0.15s;

  &:hover { background: rgba(255,255,255,0.08); color: #e8eaed; }
  &.active { background: rgba($color-primary-light, 0.2); color: #fff; }

  .nav-icon { font-size: 18px; }
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
</style>