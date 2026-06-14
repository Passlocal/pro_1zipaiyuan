<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <span class="logo-icon">EPX</span>
        <h1 class="logo-text">易拍选</h1>
      </div>

      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'wechat' }"
          @click="activeTab = 'wechat'"
        >
          微信登录
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'email' }"
          @click="activeTab = 'email'"
        >
          邮箱登录
        </button>
      </div>

      <!-- 微信扫码登录 -->
      <div v-if="activeTab === 'wechat'" class="tab-content">
        <div class="qrcode-placeholder">
          <svg viewBox="0 0 200 200" width="200" height="200">
            <rect width="200" height="200" fill="#f1f3f4" />
            <text x="100" y="90" text-anchor="middle" fill="#9aa0a6" font-size="14">微信扫码</text>
            <text x="100" y="110" text-anchor="middle" fill="#9aa0a6" font-size="12">二维码加载中...</text>
          </svg>
        </div>
        <p class="qrcode-tip">请使用微信扫描二维码登录</p>
      </div>

      <!-- 邮箱登录 -->
      <form v-else class="tab-content" @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label" for="login-email">邮箱</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="请输入邮箱地址"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">密码</label>
          <div class="password-wrap">
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              placeholder="请输入密码"
              required
            />
            <button type="button" class="toggle-pwd" @click="showPassword = !showPassword" :title="showPassword ? '隐藏密码' : '显示密码'">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <div class="mock-hint" v-if="!apiUrl">
          Mock模式：任意邮箱密码即可登录<br/>管理员：<strong>zhang@epicshot.com</strong> / admin123
        </div>
        <div class="mock-hint" v-else>
          管理员账号：<strong>zhang@epicshot.com</strong> / admin123
        </div>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <p class="form-footer">
          还没有账号？<router-link to="/register" class="link">立即注册</router-link>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'wechat' | 'email'>('email')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const apiUrl = (import.meta.env.VITE_API_URL as string) || ''

async function handleLogin() {
  errorMsg.value = ''
  if (!email.value || !password.value) {
    errorMsg.value = '请填写邮箱和密码'
    return
  }
  loading.value = true
  try {
    await authStore.loginWithEmail(email.value, password.value)
    router.push('/')
  } catch (err: any) {
    console.error('[handleLogin]', err)
    errorMsg.value = err?.response?.data?.message || err?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: $color-bg;
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: $color-surface;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  padding: 40px 32px;
  animation: fadeIn 0.3s ease;
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;

  .logo-icon {
    font-weight: 800;
    font-size: 32px;
    color: $color-primary;
    letter-spacing: 2px;
  }

  .logo-text {
    font-size: 24px;
    font-weight: 600;
    color: $color-text;
    margin-top: 4px;
  }
}

.tabs {
  display: flex;
  border-bottom: 2px solid $color-border-light;
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  padding: 10px 0;
  font-size: 15px;
  font-weight: 500;
  color: $color-text-secondary;
  text-align: center;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.2s, border-color 0.2s;

  &:hover {
    color: $color-text;
  }

  &.active {
    color: $color-primary;
    border-bottom-color: $color-primary;
  }
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

.qrcode-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px auto;
  width: 200px;
  height: 200px;
  border-radius: $radius-md;
  overflow: hidden;
  background: $color-surface-hover;
}

.qrcode-tip {
  text-align: center;
  font-size: 13px;
  color: $color-text-secondary;
  margin-top: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  background: $color-surface;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
  }
}

.error-msg {
  color: $color-error;
  font-size: 13px;
  margin-bottom: 12px;
}

.btn-primary {
  width: 100%;
  height: 44px;
  background: $color-primary;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.form-footer {
  text-align: center;
  font-size: 14px;
  color: $color-text-secondary;
  margin-top: 16px;
}

.link {
  color: $color-primary;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.password-wrap {
  position: relative;
}

.toggle-pwd {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  &:hover { opacity: 1; }
}

.mock-hint {
  font-size: 12px;
  color: $color-primary;
  background: rgba($color-primary, 0.06);
  border: 1px solid rgba($color-primary, 0.15);
  border-radius: $radius-sm;
  padding: 8px 12px;
  margin-bottom: 12px;
  line-height: 1.6;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>