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
            <button type="button" class="toggle-pwd" @click="showPassword = !showPassword" :title="showPassword ? '隐藏密码' : '显示密码'">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <div class="divider">
          <span class="divider-text">或</span>
        </div>
        <button type="button" class="btn-wechat" @click="openWechatLogin" :disabled="loading">
          <span class="wechat-icon">💬</span>
          微信扫码登录
        </button>
        <p class="form-footer">
          还没有账号？<router-link to="/register" class="link">立即注册</router-link>
          <span class="footer-divider">|</span>
          <a href="#" class="link link--muted" @click.prevent="onForgotPassword">忘记密码</a>
        </p>
      </form>

      <!-- WeChat QR Modal -->
      <div v-if="showWechatModal" class="wechat-modal-overlay" @click.self="showWechatModal = false">
        <div class="wechat-modal">
          <button class="wechat-modal-close" @click="showWechatModal = false">&times;</button>
          <h3 class="wechat-modal-title">微信扫码登录</h3>
          <div v-if="wechatPolling" class="wechat-qr-wrap">
            <img v-if="wechatQrCode" :src="wechatQrCode" alt="微信二维码" class="wechat-qr-img" />
            <div v-else class="wechat-qr-loading">
              <span class="spinner"></span>
              <p>加载中...</p>
            </div>
            <p class="wechat-hint">请使用微信扫描二维码</p>
          </div>
          <div v-else-if="wechatExpired" class="wechat-expired">
            <span>二维码已过期</span>
            <button class="btn-refresh" @click="refreshWechatQr">刷新二维码</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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
const showWechatModal = ref(false)
const wechatQrCode = ref('')
const wechatTicket = ref('')
const wechatPolling = ref(false)
const wechatExpired = ref(false)

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

async function openWechatLogin() {
  showWechatModal.value = true
  wechatExpired.value = false
  wechatQrCode.value = ''
  try {
    const qrRes = await authStore.loginWithWechatPreflight()
    wechatQrCode.value = qrRes.qrcodeDataUrl
    wechatTicket.value = qrRes.ticket
    startWechatPolling()
  } catch (e: any) {
    errorMsg.value = '微信登录初始化失败'
    showWechatModal.value = false
  }
}

function startWechatPolling() {
  wechatPolling.value = true

  const TIMEOUT_MS = 90_000 // 90 seconds timeout
  const startTime = Date.now()

  authStore.loginWithWechat().then(() => {
    wechatPolling.value = false
    showWechatModal.value = false
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  }).catch((err: Error) => {
    wechatPolling.value = false
    wechatExpired.value = true
    wechatQrCode.value = ''
    errorMsg.value = err.message
  })

  // Fallback timeout: if polling hangs forever
  setTimeout(() => {
    if (wechatPolling.value && Date.now() - startTime >= TIMEOUT_MS) {
      wechatPolling.value = false
      wechatExpired.value = true
      wechatQrCode.value = ''
    }
  }, TIMEOUT_MS)
}

function onWechatKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showWechatModal.value) {
    showWechatModal.value = false
    wechatPolling.value = false
  }
}

function refreshWechatQr() {
  wechatExpired.value = false
  openWechatLogin()
}

function onForgotPassword() {
  errorMsg.value = '请联系管理员重置密码：zhang@epicshot.com'
}

onMounted(() => {
  document.addEventListener('keydown', onWechatKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onWechatKeydown)
})
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

.divider {
  display: flex;
  align-items: center;
  margin: 16px 0;
  color: $color-text-muted;
  font-size: 13px;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: $color-border;
  }

  .divider-text {
    padding: 0 12px;
  }
}

.btn-wechat {
  width: 100%;
  height: 44px;
  background: #07c160;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #06ad56;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wechat-icon {
    font-size: 20px;
  }
}

.wechat-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wechat-modal {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 32px;
  text-align: center;
  position: relative;
  width: 320px;
}

.wechat-modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  font-size: 24px;
  color: $color-text-muted;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
}

.wechat-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 20px;
}

.wechat-qr-wrap {
  .wechat-qr-img {
    width: 200px;
    height: 200px;
    border: 1px solid $color-border;
    border-radius: $radius-md;
  }

  .wechat-hint {
    margin-top: 12px;
    font-size: 13px;
    color: $color-text-secondary;
  }
}

.wechat-qr-loading {
  width: 200px;
  height: 200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text-muted;
  font-size: 14px;
  gap: 12px;
}

.wechat-expired {
  padding: 20px;
  font-size: 14px;
  color: $color-text-secondary;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.btn-refresh {
  padding: 6px 18px;
  background: $color-primary;
  color: #fff;
  font-size: 13px;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>