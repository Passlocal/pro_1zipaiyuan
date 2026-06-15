<template>
  <teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="closeOnOverlay && $emit('close')">
      <div class="modal-container" :class="[sizeClass]" ref="containerRef" role="dialog" aria-modal="true" :aria-labelledby="title ? 'modal-title' : undefined" @click.stop>
        <div class="modal-header" v-if="title || $slots.header">
          <h3 class="modal-title" id="modal-title">{{ title }}</h3>
          <button class="modal-close" @click="$emit('close')" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div class="modal-footer" v-if="$slots.footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  size?: 'small' | 'medium' | 'large'
  closeOnOverlay?: boolean
}>(), {
  size: 'medium',
  closeOnOverlay: true
})

const emit = defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const sizeClass = computed(() => `modal-${props.size}`)

// Focus trap: cycle Tab within modal, restore focus on close
let lastFocusedEl: HTMLElement | null = null

function getFocusables(): HTMLElement[] {
  if (!containerRef.value) return []
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(containerRef.value.querySelectorAll(sel)) as HTMLElement[]
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key === 'Tab') {
    const els = getFocusables()
    if (els.length === 0) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    lastFocusedEl = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
    // Focus first focusable element or the close button
    requestAnimationFrame(() => {
      const els = getFocusables()
      if (els.length > 0) els[0].focus()
    })
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus()
    }
  }
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  background: $color-surface;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s ease;

  &.modal-small { width: 400px; }
  &.modal-medium { width: 560px; }
  &.modal-large { width: 760px; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid $color-border-light;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  font-size: 22px;
  color: $color-text-secondary;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  &:hover { background: $color-surface-hover; }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid $color-border-light;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>