<template>
  <div
    ref="containerRef"
    class="image-viewer"
    :class="{
      'image-viewer--fullscreen': viewer.isFullscreen.value,
      'image-viewer--long': isLongImage
    }"
    tabindex="0"
    @keydown="handleKeydown"
    @wheel.prevent="onWheel"
    @touchstart.passive="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend="onTouchEnd"
    @mousedown="onStageMouseDown"
    @mousemove="onStageMouseMove"
    @mouseup="onStageMouseUp"
    @mouseleave="onStageMouseUp"
    @dblclick="toggleZoom"
  >
    <!-- Loading skeleton -->
    <div v-if="loading" class="image-viewer__loading">
      <div class="image-viewer__spinner"></div>
      <span class="image-viewer__loading-text">加载中...</span>
    </div>

    <!-- Fullscreen toggle button -->
    <button class="image-viewer__fullscreen-btn" @click.stop="viewer.toggleFullscreen()" :title="viewer.isFullscreen.value ? '退出全屏' : '全屏'" :aria-label="viewer.isFullscreen.value ? '退出全屏' : '全屏'">
      <svg v-if="viewer.isFullscreen.value" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="4 8 4 4 8 4"/>
        <polyline points="20 8 20 4 16 4"/>
        <polyline points="4 16 4 20 8 20"/>
        <polyline points="20 16 20 20 16 20"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <polyline points="21 3 14 10"/>
        <polyline points="3 21 10 14"/>
      </svg>
    </button>

    <!-- 4.3: 旋转按钮 -->
    <button class="image-viewer__rotate-btn" @click.stop="rotateImage" :title="'旋转 (' + (rotationAngle % 360) + '°)'" aria-label="旋转图片">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    </button>

    <!-- Long image position indicator -->
    <div v-if="isLongImage && !loading" class="image-viewer__position-indicator">
      {{ Math.round(positionPercent) }}%
    </div>

    <!-- 4.7: 草稿恢复横幅 -->
    <div v-if="showDraftBanner" class="image-viewer__draft-banner">
      <span>检测到未提交的意见草稿，是否恢复？</span>
      <button class="btn-draft-restore" @click="restoreDraft">恢复</button>
      <button class="btn-draft-ignore" @click="ignoreDraft">忽略</button>
    </div>

    <!-- Image + Canvas container -->
    <div class="image-viewer__stage" ref="stageRef">
      <!-- 4.15: 模糊占位 -->
      <img
        v-if="!loading && blurSrc"
        :src="blurSrc"
        class="image-viewer__blur-placeholder"
        :class="{ 'image-viewer__blur-placeholder--hidden': imageLoaded }"
        :style="imageStyle"
      />
      <img
        ref="imgRef"
        :src="imageUrl"
        class="image-viewer__image"
        :class="{ 'image-viewer__image--loaded': imageLoaded }"
        :style="imageStyle"
        :draggable="false"
        @load="onImageLoad"
        @error="onImageError"
      />
      <canvas
        ref="canvasRef"
        class="image-viewer__canvas"
        :style="canvasStyle"
      ></canvas>

      <!-- 4.5: 框选实时尺寸显示 -->
      <div
        v-if="showSizeOverlay"
        class="image-viewer__size-overlay"
        :style="sizeOverlayStyle"
      >{{ sizeOverlayText }}</div>

      <!-- 4.4: 文字工具预设短语 -->
      <div v-if="showTextInput" class="image-viewer__text-toolbar" :style="textToolbarStyle">
        <select
          class="preset-phrase-select"
          @change="onPresetPhraseSelected"
          :value="''"
        >
          <option value="" disabled>预设短语</option>
          <option v-for="phrase in presetPhrases" :key="phrase" :value="phrase">{{ phrase }}</option>
        </select>
        <input
          ref="textInputRef"
          v-model="textInputValue"
          class="image-viewer__text-input"
          @blur="finalizeText"
          @keyup.enter="finalizeText"
          @keyup.escape="cancelText"
        />
      </div>
    </div>

    <!-- 4.1: 页码指示器 -->
    <div v-if="totalCount > 0 && !loading" class="image-viewer__page-indicator">
      <template v-if="!showPageInput">
        <span class="page-label" @click="openPageInput">{{ currentIndex + 1 }} / {{ totalCount }}</span>
      </template>
      <template v-else>
        <input
          ref="pageInputRef"
          v-model.number="pageInputValue"
          class="page-input"
          type="number"
          :min="1"
          :max="totalCount"
          @keyup.enter="gotoPage"
          @keyup.escape="closePageInput"
          @blur="closePageInput"
        />
      </template>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="image-viewer__error">
      <span class="image-viewer__error-icon">!</span>
      <span>图片加载失败</span>
      <button class="image-viewer__retry-btn" @click="retryLoad" aria-label="重新加载图片">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useImageViewer } from '@/composables/useImageViewer'
import { useAnnotationStore } from '@/stores/annotation'
import { useProgressiveImage } from '@/composables/useProgressiveImage'
import { annotationApi } from '@/api/annotations'
import type { Annotation, AnnotationCreateParams, AnnotationColor, AnnotationToolType, PenWidth, ArrowWidth, FontSize } from '@/types/models'

