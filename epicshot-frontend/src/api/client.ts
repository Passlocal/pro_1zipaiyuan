import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

const BASE_URL = (import.meta.env.VITE_API_URL as string) || ''

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：添加JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('epx_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // 客户免登录用 share_token 查询参数
  const shareToken = new URLSearchParams(window.location.search).get('share_token')
  if (shareToken && !token) {
    config.params = { ...config.params, share_token: shareToken }
  }

  return config
})

// 响应拦截器：处理401/403
client.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('epx_token')
      const path = window.location.pathname
      // Avoid redirect loop on guest or client pages
      if (!path.startsWith('/client') && path !== '/login' && path !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client