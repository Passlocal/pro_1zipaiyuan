<template>
  <teleport to="body">
    <transition-group name="toast" tag="div" class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" class="toast-item" :class="`toast-${toast.type}`">
        <span class="toast-icon">{{ iconMap[toast.type] }}</span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-dismiss" @click="removeToast(toast.id)">×</button>
      </div>
    </transition-group>
  </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

const toasts = ref<Toast[]>([])
let counter = 0

const iconMap: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
}

function show(message: string, type: ToastType = 'info', duration = 3000) {
  const id = `toast-${++counter}`
  toasts.value.push({ id, type, message })
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id: string) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function success(msg: string) { show(msg, 'success') }
function error(msg: string) { show(msg, 'error', 5000) }
function warning(msg: string) { show(msg, 'warning', 4000) }
function info(msg: string) { show(msg, 'info') }

defineExpose({ show, success, error, warning, info })
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 11000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: $radius-md;
  background: $color-surface;
  box-shadow: $shadow-lg;
  min-width: 280px;
  max-width: 420px;
  pointer-events: auto;
  font-size: 14px;
  border-left: 4px solid;

  &.toast-success { border-color: $color-success; }
  &.toast-error { border-color: $color-error; }
  &.toast-warning { border-color: $color-warning; }
  &.toast-info { border-color: $color-primary; }
}

.toast-icon {
  font-size: 16px;
  font-weight: 700;
  width: 20px;
  text-align: center;

  .toast-success & { color: $color-success; }
  .toast-error & { color: $color-error; }
  .toast-warning & { color: $color-warning; }
  .toast-info & { color: $color-primary; }
}

.toast-message { flex: 1; }

.toast-dismiss {
  color: $color-text-muted;
  font-size: 18px;
  opacity: 0.6;
  &:hover { opacity: 1; }
}

.toast-enter-active { animation: slideIn 0.3s ease; }
.toast-leave-active { animation: slideOut 0.2s ease; }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideOut {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(100%); }
}
</style>