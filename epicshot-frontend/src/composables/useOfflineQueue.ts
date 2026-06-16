import { ref, onMounted, onUnmounted } from 'vue'
import client from '@/api/client'

const OFFLINE_KEY = 'epx_offline_queue'
const SYNC_INTERVAL = 5000 // 5s check interval

interface OfflineAction {
  id: string
  type: 'annotation:create' | 'annotation:update' | 'annotation:delete' | 'comment:create' | 'comment:update'
  url: string
  method: string
  body?: any
  timestamp: number
  retryCount: number
}

/**
 * V1.2.0: 离线标注暂存队列
 * 断网时暂存操作到 localStorage，恢复网络后自动同步
 */
export function useOfflineQueue() {
  const queue = ref<OfflineAction[]>([])
  const isOnline = ref(navigator.onLine)
  const syncing = ref(false)
  const pendingCount = ref(0)
  let syncTimer: ReturnType<typeof setInterval> | null = null

  function loadQueue() {
    try {
      const stored = localStorage.getItem(OFFLINE_KEY)
      queue.value = stored ? JSON.parse(stored) : []
      pendingCount.value = queue.value.length
    } catch {
      queue.value = []
    }
  }

  function saveQueue() {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue.value))
    pendingCount.value = queue.value.length
  }

  function enqueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) {
    const item: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    }
    queue.value.push(item)
    saveQueue()
    return item.id
  }

  async function syncQueue() {
    if (!isOnline.value || syncing.value || queue.value.length === 0) return

    syncing.value = true
    const maxRetries = 3
    const remaining: OfflineAction[] = []

    for (const item of queue.value) {
      try {
        if (item.method === 'POST') {
          await client.post(item.url, item.body)
        } else if (item.method === 'PUT') {
          await client.put(item.url, item.body)
        } else if (item.method === 'DELETE') {
          await client.delete(item.url)
        }
      } catch {
        if (item.retryCount < maxRetries) {
          item.retryCount++
          remaining.push(item)
        }
        // 超过重试次数的丢弃
      }
    }

    queue.value = remaining
    saveQueue()
    syncing.value = false
  }

  function handleOnline() {
    isOnline.value = true
    syncQueue()
  }

  function handleOffline() {
    isOnline.value = false
  }

  function startSync() {
    syncTimer = setInterval(syncQueue, SYNC_INTERVAL)
  }

  onMounted(() => {
    loadQueue()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    startSync()
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (syncTimer) clearInterval(syncTimer)
  })

  return { queue, isOnline, syncing, pendingCount, enqueue, syncQueue }
}