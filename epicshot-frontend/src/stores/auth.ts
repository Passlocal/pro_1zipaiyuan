import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { User, Workspace } from '@/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const workspace = ref<Workspace | null>(null)
  const members = ref<User[]>([])
  const token = ref<string | null>(localStorage.getItem('epx_token'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isOwner = computed(() => user.value?.role === 'owner')
  const isEditor = computed(() => user.value?.role === 'editor')

  async function loginWithWechatPreflight() {
    const qrRes = await authApi.getWechatQrcode()
    return {
      ticket: qrRes.data.data.ticket,
      qrcodeDataUrl: qrRes.data.data.qrcodeDataUrl
    }
  }

  async function loginWithWechat() {
    const qrRes = await authApi.getWechatQrcode()
    const ticket = qrRes.data.data.ticket
    const qrcodeDataUrl = qrRes.data.data.qrcodeDataUrl

    return new Promise<{ ticket: string; qrcodeDataUrl: string }>((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await authApi.getWechatStatus(ticket)
          const status = statusRes.data.data.status

          if (status === 'confirmed') {
            clearInterval(pollInterval)
            const confirmRes = await authApi.confirmWechatQrcode(ticket)
            token.value = confirmRes.data.data.token
            user.value = confirmRes.data.data.user
            localStorage.setItem('epx_token', confirmRes.data.data.token)
            await loadWorkspace()
            resolve({ ticket, qrcodeDataUrl })
          } else if (status === 'expired') {
            clearInterval(pollInterval)
            reject(new Error('二维码已过期，请刷新'))
          }
        } catch (e: any) {
          if (e?.response?.status === 404) {
            clearInterval(pollInterval)
            reject(new Error('二维码已过期，请刷新'))
          }
        }
      }, 2000)

      setTimeout(() => {
        clearInterval(pollInterval)
        reject(new Error('二维码已过期，请刷新'))
      }, 5 * 60 * 1000)
    })
  }

  async function loginWithEmail(email: string, password: string) {
    const res = await authApi.loginWithEmail(email, password)
    token.value = res.data.data.token
    user.value = res.data.data.user
    localStorage.setItem('epx_token', res.data.data.token)
    await loadWorkspace()
  }

  async function register(email: string, password: string, name: string) {
    const res = await authApi.register(email, password, name)
    token.value = res.data.data.token
    user.value = res.data.data.user
    localStorage.setItem('epx_token', res.data.data.token)
    await loadWorkspace()
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const res = await authApi.getMe()
      user.value = res.data.data
      await loadWorkspace()
    } catch {
      logout()
    }
  }

  async function loadWorkspace() {
    try {
      const res = await authApi.getWorkspace()
      workspace.value = res.data.data
      const membersRes = await authApi.getMembers()
      members.value = membersRes.data.data
    } catch {
      // ignore
    }
  }

  function logout() {
    token.value = null
    user.value = null
    workspace.value = null
    members.value = []
    localStorage.removeItem('epx_token')
  }

  function injectToken(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('epx_token', newToken)
    loadWorkspace().catch(() => {})
  }

  return {
    user,
    workspace,
    token,
    isLoggedIn,
    isOwner,
    isEditor,
    loginWithWechatPreflight,
    loginWithWechat,
    loginWithEmail,
    register,
    fetchUser,
    logout,
    members,
    injectToken,
    loadWorkspace
  }
})