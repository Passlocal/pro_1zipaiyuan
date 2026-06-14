import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { mockUser, mockWorkspace, mockMembers } from '@/utils/mockData'
import type { User, Workspace } from '@/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const workspace = ref<Workspace | null>(null)
  const members = ref<User[]>([])
  const token = ref<string | null>(localStorage.getItem('epx_token'))

  // Sync init: mock mode fills user immediately so router guard passes
  function initMockDataIfNeeded() {
    if (!(import.meta.env.VITE_API_URL as string) && !token.value) {
      token.value = 'mock-token'
      user.value = mockUser()
      workspace.value = mockWorkspace()
      members.value = mockMembers()
      localStorage.setItem('epx_token', 'mock-token')
    }
  }
  initMockDataIfNeeded()

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isOwner = computed(() => user.value?.role === 'owner')
  const isEditor = computed(() => user.value?.role === 'editor')

  async function loginWithWechat(code: string) {
    const res = await authApi.loginWithWechat(code)
    token.value = res.data.data.token
    user.value = res.data.data.user
    localStorage.setItem('epx_token', res.data.data.token)
    await loadWorkspace()
  }

  async function loginWithEmail(email: string, password: string) {
    try {
      const res = await authApi.loginWithEmail(email, password)
      token.value = res.data.data.token
      user.value = res.data.data.user
      localStorage.setItem('epx_token', res.data.data.token)
      await loadWorkspace()
    } catch (e: any) {
      // Mock mode: accept any credentials
      if (!(import.meta.env.VITE_API_URL as string)) {
        mockLogin(email)
      } else {
        const msg = e?.response?.data?.message || e?.message || '登录失败'
        console.error('[loginWithEmail] status:', e?.response?.status, 'data:', e?.response?.data, 'message:', e?.message)
        throw new Error(msg)
      }
    }
  }

  async function register(email: string, password: string, name: string) {
    try {
      const res = await authApi.register(email, password, name)
      token.value = res.data.data.token
      user.value = res.data.data.user
      localStorage.setItem('epx_token', res.data.data.token)
      await loadWorkspace()
    } catch {
      // Mock mode: register locally
      if (!(import.meta.env.VITE_API_URL as string)) {
        const newUser: User = {
          id: 'mock-user-' + Date.now(),
          name,
          email,
          workspaceId: 'mock-workspace-1',
          role: 'owner' as const,
          avatarUrl: '',
          status: 'active' as const,
          createdAt: new Date().toISOString()
        }
        token.value = 'mock-token-' + Date.now()
        user.value = newUser
        workspace.value = mockWorkspace()
        members.value = [newUser, ...mockMembers()]
        localStorage.setItem('epx_token', token.value)
      } else {
        throw new Error('注册失败')
      }
    }
  }

  function mockLogin(email: string) {
    const mocked = mockUser()
    mocked.email = email
    token.value = 'mock-token-' + Date.now()
    user.value = mocked
    workspace.value = mockWorkspace()
    members.value = mockMembers()
    localStorage.setItem('epx_token', token.value)
  }

  async function fetchUser() {
    // Double-guard: skip on guest pages to avoid 401 redirect loop
    const path = window.location.pathname
    if (path === '/login' || path === '/register') {
      console.log('[fetchUser] skipped on guest page:', path)
      return
    }
    try {
      const res = await authApi.getMe()
      user.value = res.data.data
      await loadWorkspace()
    } catch {
      // Fall back to mock data when no backend configured
      if (!(import.meta.env.VITE_API_URL as string)) {
        initMockData()
      } else {
        logout()
      }
    }
  }

  async function loadWorkspace() {
    try {
      const res = await authApi.getWorkspace()
      workspace.value = res.data.data
    } catch {
      // ignore
    }
  }

  function initMockData() {
    token.value = 'mock-token'
    user.value = mockUser()
    workspace.value = mockWorkspace()
    members.value = mockMembers()
    localStorage.setItem('epx_token', 'mock-token')
  }

  function logout() {
    token.value = null
    user.value = null
    workspace.value = null
    localStorage.removeItem('epx_token')
  }

  return {
    user,
    workspace,
    token,
    isLoggedIn,
    isOwner,
    isEditor,
    loginWithWechat,
    loginWithEmail,
    register,
    fetchUser,
    logout,
    members,
    initMockData
  }
})