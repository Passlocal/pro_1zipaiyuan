<template>
  <teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="closeOnOverlay && $emit('close')">
      <div class="modal-container" :class="[sizeClass]" @click.stop>
        <div class="modal-header" v-if="title || $slots.header">
          <h3 class="modal-title">{{ title }}</h3>
          <button class="modal-close" @click="$emit('close')">×</button>
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
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  size?: 'small' | 'medium' | 'large'
  closeOnOverlay?: boolean
}>(), {
  size: 'medium',
  closeOnOverlay: true
})

defineEmits<{
  close: []
}>()

const sizeClass = computed(() => `modal-${props.size}`)
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