<template>
  <div class="stat-card" :class="[`stat-card--${variant}`]" @click="$emit('click')" :role="clickable ? 'button' : undefined" :tabindex="clickable ? 0 : undefined">
    <span class="stat-value" :class="valueClass">
      <slot name="value">{{ value }}</slot>
    </span>
    <span class="stat-label">
      <slot name="label">{{ label }}</slot>
    </span>
    <span v-if="trend" class="stat-trend" :class="trend > 0 ? 'trend-up' : 'trend-down'">
      {{ trend > 0 ? '↑' : '↓' }}{{ Math.abs(trend) }}%
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'active' | 'red' | 'yellow' | 'profit'
  value?: string | number
  label?: string
  valueClass?: string
  trend?: number
  clickable?: boolean
}>(), {
  variant: 'default'
})

defineEmits<{
  click: []
}>()
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.stat-card {
  flex: 1;
  min-width: 100px;
  padding: 12px 16px;
  background: $color-surface;
  border-radius: $radius-md;
  border: 1px solid $color-border-light;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: box-shadow 0.15s, border-color 0.15s;

  &[role="button"] {
    cursor: pointer;
    &:hover {
      box-shadow: $shadow-sm;
      border-color: $color-border;
    }
  }
}

.stat-value {
  font-size: $font-xl;
  font-weight: 700;
  color: $color-text;
  line-height: 1.2;
}

.stat-label {
  font-size: $font-xs;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-trend {
  font-size: $font-xs;
  margin-top: 2px;
  &.trend-up { color: $color-success; }
  &.trend-down { color: $color-error; }
}

// Variants
.stat-card--active {
  border-color: $color-primary;
  .stat-value { color: $color-primary; }
}

.stat-card--red {
  border-color: $color-error;
  background: rgba($color-error, 0.04);
  .stat-value { color: $color-error; }
}

.stat-card--yellow {
  border-color: $color-warning;
  background: rgba($color-warning, 0.04);
  .stat-value { color: $color-warning; }
}

.stat-card--profit {
  border-color: $color-success;
  background: rgba($color-success, 0.04);
  .stat-value { color: $color-success; }
}
</style>