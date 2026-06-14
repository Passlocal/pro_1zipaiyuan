import { ref } from 'vue'

export interface ViewerTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export interface FitSize {
  width: number
  height: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 5.0
const ZOOM_STEP = 0.1

export function useImageViewer() {
  const scale = ref(1)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const isFullscreen = ref(false)

  function clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
  }

  function fitToScreen(imgWidth: number, imgHeight: number, containerWidth: number, containerHeight: number): FitSize {
    if (imgWidth <= 0 || imgHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
      return { width: containerWidth, height: containerHeight }
    }

    const scaleX = (containerWidth * 0.92) / imgWidth
    const scaleY = (containerHeight * 0.92) / imgHeight
    const fitScale = Math.min(scaleX, scaleY, 1)

    scale.value = fitScale
    offsetX.value = (containerWidth - imgWidth * fitScale) / 2
    offsetY.value = (containerHeight - imgHeight * fitScale) / 2

    return {
      width: imgWidth * fitScale,
      height: imgHeight * fitScale
    }
  }

  function zoomTo(targetScale: number, centerX = 0, centerY = 0): void {
    const oldScale = scale.value
    const newScale = clampScale(targetScale)

    if (oldScale === 0) return

    const ratio = newScale / oldScale
    offsetX.value = centerX - ratio * (centerX - offsetX.value)
    offsetY.value = centerY - ratio * (centerY - offsetY.value)
    scale.value = newScale
  }