const props = defineProps<{
  imageUrl: string
  annotations: Annotation[]
  activeTool: AnnotationToolType
  activeColor: AnnotationColor
  activeWidth: PenWidth | ArrowWidth
  activeFontSize: FontSize
  currentIndex?: number
  totalCount?: number
  cardDraftText?: string
}>()

const emit = defineEmits<{
  (e: 'annotation-created', annotation: Annotation): void
  (e: 'annotation-deleted', id: string): void
  (e: 'image-clicked', x: number, y: number): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'fullscreen-toggle', active: boolean): void
  (e: 'tool-toggle'): void
  (e: 'goto-page', page: number): void
  (e: 'draft-restore', text: string): void
  (e: 'draft-ignore'): void
  (e: 'focus-next-card'): void
}>()

const store = useAnnotationStore()
const viewer = useImageViewer()

const containerRef = ref<HTMLDivElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)

const loading = ref(true)
const imageLoaded = ref(false)
const loadError = ref(false)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const displayWidth = ref(0)
const displayHeight = ref(0)

const isDrawing = ref(false)
const spaceHeld = ref(false)
const drawStartX = ref(0)
const drawStartY = ref(0)
const currentStroke: number[][] = []
const currentMouseX = ref(0)
const currentMouseY = ref(0)
let isSpacePanning = false

// Annotation selection & move
const selectedAnnotationId = ref<string | null>(null)
const isMovingAnnotation = ref(false)
const moveStartRel = ref({ x: 0, y: 0 })
const moveStartScreen = ref({ x: 0, y: 0 })
const moveAnnotationStartCoords = ref<{ x: number; y: number; w?: number; h?: number } | null>(null)

const showTextInput = ref(false)
const textInputValue = ref('')
const textInputPos = ref({ x: 0, y: 0 })

// 4.1: 页码指示器
const showPageInput = ref(false)
const pageInputValue = ref(1)
const pageInputRef = ref<HTMLInputElement | null>(null)

// 4.3: 旋转状态
const rotationAngle = ref(0)
const rotationAngles = ref<Record<string, number>>({})
const rotationToastShown = ref(false)

// 4.4: 预设短语
const presetPhrases = ref<string[]>([
  '曝光不足', '色温偏冷', '高光溢出', '饱和度不足',
  '白平衡偏移', '暗部细节丢失', '噪点过多', '锐度不足'
])

// 4.5: 框选实时尺寸
const showSizeOverlay = ref(false)
const sizeOverlayText = ref('')
const sizeOverlayPos = ref({ x: 0, y: 0 })

// 4.7: 草稿恢复横幅
const showDraftBanner = ref(false)

// 4.15: 渐进式图片加载
const blurSrc = ref('')
const progressiveImage = computed(() => {
  if (props.imageUrl) {
    const thumb = props.imageUrl.replace(/\/original\//, '/thumb/').replace(/\.(jpg|jpeg|png|webp)$/i, '_thumb.$1')
    return { thumbnailUrl: thumb, originalUrl: props.imageUrl }
  }
  return null
})

let renderRaf = 0
let needsRender = true

const isLongImage = computed(() => naturalHeight.value >= naturalWidth.value * 2 && naturalWidth.value > 0)

const positionPercent = computed(() => {
  if (!containerRef.value || displayHeight.value <= 0) return 0
  const containerH = containerRef.value.clientHeight
  const visibleTop = -viewer.offsetY.value
  const totalScroll = displayHeight.value - containerH
  if (totalScroll <= 0) return 0
  return Math.min(100, Math.max(0, (visibleTop / totalScroll) * 100))
})

const imageStyle = computed(() => ({
  width: displayWidth.value ? `${displayWidth.value}px` : 'auto',
  height: displayHeight.value ? `${displayHeight.value}px` : 'auto',
  transform: `translate(${viewer.offsetX.value}px, ${viewer.offsetY.value}px) scale(${viewer.scale.value}) rotate(${rotationAngle.value}deg)`,
  transformOrigin: '0 0',
  opacity: imageLoaded.value ? 1 : 0,
  transition: imageLoaded.value ? 'opacity 0.3s ease' : 'none'
}))

const canvasStyle = computed(() => ({
  width: displayWidth.value ? `${displayWidth.value}px` : '0',
  height: displayHeight.value ? `${displayHeight.value}px` : '0',
  transform: `translate(${viewer.offsetX.value}px, ${viewer.offsetY.value}px) scale(${viewer.scale.value}) rotate(${rotationAngle.value}deg)`,
  transformOrigin: '0 0'
}))

const textInputStyle = computed(() => ({
  left: `${textInputPos.value.x * viewer.scale.value + viewer.offsetX.value}px`,
  top: `${textInputPos.value.y * viewer.scale.value + viewer.offsetY.value - 14}px`,
  fontSize: `${props.activeFontSize * viewer.scale.value}px`,
  color: props.activeColor
}))

const textToolbarStyle = computed(() => ({
  left: `${textInputPos.value.x * viewer.scale.value + viewer.offsetX.value}px`,
  top: `${textInputPos.value.y * viewer.scale.value + viewer.offsetY.value - 40}px`,
}))

const sizeOverlayStyle = computed(() => ({
  left: `${sizeOverlayPos.value.x}px`,
  top: `${sizeOverlayPos.value.y - 24}px`,
}))

// ============ Lifecycle ============

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('keyup', onGlobalKeyup)
  startRenderLoop()

  // 4.4: 获取预设短语
  fetchPresetPhrases()

  // 4.7: 检查草稿
  checkDraft()

  // 4.15: 设置模糊占位
  setupBlurPlaceholder()

  // ResizeObserver: re-fit image when container size changes
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!containerRef.value || !imageLoaded.value) return
      const rect = containerRef.value.getBoundingClientRect()
      viewer.fitToScreen(naturalWidth.value, naturalHeight.value, rect.width, rect.height)
      triggerRender()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('keyup', onGlobalKeyup)
  stopRenderLoop()
  viewer.cancelInertia()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(() => props.annotations, () => {
  needsRender = true
}, { deep: true })

