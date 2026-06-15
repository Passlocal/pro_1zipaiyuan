<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="not-found-illustration">EPX</div>
      <h1 class="not-found-code">404</h1>
      <p class="not-found-subtitle">抱歉，您访问的页面不存在</p>
      <p class="not-found-desc">页面可能已被移动、删除，或地址输入有误</p>
      <div class="not-found-actions">
        <router-link to="/" class="not-found-link primary">返回首页</router-link>
        <router-link to="/login" class="not-found-link secondary">重新登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: $color-bg;
  padding: 20px;
}

.not-found-content {
  text-align: center;
  max-width: 420px;
}

.not-found-illustration {
  font-size: 56px;
  font-weight: 800;
  color: $color-primary;
  letter-spacing: 3px;
  margin-bottom: 8px;
  opacity: 0.6;
}

.not-found-code {
  font-size: 96px;
  font-weight: 800;
  color: $color-text;
  line-height: 1;
  margin-bottom: 12px;
  letter-spacing: -3px;
  opacity: 0.9;
}

.not-found-subtitle {
  font-size: 20px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 8px;
}

.not-found-desc {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 32px;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.not-found-link {
  display: inline-block;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  text-decoration: none;
  transition: all 0.2s;

  &.primary {
    background: $color-primary;
    color: #fff;

    &:hover {
      background: $color-primary-dark;
    }
  }

  &.secondary {
    background: $color-surface-hover;
    color: $color-text-secondary;

    &:hover {
      background: $color-border-light;
      color: $color-text;
    }
  }
}
</style>