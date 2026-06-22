<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <span class="logo-icon">EPX</span>
        <h1 class="logo-text">易拍选</h1>
      </div>

      <h2 class="title">创建账号</h2>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label class="form-label" for="reg-name">姓名</label>
          <input
            id="reg-name"
            v-model="name"
            type="text"
            class="form-input"
            placeholder="请输入姓名"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-email">邮箱</label>
          <input
            id="reg-email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="请输入邮箱地址"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-password">密码</label>
          <div class="password-wrap">
            <input
              id="reg-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'input-error': password.length > 0 && password.length < 6 }"
              placeholder="请输入密码（至少6位）"
              required
            />
            <button type="button" class="toggle-pwd" @click="showPassword = !showPassword" :title="showPassword ? '隐藏密码' : '显示密码'">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
          <p v-if="password.length > 0 && password.length < 6" class="field-hint error">密码长度至少6位</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-confirm">确认密码</label>
          <div class="password-wrap">
            <input
              id="reg-confirm"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'input-error': confirmPassword.length > 0 && password !== confirmPassword }"
              placeholder="请再次输入密码"
              required
            />
            <button type="button" class="toggle-pwd" @click="showConfirmPassword = !showConfirmPassword" :title="showConfirmPassword ? '隐藏密码' : '显示密码'">
              {{ showConfirmPassword ? '🙈' : '👁' }}
            </button>
          </div>
          <p v-if="confirmPassword.length > 0 && password !== confirmPassword" class="field-hint error">两次输入的密码不一致</p>
          <p v-else-if="confirmPassword.length > 0 && password === confirmPassword" class="field-hint success">密码匹配</p>
        </div>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
        <p class="form-footer">
          已有账号？<router-link to="/login" class="link">立即登录</router-link>
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

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(): boolean {
  errorMsg.value = ''

  if (!name.value.trim()) {
    errorMsg.value = '请输入姓名'
    return false
  }
  if (!email.value.trim()) {
    errorMsg.value = '请输入邮箱地址'
    return false
  }
  if (!emailRegex.test(email.value)) {
    errorMsg.value = '请输入正确的邮箱格式'
    return false
  }
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return false
  }
  if (password.value.length < 6) {
    errorMsg.value = '密码长度至少6位'
    return false
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致'
    return false
  }

  return true
}

async function handleRegister() {
  if (!validate()) return

  loading.value = true
  try {
    await authStore.register(email.value, password.value, name.value)
    router.push('/')
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message || '注册失败，请重试'
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
  margin-bottom: 24px;

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

.title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  text-align: center;
  margin-bottom: 24px;
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

.field-hint {
  font-size: 12px;
  margin-top: 4px;

  &.error {
    color: $color-error;
  }

  &.success {
    color: $color-success;
  }
}

.input-error {
  border-color: $color-error !important;

  &:focus {
    box-shadow: 0 0 0 3px rgba($color-error, 0.15) !important;
  }
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

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .auth-page {
    padding: 24px 16px;
    align-items: flex-start;
  }
  
  .auth-card {
    padding: 32px 20px;
    width: 100%;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  .auth-header {
    margin-bottom: 16px;

    .logo-icon {
      font-size: 26px;
    }

    .logo-text {
      font-size: 20px;
    }
  }
  
  .title {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  .form-input {
    height: 46px;
    font-size: 16px; /* 防止iOS缩放 */
  }
  
  .btn-primary {
    height: 48px;
    font-size: 16px;
    width: 100%;
  }

  .form-footer {
    font-size: 14px;
    margin-top: 12px;
  }
}
</style>