  function screenToImage(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - offsetX.value) / scale.value,
      y: (sy - offsetY.value) / scale.value
    }
  }

  function imageToScreen(ix: number, iy: number): { x: number; y: number } {
    return {
      x: ix * scale.value + offsetX.value,
      y: iy * scale.value + offsetY.value
    }
  }

  function handleWheel(
    event: WheelEvent,
    containerRect: DOMRect
  ): void {
    const cursorX = event.clientX - containerRect.left
    const cursorY = event.clientY - containerRect.top

    const direction = event.deltaY < 0 ? 1 : -1
    const factor = 1 + ZOOM_STEP * direction
    const newScale = clampScale(scale.value * factor)

    if (scale.value === 0) return

    const ratio = newScale / scale.value
    offsetX.value = cursorX - ratio * (cursorX - offsetX.value)
    offsetY.value = cursorY - ratio * (cursorY - offsetY.value)
    scale.value = newScale
  }

  // Pinch-to-zoom state
  let initialPinchDistance = 0
  let initialScale = 1
  let initialOffsetX = 0
  let initialOffsetY = 0
  let pinchMidX = 0
  let pinchMidY = 0

  // Pan state
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartOffsetX = 0
  let panStartOffsetY = 0

  // Inertia
  let velocityX = 0
  let velocityY = 0
  let lastPanTime = 0
  let lastPanX = 0
  let lastPanY = 0
  let inertiaRaf = 0

  function getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getTouchMidpoint(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  function handleTouchStart(event: TouchEvent, containerRect: DOMRect): void {
    if (event.touches.length === 2) {
      // Pinch start
      initialPinchDistance = getTouchDistance(event.touches)
      initialScale = scale.value
      initialOffsetX = offsetX.value
      initialOffsetY = offsetY.value
      const mid = getTouchMidpoint(event.touches)
      pinchMidX = mid.x - containerRect.left
      pinchMidY = mid.y - containerRect.top
      isPanning = false
    } else if (event.touches.length === 1) {
      // Pan start
      isPanning = true
      panStartX = event.touches[0].clientX
      panStartY = event.touches[0].clientY
      panStartOffsetX = offsetX.value
      panStartOffsetY = offsetY.value
      velocityX = 0
      velocityY = 0
      lastPanTime = Date.now()
      lastPanX = panStartX
      lastPanY = panStartY
      cancelInertia()
    }
  }

  function handleTouchMove(event: TouchEvent, containerRect: DOMRect): void {
    if (event.touches.length === 2) {
      // Pinch zoom
      const dist = getTouchDistance(event.touches)
      if (initialPinchDistance > 0) {
        const ratio = dist / initialPinchDistance
        const newScale = clampScale(initialScale * ratio)

        const mid = getTouchMidpoint(event.touches)
        const cx = mid.x - containerRect.left
        const cy = mid.y - containerRect.top

        offsetX.value = cx - (newScale / initialScale) * (pinchMidX - initialOffsetX)
        offsetY.value = cy - (newScale / initialScale) * (pinchMidY - initialOffsetY)
        scale.value = newScale
      }
      isPanning = false
    } else if (event.touches.length === 1 && isPanning) {
      // Pan
      const dx = event.touches[0].clientX - panStartX
      const dy = event.touches[0].clientY - panStartY
      offsetX.value = panStartOffsetX + dx
      offsetY.value = panStartOffsetY + dy

      const now = Date.now()
      const dt = now - lastPanTime
      if (dt > 0) {
        velocityX = (event.touches[0].clientX - lastPanX) / dt
        velocityY = (event.touches[0].clientY - lastPanY) / dt
      }
      lastPanTime = now
      lastPanX = event.touches[0].clientX
      lastPanY = event.touches[0].clientY
    }
  }

  function handleTouchEnd(): void {
    if (isPanning && (Math.abs(velocityX) > 0.05 || Math.abs(velocityY) > 0.05)) {
      startInertia()
    }
    isPanning = false
    initialPinchDistance = 0
  }

  function startInertia(): void {
    cancelInertia()
    const friction = 0.95
    const minVelocity = 0.05

    function animate() {
      velocityX *= friction
      velocityY *= friction

      offsetX.value += velocityX * 16
      offsetY.value += velocityY * 16

      if (Math.abs(velocityX) > minVelocity || Math.abs(velocityY) > minVelocity) {
        inertiaRaf = requestAnimationFrame(animate)
      }
    }

    inertiaRaf = requestAnimationFrame(animate)
  }

  function cancelInertia(): void {
    if (inertiaRaf) {
      cancelAnimationFrame(inertiaRaf)
      inertiaRaf = 0
    }
  }

  function handleMouseDown(
    event: MouseEvent,
    isPanningMode: boolean
  ): boolean {
    if (!isPanningMode) return false
    isPanning = true
    panStartX = event.clientX
    panStartY = event.clientY
    panStartOffsetX = offsetX.value
    panStartOffsetY = offsetY.value
    velocityX = 0
    velocityY = 0
    lastPanTime = Date.now()
    lastPanX = panStartX
    lastPanY = panStartY
    cancelInertia()
    return true
  }

  function handleMouseMove(
    event: MouseEvent,
    isPanningMode: boolean
  ): boolean {
    if (!isPanning || !isPanningMode) return false
    const dx = event.clientX - panStartX
    const dy = event.clientY - panStartY
    offsetX.value = panStartOffsetX + dx
    offsetY.value = panStartOffsetY + dy

    const now = Date.now()
    const dt = now - lastPanTime
    if (dt > 0) {
      velocityX = (event.clientX - lastPanX) / dt
      velocityY = (event.clientY - lastPanY) / dt
    }
    lastPanTime = now
    lastPanX = event.clientX
    lastPanY = event.clientY
    return true
  }

  function handleMouseUp(isPanningMode: boolean): boolean {
    if (!isPanning || !isPanningMode) return false
    if (Math.abs(velocityX) > 0.05 || Math.abs(velocityY) > 0.05) {
      startInertia()
    }
    isPanning = false
    return true
  }

  function toggleFullscreen(): void {
    isFullscreen.value = !isFullscreen.value
  }

  function resetTransform(): void {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
    cancelInertia()
    isPanning = false
    initialPinchDistance = 0
  }

  function getTransform(): ViewerTransform {
    return {
      scale: scale.value,
      offsetX: offsetX.value,
      offsetY: offsetY.value
    }
  }

  function isZoomedIn(): boolean {
    return scale.value > 1.01
  }

  return {
    scale,
    offsetX,
    offsetY,
    isFullscreen,
    fitToScreen,
    zoomTo,
    screenToImage,
    imageToScreen,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    toggleFullscreen,
    resetTransform,
    getTransform,
    isZoomedIn,
    cancelInertia,
    isPanning: () => isPanning
  }
}