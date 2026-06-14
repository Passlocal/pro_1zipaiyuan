<template>
  <div
    class="video-viewer"
    :class="{ 'video-viewer--loaded': isLoaded }"
    @mousemove="showControls"
    @mouseleave="hideControlsTimer"
  >
    <!-- Video element -->
    <video
      ref="videoRef"
      class="video-viewer__video"
      :src="videoUrl"
      :poster="posterUrl"
      preload="metadata"
      crossorigin="anonymous"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onVideoError"
      @click="togglePlay"
    ></video>

    <!-- Loading overlay -->
    <div v-if="loading" class="video-viewer__loading">
      <div class="video-viewer__spinner"></div>
    </div>

    <!-- Play/Pause center overlay -->
    <div v-if="showCenterPlay" class="video-viewer__center-play" @click="togglePlay">
      <div class="video-viewer__play-icon">
        <svg v-if="paused" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <rect x="5" y="3" width="5" height="18" rx="1"/>
          <rect x="14" y="3" width="5" height="18" rx="1"/>
        </svg>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="video-viewer__error">
      <span>视频加载失败</span>
      <button class="video-viewer__retry-btn" @click="retryLoad">重试</button>
    </div>

    <!-- Bottom controls bar -->
    <div class="video-viewer__controls" :class="{ 'video-viewer__controls--visible': controlsVisible && !loading }">
      <!-- Timeline scrubber -->
      <div class="video-viewer__timeline" ref="timelineRef" @mousedown.prevent="startScrub" @touchstart.prevent="startScrubTouch">
        <div class="video-viewer__timeline-track">
          <div class="video-viewer__timeline-progress" :style="{ width: progressPercent + '%' }"></div>
          <div class="video-viewer__timeline-buffered" :style="{ width: bufferedPercent + '%' }"></div>
        </div>
      </div>

      <div class="video-viewer__controls-row">
        <!-- Left group -->
        <div class="video-viewer__controls-left">
          <button class="video-viewer__btn" @click="stepBackward" title="后退一帧 (,)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="19 20 9 12 19 4"/>
              <line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>

          <button class="video-viewer__btn video-viewer__btn--play" @click="togglePlay">
            <svg v-if="paused" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <polygon points="6,3 20,12 6,21"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <rect x="5" y="3" width="5" height="18" rx="1"/>
              <rect x="14" y="3" width="5" height="18" rx="1"/>
            </svg>
          </button>

          <button class="video-viewer__btn" @click="stepForward" title="前进一帧 (.)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="5 4 15 12 5 20"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          <span class="video-viewer__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        </div>

        <!-- Right group -->
        <div class="video-viewer__controls-right">
          <button class="video-viewer__btn" @click="captureFrame" title="截取当前帧">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          <div class="video-viewer__volume" @mouseenter="showVolumeSlider = true" @mouseleave="showVolumeSlider = false">
            <button class="video-viewer__btn" @click="toggleMute">
              <svg v-if="muted || volume === 0" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
              <svg v-else-if="volume < 0.5" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>
                <path d="M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            </button>
            <input
              v-show="showVolumeSlider"
              type="range"
              class="video-viewer__volume-slider"
              min="0"
              max="1"
              step="0.05"
              :value="volume"
              @input="setVolume"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  videoUrl: string
}>()

const emit = defineEmits<{
  (e: 'frame-captured', blob: Blob): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const timelineRef = ref<HTMLDivElement | null>(null)

const loading = ref(true)
const isLoaded = ref(false)
const loadError = ref(false)
const paused = ref(true)
const ended = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const bufferedPercent = ref(0)
const volume = ref(1)
const muted = ref(false)
const posterUrl = ref('')

const controlsVisible = ref(true)
const showCenterPlay = ref(true)
const showVolumeSlider = ref(false)
let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null

const progressPercent = ref(0)

const FRAME_STEP = 1 / 30

// ============ Lifecycle ============

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

onUnmounted(() => {
  if (hideControlsTimeout) clearTimeout(hideControlsTimeout)
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
})

watch(() => props.videoUrl, () => {
  loading.value = true
  loadError.value = false
  isLoaded.value = false
  posterUrl.value = ''
  currentTime.value = 0
  duration.value = 0
  paused.value = true
  ended.value = false
})

// ============ Video events ============

function onLoadedMetadata(): void {
  const video = videoRef.value
  if (!video) return

  duration.value = video.duration
  loading.value = false
  isLoaded.value = true
  loadError.value = false

  // Generate poster from first frame
  generatePoster()
}

function onTimeUpdate(): void {
  const video = videoRef.value
  if (!video) return

  currentTime.value = video.currentTime
  if (duration.value > 0) {
    progressPercent.value = (video.currentTime / duration.value) * 100
  }

  // Update buffered
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1)
    bufferedPercent.value = (bufferedEnd / duration.value) * 100
  }
}

function onPlay(): void {
  paused.value = false
  ended.value = false
  showCenterPlay.value = false
}

function onPause(): void {
  paused.value = true
}

function onEnded(): void {
  ended.value = true
  paused.value = true
  showCenterPlay.value = true
}

function onVideoError(): void {
  loading.value = false
  loadError.value = true
  isLoaded.value = false
}

function retryLoad(): void {
  loading.value = true
  loadError.value = false
  if (videoRef.value) {
    const url = props.videoUrl
    videoRef.value.src = ''
    videoRef.value.load()
    setTimeout(() => { videoRef.value!.src = url }, 50)
  }
}

// ============ Playback controls ============

