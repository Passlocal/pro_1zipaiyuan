<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <span class="logo-icon">EPX</span>
        <h1 class="logo-text">易拍选</h1>
      </div>

      <form class="tab-content" @submit.prevent="handleLogin">
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
            <button type="button" class="toggle-pwd" @click="showPassword = !showPassword" :title="showPassword ? '隐藏密码' : '显示密码'" :aria-label="showPassword ? '隐藏密码' : '显示密码'">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <p class="form-footer">
          还没有账号？<router-link to="/register" class="link">立即注册</router-link>
          <span class="footer-divider">|</span>
          <a href="#" class="link link--muted" @click.prevent="onForgotPassword">忘记密码</a>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  if (!email.value || !password.value) {
    errorMsg.value = '请填写邮箱和密码'
    return
  }
  loading.value = true
  try {
    await authStore.loginWithEmail(email.value, password.value)
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (err: any) {
    console.error('[handleLogin]', err)
    errorMsg.value = err?.response?.data?.message || err?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

async function onForgotPassword() {
  errorMsg.value = '请联系管理员重置密码：zhang@epicshot.com'
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

.tab-content {
  animation: fadeIn 0.2s ease;
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

  &--muted {
    color: $color-text-muted;
    font-weight: 400;
  }
}

.footer-divider {
  margin: 0 8px;
  color: $color-text-muted;
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

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>