watch(() => props.imageUrl, () => {
  loading.value = true
  imageLoaded.value = false
  loadError.value = false
  viewer.resetTransform()
  displayWidth.value = 0
  displayHeight.value = 0
  // 4.3: 恢复旋转角度
  rotationAngle.value = rotationAngles.value[props.imageUrl] || 0
  // 4.7: 检查草稿
  checkDraft()
  // 4.15: 设置模糊占位
  setupBlurPlaceholder()
})

// ============ Image Loading ============

function onImageLoad(): void {
  if (!imgRef.value) return
  naturalWidth.value = imgRef.value.naturalWidth
  naturalHeight.value = imgRef.value.naturalHeight

  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const fit = viewer.fitToScreen(
      naturalWidth.value,
      naturalHeight.value,
      rect.width,
      rect.height
    )
    displayWidth.value = fit.width
    displayHeight.value = fit.height
    updateCanvasSize()
  }

  loading.value = false
  imageLoaded.value = true
  needsRender = true
}

function onImageError(): void {
  loading.value = false
  loadError.value = true
}

function retryLoad(): void {
  loading.value = true
  loadError.value = false
  imageLoaded.value = false
  // trigger reload by setting a cache-busting param hasn't changed, but img will reload
  if (imgRef.value) {
    const url = props.imageUrl
    imgRef.value.src = ''
    nextTick(() => { imgRef.value!.src = url })
  }
}

// ============ Canvas Size & Render Loop ============

function updateCanvasSize(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = displayWidth.value
  canvas.height = displayHeight.value
  needsRender = true
}

function startRenderLoop(): void {
  function loop() {
    if (needsRender) {
      renderAnnotations()
      needsRender = false
    }
    renderRaf = requestAnimationFrame(loop)
  }
  renderRaf = requestAnimationFrame(loop)
}

function stopRenderLoop(): void {
  if (renderRaf) {
    cancelAnimationFrame(renderRaf)
    renderRaf = 0
  }
}

function triggerRender(): void {
  needsRender = true
}

// ============ Canvas Rendering ============

function renderAnnotations(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const annotation of props.annotations) {
    drawAnnotation(ctx, annotation)
  }

  // Draw selection border for selected annotation
  if (selectedAnnotationId.value) {
    const ann = props.annotations.find(a => a.id === selectedAnnotationId.value)
    if (ann) drawSelectionBorder(ctx, ann)
  }

  // Current pen stroke preview
  if (isDrawing.value && currentStroke.length > 1 && props.activeTool === 'pen') {
    drawStrokePreview(ctx)
  }

  // Shape preview for arrow/rect/ellipse
  if (isDrawing.value && (props.activeTool === 'arrow' || props.activeTool === 'rectangle' || props.activeTool === 'ellipse')) {
    drawShapePreview(ctx)
  }
}