function togglePlay(): void {
  const video = videoRef.value
  if (!video) return

  if (video.paused || ended.value) {
    if (ended.value) video.currentTime = 0
    video.play().catch(() => { /* autoplay blocked */ })
  } else {
    video.pause()
  }
}

function stepForward(): void {
  const video = videoRef.value
  if (!video) return
  video.currentTime = Math.min(video.duration, video.currentTime + FRAME_STEP)
}

function stepBackward(): void {
  const video = videoRef.value
  if (!video) return
  video.currentTime = Math.max(0, video.currentTime - FRAME_STEP)
}

// ============ Timeline scrubber ============

function startScrub(event: MouseEvent): void {
  const video = videoRef.value
  if (!video || !duration.value) return

  video.pause()
  seekToPosition(event.clientX)

  const onMove = (e: MouseEvent) => seekToPosition(e.clientX)
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startScrubTouch(event: TouchEvent): void {
  const video = videoRef.value
  if (!video || !duration.value || !event.touches[0]) return

  video.pause()
  seekToPosition(event.touches[0].clientX)

  const onMove = (e: TouchEvent) => {
    if (e.touches[0]) seekToPosition(e.touches[0].clientX)
  }
  const onEnd = () => {
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  }

  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd)
}

function seekToPosition(clientX: number): void {
  const timeline = timelineRef.value
  const video = videoRef.value
  if (!timeline || !video) return

  const rect = timeline.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  video.currentTime = ratio * duration.value
  currentTime.value = video.currentTime
}

// ============ Volume ============

function toggleMute(): void {
  const video = videoRef.value
  if (!video) return

  video.muted = !video.muted
  muted.value = video.muted
}

function setVolume(event: Event): void {
  const target = event.target as HTMLInputElement
  const video = videoRef.value
  if (!video) return

  video.volume = parseFloat(target.value)
  volume.value = video.volume
  muted.value = video.muted
}

// ============ Frame capture ============

function captureFrame(): void {
  const video = videoRef.value
  if (!video) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0)
  canvas.toBlob(blob => {
    if (blob) {
      emit('frame-captured', blob)
    }
  }, 'image/png')
}

// ============ Poster generation ============

function generatePoster(): void {
  const video = videoRef.value
  if (!video || !video.videoWidth) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  video.currentTime = 0

  const onSeeked = () => {
    ctx.drawImage(video, 0, 0)
    posterUrl.value = canvas.toDataURL('image/jpeg', 0.7)
    video.removeEventListener('seeked', onSeeked)
  }

  video.addEventListener('seeked', onSeeked)
}

// ============ Controls visibility ============

function showControls(): void {
  controlsVisible.value = true
  showCenterPlay.value = true

  if (hideControlsTimeout) clearTimeout(hideControlsTimeout)
  hideControlsTimeout = setTimeout(() => {
    if (!paused.value) {
      controlsVisible.value = false
      showCenterPlay.value = false
    }
  }, 2500)
}

function hideControlsTimer(): void {
  if (hideControlsTimeout) clearTimeout(hideControlsTimeout)
  if (!paused.value) {
    hideControlsTimeout = setTimeout(() => {
      controlsVisible.value = false
      showCenterPlay.value = false
    }, 1500)
  }
}

// ============ Time formatting ============

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.video-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;

  &--loaded {
    background: #000;
  }
}

// ============ Video ============

.video-viewer__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

// ============ Loading ============

.video-viewer__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  background: rgba(0, 0, 0, 0.6);
}

.video-viewer__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: $color-primary-light;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ============ Center play button ============

.video-viewer__center-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  cursor: pointer;
}

.video-viewer__play-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, background 0.15s;
  padding-left: 4px; // visual centering for triangle icon

  &:hover {
    background: rgba(0, 0, 0, 0.75);
    transform: scale(1.08);
  }
}

// ============ Error ============

.video-viewer__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.85);
  color: $color-text-secondary;
  font-size: 14px;
}

.video-viewer__retry-btn {
  padding: 6px 18px;
  border-radius: $radius-md;
  background: rgba($color-primary-light, 0.2);
  color: $color-primary-light;
  font-size: 13px;
  transition: background 0.2s;

  &:hover {
    background: rgba($color-primary-light, 0.35);
  }
}

// ============ Controls bar ============

.video-viewer__controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  z-index: 10;
  opacity: 0;
  transition: opacity 0.3s ease;

  &--visible {
    opacity: 1;
  }
}

.video-viewer__controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 10px;
  gap: 12px;
}

.video-viewer__controls-left,
.video-viewer__controls-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

// ============ Timeline ============

.video-viewer__timeline {
  padding: 8px 12px 0;
  cursor: pointer;

  &:hover .video-viewer__timeline-track {
    height: 5px;
  }

  &:hover .video-viewer__timeline-progress::after {
    opacity: 1;
  }
}

.video-viewer__timeline-track {
  position: relative;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  transition: height 0.15s;
}

.video-viewer__timeline-buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.video-viewer__timeline-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: $color-primary-light;
  border-radius: 2px;

  &::after {
    content: '';
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background: $color-primary-light;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

// ============ Buttons ============

.video-viewer__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  color: #fff;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  &--play {
    width: 36px;
    height: 36px;
  }
}

// ============ Time display ============

.video-viewer__time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
  white-space: nowrap;
}

// ============ Volume ============

.video-viewer__volume {
  position: relative;
  display: flex;
  align-items: center;
}

.video-viewer__volume-slider {
  position: absolute;
  bottom: 44px;
  left: 50%;
  transform: translateX(-50%) rotate(-90deg);
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    border: none;
  }
}
</style>