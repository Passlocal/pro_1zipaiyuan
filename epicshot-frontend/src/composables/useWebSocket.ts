import { ref, onMounted, onUnmounted } from 'vue'
import type { WSMessage, OnlineUser } from '@/types/models'

// 生产环境通过 VITE_WS_URL 注入，开发环境自动使用当前域名
const WS_BASE = import.meta.env.VITE_WS_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? `ws://${window.location.hostname}:3000/v1/ws`
    : `wss://${window.location.host}/v1/ws`)

export function useWebSocket(projectId: string) {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const onlineUsers = ref<OnlineUser[]>([])
  const cursorPositions = ref<Record<string, { x: number; y: number; color: string }>>({})

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  // 消息回调注册
  const handlers: Record<string, ((data: unknown) => void)[]> = {}

  function on(type: string, handler: (data: unknown) => void) {
    if (!handlers[type]) handlers[type] = []
    handlers[type].push(handler)
  }

  function emit(type: string, data: unknown) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type, data }))
    }
  }

  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) return

    const token = localStorage.getItem('epx_token')
    const url = `${WS_BASE}/project/${projectId}${token ? `?token=${token}` : ''}`

    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      isConnected.value = true
      startHeartbeat()
    }

    ws.value.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        handleMessage(msg)
      } catch {
        // ignore parse errors
      }
    }

    ws.value.onclose = () => {
      isConnected.value = false
      stopHeartbeat()
      scheduleReconnect()
    }

    ws.value.onerror = () => {
      ws.value?.close()
    }
  }

  function disconnect() {
    stopHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    ws.value?.close()
    ws.value = null
  }

  function handleMessage(msg: WSMessage) {
    const { type, data, userId } = msg

    if (type === 'user_join') {
      const user = data as OnlineUser
      if (!onlineUsers.value.find(u => u.id === user.id)) {
        onlineUsers.value.push(user)
      }
    }

    if (type === 'user_leave') {
      onlineUsers.value = onlineUsers.value.filter(u => u.id !== userId)
      delete cursorPositions.value[userId]
    }

    if (type === 'cursor_move') {
      const pos = data as { x: number; y: number; color: string }
      cursorPositions.value[userId] = pos
    }

    // 触发已注册的处理器
    if (handlers[type]) {
      handlers[type].forEach(h => h(data))
    }
  }

  function sendCursorMove(x: number, y: number, color: string) {
    emit('cursor_move', { x, y, color })
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function scheduleReconnect() {
    reconnectTimer = setTimeout(() => {
      connect()
    }, 3000)
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    ws,
    isConnected,
    onlineUsers,
    cursorPositions,
    on,
    emit,
    sendCursorMove,
    connect,
    disconnect
  }
}