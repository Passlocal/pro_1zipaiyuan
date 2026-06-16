import { ref } from 'vue'

/**
 * V1.2.0: 渐进式图片加载
 * 先显示低分辨率占位图，加载完成后平滑过渡到原图
 */
export function useProgressiveImage(thumbnailUrl: string, originalUrl: string) {
  const loaded = ref(false)
  const error = ref(false)
  const currentSrc = ref(thumbnailUrl)

  function prefetch() {
    const img = new Image()
    img.onload = () => {
      loaded.value = true
      currentSrc.value = originalUrl
    }
    img.onerror = () => {
      error.value = true
    }
    img.src = originalUrl
  }

  return { loaded, error, currentSrc, prefetch }
}