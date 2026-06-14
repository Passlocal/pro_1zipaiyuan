<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1 class="not-found-code">404</h1>
      <p class="not-found-subtitle">页面未找到</p>
      <router-link to="/" class="not-found-link">返回首页</router-link>
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
}

.not-found-code {
  font-size: 120px;
  font-weight: 800;
  color: $color-text;
  line-height: 1;
  margin-bottom: 12px;
  letter-spacing: -4px;
}

.not-found-subtitle {
  font-size: 18px;
  color: $color-text-secondary;
  margin-bottom: 32px;
}

.not-found-link {
  display: inline-block;
  padding: 10px 28px;
  background: $color-primary;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  text-decoration: none;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
    text-decoration: none;
  }
}
</style>