function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation): void {
  const { color, width, fontSize } = annotation.style
  const { x, y, w, h } = annotation.coordinates
  const sW = displayWidth.value
  const sH = displayHeight.value

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (annotation.toolType) {
    case 'pen': {
      if (annotation.strokeData && annotation.strokeData.length > 1) {
        ctx.beginPath()
        const pts = annotation.strokeData
        ctx.moveTo(pts[0][0] * sW, pts[0][1] * sH)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0] * sW, pts[i][1] * sH)
        }
        ctx.stroke()
      }
      break
    }
    case 'arrow': {
      const endX = (w !== undefined ? x + w : x) * sW
      const endY = (h !== undefined ? y + h : y) * sH
      const startX = x * sW
      const startY = y * sH

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      const angle = Math.atan2(endY - startY, endX - startX)
      const headLen = width * 4 + 8
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - headLen * Math.cos(angle - Math.PI / 6),
        endY - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        endX - headLen * Math.cos(angle + Math.PI / 6),
        endY - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'rectangle': {
      const rx = x * sW
      const ry = y * sH
      const rw = (w || 0) * sW
      const rh = (h || 0) * sH
      ctx.globalAlpha = 0.2
      ctx.fillRect(rx, ry, rw, rh)
      ctx.globalAlpha = 1
      ctx.strokeRect(rx, ry, rw, rh)
      break
    }
    case 'ellipse': {
      const cx = (x + (w || 0) / 2) * sW
      const cy = (y + (h || 0) / 2) * sH
      const rx = Math.abs((w || 0) * sW / 2)
      const ry = Math.abs((h || 0) * sH / 2)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.globalAlpha = 0.2
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      break
    }
    case 'text': {
      const textStr = annotation.text || ''
      const fs = fontSize || 14
      ctx.font = `${fs}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillStyle = color
      ctx.globalAlpha = 1
      ctx.fillText(textStr, x * sW, y * sH)
      break
    }
  }

  ctx.restore()
}

function drawSelectionBorder(ctx: CanvasRenderingContext2D, annotation: Annotation): void {
  const { x, y, w, h } = annotation.coordinates
  const sW = displayWidth.value
  const sH = displayHeight.value

  ctx.save()
  ctx.strokeStyle = '#4a9eff'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 3])
  ctx.lineDashOffset = 0

  if (annotation.toolType === 'pen' && annotation.strokeData) {
    // Draw bounding box around pen stroke
    const pts = annotation.strokeData
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pt of pts) {
      if (pt[0] < minX) minX = pt[0]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[1] > maxY) maxY = pt[1]
    }
    const pad = 0.01
    ctx.strokeRect(
      (minX - pad) * sW, (minY - pad) * sH,
      (maxX - minX + pad * 2) * sW, (maxY - minY + pad * 2) * sH
    )
  } else if (annotation.toolType === 'arrow' && w !== undefined && h !== undefined) {
    const endX = (x + w) * sW
    const endY = (y + h) * sH
    const startX = x * sW
    const startY = y * sH
    const pad = 8
    const minX = Math.min(startX, endX) - pad
    const minY = Math.min(startY, endY) - pad
    ctx.strokeRect(minX, minY, Math.abs(w * sW) + pad * 2, Math.abs(h * sH) + pad * 2)
  } else if (annotation.toolType === 'text') {
    ctx.strokeRect(x * sW - 4, y * sH - 4, 0.15 * sW + 8, 0.03 * sH + 8)
  } else if (w !== undefined && h !== undefined) {
    ctx.strokeRect(x * sW - 4, y * sH - 4, w * sW + 8, h * sH + 8)
  }

  ctx.setLineDash([])
  ctx.restore()
}

function drawStrokePreview(ctx: CanvasRenderingContext2D): void {
  const sW = displayWidth.value
  const sH = displayHeight.value
  ctx.save()
  ctx.strokeStyle = props.activeColor
  ctx.lineWidth = props.activeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(currentStroke[0][0] * sW, currentStroke[0][1] * sH)
  for (let i = 1; i < currentStroke.length; i++) {
    ctx.lineTo(currentStroke[i][0] * sW, currentStroke[i][1] * sH)
  }
  ctx.stroke()
  ctx.restore()
}

function drawShapePreview(ctx: CanvasRenderingContext2D): void {
  const pos = getCanvasPos(currentMouseX.value, currentMouseY.value)
  const coords = getPreviewCoords(pos.x, pos.y)
  const sW = displayWidth.value
  const sH = displayHeight.value

  ctx.save()
  ctx.strokeStyle = props.activeColor
  ctx.fillStyle = props.activeColor
  ctx.lineWidth = props.activeWidth
  ctx.lineCap = 'round'

  if (props.activeTool === 'arrow') {
    const sx = drawStartX.value
    const sy = drawStartY.value
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    const angle = Math.atan2(pos.y - sy, pos.x - sx)
    const headLen = props.activeWidth * 4 + 8
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(pos.x - headLen * Math.cos(angle - Math.PI / 6), pos.y - headLen * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(pos.x - headLen * Math.cos(angle + Math.PI / 6), pos.y - headLen * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  } else if (props.activeTool === 'rectangle') {
    ctx.globalAlpha = 0.2
    ctx.fillRect(coords.x * sW, coords.y * sH, coords.w * sW, coords.h * sH)
    ctx.globalAlpha = 1
    ctx.strokeRect(coords.x * sW, coords.y * sH, coords.w * sW, coords.h * sH)
  } else if (props.activeTool === 'ellipse') {
    const cx = (coords.x + coords.w / 2) * sW
    const cy = (coords.y + coords.h / 2) * sH
    const rx = Math.abs(coords.w * sW / 2)
    const ry = Math.abs(coords.h * sH / 2)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.globalAlpha = 0.2
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.stroke()
  }

  ctx.restore()
}

// ============ Coordinate Helpers ============

function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
  if (!stageRef.value) return { x: 0, y: 0 }
  const rect = stageRef.value.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function toRelative(screenX: number, screenY: number): { x: number; y: number } {
  const imgX = (screenX - viewer.offsetX.value) / viewer.scale.value
  const imgY = (screenY - viewer.offsetY.value) / viewer.scale.value
  return {
    x: displayWidth.value > 0 ? imgX / displayWidth.value : 0,
    y: displayHeight.value > 0 ? imgY / displayHeight.value : 0
  }
}

function getPreviewCoords(mx: number, my: number): { x: number; y: number; w: number; h: number } {
  const rel1 = toRelative(drawStartX.value, drawStartY.value)
  const rel2 = toRelative(mx, my)
  return {
    x: Math.min(rel1.x, rel2.x),
    y: Math.min(rel1.y, rel2.y),
    w: Math.abs(rel2.x - rel1.x),
    h: Math.abs(rel2.y - rel1.y)
  }
}

// ============ Mouse / Touch Drawing Handling ============

function onStageMouseDown(event: MouseEvent): void {
  if (!imageLoaded.value || loading.value) return
  if (event.button !== 0) return

  if (isSpacePanning) {
    viewer.handleMouseDown(event, true)
    event.preventDefault()
    return
  }

  const pos = getCanvasPos(event.clientX, event.clientY)
  const rel = toRelative(pos.x, pos.y)

  // Check if clicking on an existing annotation (select/move)
  const hitAnnotation = findAnnotationAt(rel.x, rel.y)
  if (hitAnnotation && props.activeTool !== 'eraser') {
    selectAnnotation(hitAnnotation.id)
    isMovingAnnotation.value = true
    moveStartRel.value = { x: rel.x, y: rel.y }
    moveStartScreen.value = { x: event.clientX, y: event.clientY }
    moveAnnotationStartCoords.value = { ...hitAnnotation.coordinates }
    triggerRender()
    return
  }

  // Deselect on empty space click
  if (!hitAnnotation) {
    selectedAnnotationId.value = null
    triggerRender()
  }

  if (props.activeTool === 'pen') {
    isDrawing.value = true
    const rel = toRelative(pos.x, pos.y)
    currentStroke.length = 0
    currentStroke.push([rel.x, rel.y])
    triggerRender()
  } else if (props.activeTool === 'arrow' || props.activeTool === 'rectangle' || props.activeTool === 'ellipse') {
    isDrawing.value = true
    drawStartX.value = pos.x
    drawStartY.value = pos.y
  } else if (props.activeTool === 'text') {
    const rel = toRelative(pos.x, pos.y)
    startTextInput(rel.x * displayWidth.value, rel.y * displayHeight.value)
  } else if (props.activeTool === 'eraser') {
    handleEraserClick(event.clientX, event.clientY)
  }
}

function onStageMouseMove(event: MouseEvent): void {
  currentMouseX.value = event.clientX
  currentMouseY.value = event.clientY

  if (isSpacePanning && viewer.isPanning()) {
    viewer.handleMouseMove(event, true)
    return
  }

  // Annotation move
  if (isMovingAnnotation.value && moveAnnotationStartCoords.value) {
    const pos = getCanvasPos(event.clientX, event.clientY)
    const rel = toRelative(pos.x, pos.y)
    const dx = rel.x - moveStartRel.value.x
    const dy = rel.y - moveStartRel.value.y
    const start = moveAnnotationStartCoords.value
    const ann = props.annotations.find(a => a.id === selectedAnnotationId.value)
    if (ann) {
      const newCoords = { x: start.x + dx, y: start.y + dy }
      if (start.w !== undefined) newCoords['w'] = start.w
      if (start.h !== undefined) newCoords['h'] = start.h
      store.updateAnnotation(ann.id, { coordinates: newCoords as any })
      triggerRender()
    }
    return
  }

  if (!imageLoaded.value || !isDrawing.value) {
    // Show move cursor when hovering over annotation
    if (!isSpacePanning) {
      const pos = getCanvasPos(event.clientX, event.clientY)
      const rel = toRelative(pos.x, pos.y)
      const hovering = findAnnotationAt(rel.x, rel.y)
      if (containerRef.value) {
        containerRef.value.style.cursor = hovering ? 'move' : props.activeTool === 'eraser' ? 'crosshair' : 'crosshair'
      }
    }
    return
  }

  const pos = getCanvasPos(event.clientX, event.clientY)

  if (props.activeTool === 'pen') {
    const rel = toRelative(pos.x, pos.y)
    currentStroke.push([rel.x, rel.y])
    triggerRender()
  } else if (props.activeTool === 'arrow' || props.activeTool === 'rectangle' || props.activeTool === 'ellipse') {
    // 4.5: 框选实时尺寸显示
    updateSizeOverlay(event)
    triggerRender()
  }
}

function onStageMouseUp(event: MouseEvent): void {
  if (isSpacePanning && viewer.isPanning()) {
    viewer.handleMouseUp(true)
    return
  }

  if (isMovingAnnotation.value) {
    isMovingAnnotation.value = false
    moveAnnotationStartCoords.value = null
    triggerRender()
    return
  }

  if (!isDrawing.value) return

  const pos = getCanvasPos(event.clientX, event.clientY)

  if (props.activeTool === 'pen') {
    if (currentStroke.length > 1) {
      const rel = toRelative(pos.x, pos.y)
      currentStroke.push([rel.x, rel.y])
      finalizePenStroke()
    }
  } else if (props.activeTool === 'arrow') {
    finalizeArrow(pos.x, pos.y)
  } else if (props.activeTool === 'rectangle') {
    finalizeRect(pos.x, pos.y)
  } else if (props.activeTool === 'ellipse') {
    finalizeEllipse(pos.x, pos.y)
  }

  isDrawing.value = false
  showSizeOverlay.value = false
  triggerRender()
}

// ============ Tool Finalizers ============

function finalizePenStroke(): void {
  if (currentStroke.length < 2) return
  const params: AnnotationCreateParams = {
    toolType: 'pen',
    coordinates: { x: 0, y: 0 },
    style: { color: props.activeColor, width: props.activeWidth },
    strokeData: [...currentStroke.map(p => [p[0], p[1]])]
  }
  const annotation = store.addAnnotation(params)
  emit('annotation-created', annotation)
  currentStroke.length = 0
}

function finalizeArrow(mx: number, my: number): void {
  const rel1 = toRelative(drawStartX.value, drawStartY.value)
  const rel2 = toRelative(mx, my)
  const params: AnnotationCreateParams = {
    toolType: 'arrow',
    coordinates: { x: rel1.x, y: rel1.y, w: rel2.x - rel1.x, h: rel2.y - rel1.y },
    style: { color: props.activeColor, width: props.activeWidth }
  }
  const annotation = store.addAnnotation(params)
  emit('annotation-created', annotation)
}

function finalizeRect(mx: number, my: number): void {
  const coords = getPreviewCoords(mx, my)
  const params: AnnotationCreateParams = {
    toolType: 'rectangle',
    coordinates: coords,
    style: { color: props.activeColor, width: props.activeWidth }
  }
  const annotation = store.addAnnotation(params)
  emit('annotation-created', annotation)
}

function finalizeEllipse(mx: number, my: number): void {
  const coords = getPreviewCoords(mx, my)
  const params: AnnotationCreateParams = {
    toolType: 'ellipse',
    coordinates: coords,
    style: { color: props.activeColor, width: props.activeWidth }
  }
  const annotation = store.addAnnotation(params)
  emit('annotation-created', annotation)
}

// ============ Text ============

function startTextInput(ix: number, iy: number): void {
  textInputPos.value = { x: ix, y: iy }
  showTextInput.value = true
  textInputValue.value = ''
  nextTick(() => {
    textInputRef.value?.focus()
  })
}

function finalizeText(): void {
  if (!textInputValue.value.trim() || !showTextInput.value) {
    cancelText()
    return
  }
  const params: AnnotationCreateParams = {
    toolType: 'text',
    coordinates: {
      x: textInputPos.value.x / (displayWidth.value || 1),
      y: textInputPos.value.y / (displayHeight.value || 1)
    },
    style: { color: props.activeColor, width: props.activeWidth, fontSize: props.activeFontSize },
    text: textInputValue.value.trim()
  }
  const annotation = store.addAnnotation(params)
  emit('annotation-created', annotation)
  showTextInput.value = false
  textInputValue.value = ''
}

function cancelText(): void {
  showTextInput.value = false
  textInputValue.value = ''
}

// ============ Annotation Selection ============

function findAnnotationAt(rx: number, ry: number): Annotation | undefined {
  for (let i = props.annotations.length - 1; i >= 0; i--) {
    if (hitTestAnnotation(props.annotations[i], rx, ry)) {
      return props.annotations[i]
    }
  }
  return undefined
}

function selectAnnotation(id: string): void {
  selectedAnnotationId.value = id
}

// ============ Eraser ============

function handleEraserClick(clientX: number, clientY: number): void {
  const pos = getCanvasPos(clientX, clientY)
  const rel = toRelative(pos.x, pos.y)

  for (let i = props.annotations.length - 1; i >= 0; i--) {
    const ann = props.annotations[i]
    if (hitTestAnnotation(ann, rel.x, rel.y)) {
      store.removeAnnotation(ann.id)
      emit('annotation-deleted', ann.id)
      triggerRender()
      return
    }
  }

  emit('image-clicked', rel.x, rel.y)
}

function hitTestAnnotation(ann: Annotation, rx: number, ry: number): boolean {
  const { x, y, w, h } = ann.coordinates

  if (ann.toolType === 'pen' && ann.strokeData) {
    return ann.strokeData.some((pt: number[]) => {
      const dx = pt[0] - rx
      const dy = pt[1] - ry
      return Math.sqrt(dx * dx + dy * dy) < 0.03
    })
  }

  if (ann.toolType === 'text') {
    const annW = 0.15
    const annH = 0.03
    return rx >= x && rx <= x + annW && ry >= y && ry <= y + annH
  }

  if (ann.toolType === 'arrow' && w !== undefined && h !== undefined) {
    return pointToLineDist(rx, ry, x, y, x + w, y + h) < 0.03
  }

  if (w !== undefined && h !== undefined) {
    const minX = w >= 0 ? x : x + w
    const maxX = w >= 0 ? x + w : x
    const minY = h >= 0 ? y : y + h
    const maxY = h >= 0 ? y + h : y
    return rx >= minX && rx <= maxX && ry >= minY && ry <= maxY
  }

  return false
}

function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const a = px - x1, b = py - y1, c = x2 - x1, d = y2 - y1
  const dot = a * c + b * d
  const lenSq = c * c + d * d
  if (lenSq === 0) return Math.sqrt(a * a + b * b)
  let param = dot / lenSq
  if (param < 0) param = 0
  if (param > 1) param = 1
  const xx = x1 + param * c
  const yy = y1 + param * d
  const dx = px - xx, dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

// ============ Zoom / Pan ============

function onWheel(event: WheelEvent): void {
  if (!containerRef.value || !imageLoaded.value) return
  const rect = containerRef.value.getBoundingClientRect()
  viewer.handleWheel(event, rect)
  triggerRender()
}

function onTouchStart(event: TouchEvent): void {
  if (!containerRef.value || !imageLoaded.value) return
  if (event.touches.length === 2) {
    const rect = containerRef.value.getBoundingClientRect()
    viewer.handleTouchStart(event, rect)
  }
}

function onTouchMove(event: TouchEvent): void {
  if (!containerRef.value || !imageLoaded.value) return
  if (event.touches.length >= 2) {
    const rect = containerRef.value.getBoundingClientRect()
    viewer.handleTouchMove(event, rect)
    triggerRender()
  }
}

function onTouchEnd(): void {
  viewer.handleTouchEnd()
}

function toggleZoom(): void {
  if (!containerRef.value || !imageLoaded.value) return
  const rect = containerRef.value.getBoundingClientRect()
  if (viewer.isZoomedIn()) {
    viewer.fitToScreen(naturalWidth.value, naturalHeight.value, rect.width, rect.height)
  } else {
    viewer.zoomTo(1, rect.width / 2, rect.height / 2)
  }
  triggerRender()
}

// ============ Keyboard ============

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (selectedAnnotationId.value) {
      selectedAnnotationId.value = null
      triggerRender()
      event.preventDefault()
      return
    }
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedAnnotationId.value) {
      store.removeAnnotation(selectedAnnotationId.value)
      emit('annotation-deleted', selectedAnnotationId.value)
      selectedAnnotationId.value = null
      triggerRender()
      event.preventDefault()
      return
    }
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('prev')
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    emit('next')
  } else if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    viewer.toggleFullscreen()
    emit('fullscreen-toggle', viewer.isFullscreen.value)
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    viewer.zoomIn(1.25)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    viewer.zoomOut(1.25)
  } else if (event.key === '0') {
    event.preventDefault()
    viewer.resetView()
  }
}

function onGlobalKeydown(event: KeyboardEvent): void {
  // F-21-2: 空格按住=临时抓手
  if (event.code === 'Space' && !event.repeat) {
    const el = document.activeElement
    if (el && (el === containerRef.value || containerRef.value?.contains(el))) {
      event.preventDefault()
      isSpacePanning = true
      if (containerRef.value) {
        containerRef.value.style.cursor = 'grab'
      }
      return
    }
  }

  // F-21-1: A键切换画笔/箭头
  if (event.key.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey) {
    const el = document.activeElement
    const tag = el ? el.tagName.toLowerCase() : ''
    if (tag !== 'input' && tag !== 'textarea' && !el?.getAttribute('contenteditable')) {
      event.preventDefault()
      emit('tool-toggle')
      return
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    store.redo()
    triggerRender()
    return
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    store.undo()
    triggerRender()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    store.redo()
    triggerRender()
    return
  }
  // 4.6: Ctrl/Cmd+D - 复制选中标注
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    copySelectedAnnotation()
    return
  }
  // 4.6: Ctrl/Cmd+G - 跳转页码
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
    event.preventDefault()
    openPageInput()
    return
  }
  // 4.6: Tab - 聚焦下一个意见卡片
  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
    const el = document.activeElement
    if (el === containerRef.value || containerRef.value?.contains(el)) {
      event.preventDefault()
      emit('focus-next-card')
      return
    }
  }
}

function onGlobalKeyup(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    isSpacePanning = false
    viewer.handleMouseUp(true)
    if (containerRef.value) {
      containerRef.value.style.cursor = ''
    }
  }
}

// ============ 4.1: 页码跳转 ============

function openPageInput() {
  showPageInput.value = true
  pageInputValue.value = (props.currentIndex || 0) + 1
  nextTick(() => {
    pageInputRef.value?.focus()
    pageInputRef.value?.select()
  })
}

function closePageInput() {
  showPageInput.value = false
}

function gotoPage() {
  const page = pageInputValue.value
  if (page >= 1 && page <= (props.totalCount || 0)) {
    emit('goto-page', page - 1)
  }
  closePageInput()
}

// ============ 4.3: 旋转 ============

function rotateImage() {
  rotationAngle.value = (rotationAngle.value + 90) % 360
  rotationAngles.value[props.imageUrl] = rotationAngle.value
  if (!rotationToastShown.value) {
    rotationToastShown.value = true
    const toastEl = document.querySelector('.toast-container')
    if (toastEl) {
      // Use simple toast via DOM
      const div = document.createElement('div')
      div.className = 'toast-item toast-info'
      div.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2000;padding:10px 24px;border-radius:8px;background:#1a73e8;color:#fff;font-size:14px;animation:fadeIn 0.3s ease;'
      div.textContent = '旋转仅影响浏览视图，不会修改原图'
      document.body.appendChild(div)
      setTimeout(() => div.remove(), 3000)
    }
  }
}

// ============ 4.4: 预设短语 ============

async function fetchPresetPhrases() {
  try {
    const res = await annotationApi.getPresetPhrases()
    if (res.data.data && res.data.data.length > 0) {
      presetPhrases.value = res.data.data
    }
  } catch {
    // 使用默认短语
  }
}

function onPresetPhraseSelected(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value) {
    textInputValue.value = select.value
    select.value = ''
    nextTick(() => {
      textInputRef.value?.focus()
    })
  }
}

// ============ 4.5: 框选实时尺寸 ============

function updateSizeOverlay(event: MouseEvent) {
  showSizeOverlay.value = true
  const pos = getCanvasPos(event.clientX, event.clientY)
  const rel1 = toRelative(drawStartX.value, drawStartY.value)
  const rel2 = toRelative(pos.x, pos.y)
  const w = Math.abs(rel2.x - rel1.x) * displayWidth.value
  const h = Math.abs(rel2.y - rel1.y) * displayHeight.value
  sizeOverlayText.value = `${Math.round(w)}×${Math.round(h)} px`
  sizeOverlayPos.value = { x: event.clientX + 12, y: event.clientY - 12 }
}

// ============ 4.6: 复制选中标注 ============

function copySelectedAnnotation() {
  if (!selectedAnnotationId.value) return
  const ann = props.annotations.find(a => a.id === selectedAnnotationId.value)
  if (!ann) return
  const params: AnnotationCreateParams = {
    toolType: ann.toolType,
    coordinates: { ...ann.coordinates },
    style: { ...ann.style },
    strokeData: ann.strokeData ? [...ann.strokeData.map(p => [p[0], p[1]])] : undefined,
    text: ann.text
  }
  const newAnn = store.addAnnotation(params)
  emit('annotation-created', newAnn)
}

// ============ 4.7: 草稿恢复 ============

function checkDraft() {
  if (props.cardDraftText) {
    showDraftBanner.value = true
  } else {
    showDraftBanner.value = false
  }
}

function restoreDraft() {
  if (props.cardDraftText) {
    emit('draft-restore', props.cardDraftText)
  }
  showDraftBanner.value = false
}

function ignoreDraft() {
  emit('draft-ignore')
  showDraftBanner.value = false
}

// ============ 4.15: 模糊占位 ============

function setupBlurPlaceholder() {
  if (progressiveImage.value) {
    blurSrc.value = progressiveImage.value.thumbnailUrl
  } else {
    blurSrc.value = ''
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.image-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $color-bg-dark;
  cursor: default;
  outline: none;
  user-select: none;
  -webkit-user-select: none;

  &--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }
}

// ============ Loading ============

.image-viewer__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
  background: $color-bg-dark;
}

.image-viewer__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: $color-primary-light;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.image-viewer__loading-text {
  font-size: 14px;
  color: $color-text-muted;
}

// ============ Fullscreen Button ============

.image-viewer__fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;

  .image-viewer:hover & {
    opacity: 0.7;
  }

  &:hover {
    opacity: 1 !important;
    background: rgba(0, 0, 0, 0.7);
  }
}

// ============ Position indicator ============

.image-viewer__position-indicator {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

// ============ Stage ============

.image-viewer__stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// Image styles moved to the bottom with z-index

.image-viewer__canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

// ============ Text Input ============

.image-viewer__text-input {
  position: absolute;
  z-index: 15;
  background: transparent;
  border: none;
  border-bottom: 1px dashed currentColor;
  outline: none;
  font-family: inherit;
  min-width: 80px;
  padding: 0 2px;
  line-height: 1.2;

  &::placeholder {
    opacity: 0;
  }
}

// ============ Error ============

.image-viewer__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  background: $color-bg-dark;
  color: $color-text-secondary;
  font-size: 14px;
}

.image-viewer__error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba($color-error, 0.15);
  color: $color-error;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}

.image-viewer__retry-btn {
  padding: 6px 18px;
  border-radius: $radius-md;
  background: rgba($color-primary-light, 0.2);
  color: $color-primary-light;
  font-size: 13px;
  transition: background 0.2s;

  &:hover {
    background: rgba($color-primary-light, 0.3);
  }
}

// ============ 4.1: 页码指示器 ============

.image-viewer__page-indicator {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-label {
  padding: 4px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.page-input {
  width: 70px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  text-align: center;
  outline: none;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

// ============ 4.3: 旋转按钮 ============

.image-viewer__rotate-btn {
  position: absolute;
  top: 12px;
  right: 56px;
  z-index: 20;
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;

  .image-viewer:hover & {
    opacity: 0.7;
  }

  &:hover {
    opacity: 1 !important;
    background: rgba(0, 0, 0, 0.7);
  }
}

// ============ 4.4: 文字工具预设短语 ============

.image-viewer__text-toolbar {
  position: absolute;
  z-index: 16;
  display: flex;
  align-items: center;
  gap: 4px;
}

.preset-phrase-select {
  padding: 2px 6px;
  border-radius: $radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 11px;
  outline: none;
  height: 22px;
  cursor: pointer;

  &:focus {
    border-color: $color-primary-light;
  }

  option {
    background: #1e1e2e;
    color: #fff;
  }
}

// ============ 4.5: 框选实时尺寸 ============

.image-viewer__size-overlay {
  position: fixed;
  z-index: 100;
  padding: 2px 8px;
  border-radius: $radius-sm;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 11px;
  font-family: $font-mono;
  white-space: nowrap;
  pointer-events: none;
}

// ============ 4.7: 草稿恢复横幅 ============

.image-viewer__draft-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(#fbbc04, 0.9);
  color: #5f4b00;
  font-size: 13px;
  font-weight: 500;
}

.btn-draft-restore {
  padding: 3px 14px;
  border-radius: $radius-sm;
  background: #fff;
  color: #5f4b00;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;

  &:hover {
    background: #fff3cd;
  }
}

.btn-draft-ignore {
  padding: 3px 10px;
  border-radius: $radius-sm;
  background: transparent;
  color: #5f4b00;
  font-size: 12px;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
}

// ============ 4.15: 模糊占位 ============

.image-viewer__blur-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  filter: blur(10px);
  transition: opacity 0.4s ease;
  z-index: 1;

  &--hidden {
    opacity: 0;
  }
}

.image-viewer__image {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  pointer-events: none;
  z-index: 2;

  &--loaded {
    animation: fadeIn 0.4s ease;
  }
}