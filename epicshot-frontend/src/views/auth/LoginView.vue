<template>
  <div class="auth-split">
    <!-- 左侧品牌展示 (桌面端) -->
    <div class="auth-brand">
      <div class="brand-pattern"></div>
      <div class="brand-content">
        <div class="brand-logo">
          <span class="brand-icon">EPX</span>
        </div>
        <h1 class="brand-name">易拍选</h1>
        <p class="brand-tagline">专业摄影审片协作平台</p>
        <ul class="brand-features">
          <li class="feature-item">
            <span class="feature-icon">💬</span>
            <div class="feature-text">
              <strong>告别微信轰炸</strong>
              <span>专业审片流程，告别混乱的微信群聊</span>
            </div>
          </li>
          <li class="feature-item">
            <span class="feature-icon">📱</span>
            <div class="feature-text">
              <strong>客户扫码即用</strong>
              <span>无需下载APP，微信扫码即可审片批注</span>
            </div>
          </li>
          <li class="feature-item">
            <span class="feature-icon">⚡</span>
            <div class="feature-text">
              <strong>效率提升60%</strong>
              <span>标注、对比、确稿，一站式完成</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- 右侧登录表单 -->
    <div class="auth-form-side">
      <div class="auth-form-card">
        <!-- 移动端紧凑品牌标识 -->
        <div class="mobile-brand">
          <h2 class="mobile-brand-name">易拍选</h2>
          <p class="mobile-brand-tagline">专业摄影审片协作平台</p>
        </div>

        <h2 class="form-heading">欢迎回来</h2>
        <p class="form-subheading">登录您的易拍选账号</p>

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

.auth-split {
  display: flex;
  min-height: 100vh;
}

/* ============ 左侧品牌区域 ============ */
.auth-brand {
  position: relative;
  width: 40%;
  background: $color-bg-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 60px 40px;
}

.brand-pattern {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba($color-primary, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba($color-primary-light, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba($color-primary, 0.04) 0%, transparent 70%);
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 380px;
  animation: fadeIn 0.5s ease;
}

.brand-logo {
  margin-bottom: 24px;
}

.brand-icon {
  display: inline-block;
  font-weight: 800;
  font-size: $font-2xl;
  color: $color-primary;
  letter-spacing: 3px;
}

.brand-name {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
}

.brand-tagline {
  font-size: $font-md;
  color: rgba(#fff, 0.6);
  margin: 0 0 48px 0;
  letter-spacing: 1px;
}

.brand-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.feature-icon {
  flex-shrink: 0;
  font-size: 24px;
  line-height: 1.3;
  width: 36px;
  text-align: center;
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    color: #fff;
    font-size: $font-base;
    font-weight: 600;
  }

  span {
    color: rgba(#fff, 0.55);
    font-size: $font-sm;
    line-height: 1.5;
  }
}

/* ============ 右侧表单区域 ============ */
.auth-form-side {
  width: 60%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  padding: 40px;
}

.auth-form-card {
  width: 100%;
  max-width: 420px;
  background: $color-surface;
  border-radius: $radius-xl;
  box-shadow: $shadow-lg;
  padding: 48px 40px;
  animation: fadeIn 0.4s ease;
}

.form-heading {
  font-size: $font-xl;
  font-weight: 700;
  color: $color-text;
  margin: 0 0 4px 0;
}

.form-subheading {
  font-size: $font-base;
  color: $color-text-muted;
  margin: 0 0 32px 0;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: $font-base;
  font-weight: 500;
  color: $color-text;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1.5px solid $color-border;
  border-radius: $radius-md;
  font-size: $font-base;
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
  font-size: $font-sm;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: rgba($color-error, 0.06);
  border-radius: $radius-sm;
}

.btn-primary {
  width: 100%;
  height: 48px;
  background: $color-primary;
  color: #fff;
  font-size: $font-md;
  font-weight: 600;
  border-radius: $radius-md;
  transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
  cursor: pointer;
  border: none;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
    box-shadow: 0 4px 12px rgba($color-primary, 0.35);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.form-footer {
  text-align: center;
  font-size: $font-base;
  color: $color-text-secondary;
  margin-top: 20px;
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
  right: 12px;
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

/* ============ 移动端品牌标识 (桌面端隐藏) ============ */
.mobile-brand {
  display: none;
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid $color-border;
}

.mobile-brand-name {
  font-size: 26px;
  font-weight: 700;
  color: $color-primary;
  margin: 0 0 4px 0;
  letter-spacing: 2px;
}

.mobile-brand-tagline {
  font-size: 13px;
  color: $color-text-muted;
  margin: 0;
}

/* ============ 响应式 ============ */
@media (max-width: 767px) {
  .auth-split {
    flex-direction: column;
  }

  .auth-brand {
    display: none;
  }

  .auth-form-side {
    width: 100%;
    min-height: 100vh;
    padding: 0;
    align-items: flex-start;
  }

  .auth-form-card {
    width: 100%;
    max-width: 100%;
    padding: 40px 24px 32px;
    box-shadow: none;
    border-radius: 0;
    background: transparent;
  }

  .mobile-brand {
    display: block;
  }

  .form-heading {
    font-size: 20px;
  }

  .form-subheading {
    font-size: 14px;
    margin-bottom: 24px;
  }

  .form-input {
    height: 46px;
    font-size: 16px; /* 防止iOS缩放 */
  }

  .btn-primary {
    height: 48px;
    font-size: 16px;
  }

  .form-footer {
    font-size: 14px;
    margin-top: 16px;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>