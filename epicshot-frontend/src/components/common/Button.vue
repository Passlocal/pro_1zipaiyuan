<template>
  <div class="epx-btn" :class="[`btn-${variant}`, `btn-${size}`, { 'btn-loading': loading, 'btn-block': block }]"
    :disabled="disabled || loading" @click="$emit('click')">
    <span class="btn-spinner" v-if="loading"></span>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'medium'
})

defineEmits<{
  click: []
}>()
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.epx-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: $radius-md;
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.15s;
  cursor: pointer;
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.btn-small { padding: 4px 12px; font-size: 13px; height: 30px; }
  &.btn-medium { padding: 8px 16px; font-size: 14px; height: 36px; }
  &.btn-large { padding: 10px 24px; font-size: 15px; height: 44px; }
  &.btn-block { width: 100%; }

  &.btn-primary {
    background: $color-primary;
    color: #fff;
    &:hover:not(:disabled) { background: $color-primary-dark; }
  }

  &.btn-secondary {
    background: $color-surface;
    color: $color-text;
    border-color: $color-border;
    &:hover:not(:disabled) { background: $color-surface-hover; }
  }

  &.btn-danger {
    background: $color-error;
    color: #fff;
    &:hover:not(:disabled) { background: darken($color-error, 8%); }
  }

  &.btn-ghost {
    background: transparent;
    color: $color-text-secondary;
    &:hover:not(:disabled) { background: $color-surface-hover; }
  }

  &.btn-loading {
    position: relative;
    color: transparent;

    .btn-spinner {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>