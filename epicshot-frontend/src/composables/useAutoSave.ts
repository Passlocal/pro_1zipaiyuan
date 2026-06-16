import { ref, watch, onUnmounted } from 'vue'
import client from '@/api/client'

const AUTO_SAVE_DELAY = 2000 // 2s debounce

/**
 * V1.2.0: 意见卡片自动保存草稿
 * 用法: const { draftText, isSaving, lastSaved } = useAutoSave(cardId)
 */
export function useAutoSave(cardId: string, initialText?: string) {
  const draftText = ref(initialText || '')
  const isSaving = ref(false)
  const lastSaved = ref<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedText = initialText || ''

  async function saveDraft() {
    if (draftText.value === lastSavedText) return
    isSaving.value = true
    try {
      await client.put(`/comment-cards/${cardId}/draft`, { draftText: draftText.value })
      lastSavedText = draftText.value
      lastSaved.value = new Date().toISOString()
    } catch {
      // 静默失败，下次继续尝试
    } finally {
      isSaving.value = false
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveDraft, AUTO_SAVE_DELAY)
  }

  // 监听文本变化，自动触发保存
  watch(draftText, () => {
    if (draftText.value !== lastSavedText) {
      scheduleSave()
    }
  })

  // 组件卸载前强制保存
  onUnmounted(() => {
    if (saveTimer) clearTimeout(saveTimer)
    if (draftText.value !== lastSavedText) {
      client.put(`/comment-cards/${cardId}/draft`, { draftText: draftText.value }).catch(() => {})
    }
  })

  return { draftText, isSaving, lastSaved, saveDraft }
}