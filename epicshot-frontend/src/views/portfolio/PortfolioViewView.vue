<template>
  <div class="portfolio-view">
    <div class="portfolio-scroll">
      <!-- 封面 -->
      <section class="cover-page">
        <div class="cover-bg" :style="coverBgStyle"></div>
        <div class="cover-content">
          <img v-if="portfolio?.workspaceLogo" :src="portfolio.workspaceLogo" class="cover-logo" />
          <div v-else class="cover-logo-placeholder">EPX</div>
          <h1 class="cover-client">{{ portfolio?.clientName || '作品集' }}</h1>
        </div>
        <div class="view-count" v-if="portfolio">
          <span>👁️ {{ portfolio.views }} 次浏览</span>
        </div>
      </section>

      <!-- 图片画廊 -->
      <section class="gallery-section">
        <div class="gallery-track" ref="galleryRef">
          <div
            v-for="(img, idx) in images"
            :key="idx"
            class="gallery-slide"
            :class="{ active: currentSlide === idx }"
          >
            <img :src="img.url" :alt="'image-' + idx" class="gallery-image" />
            <p v-if="img.description" class="gallery-desc">{{ img.description }}</p>
          </div>
        </div>

        <!-- 轮播指示器 -->
        <div class="gallery-dots" v-if="images.length > 1">
          <button
            v-for="(_, idx) in images"
            :key="idx"
            class="dot"
            :class="{ active: currentSlide === idx }"
            @click="currentSlide = idx"
          ></button>
        </div>

        <!-- 左右箭头 -->
        <button
          v-if="images.length > 1"
          class="gallery-arrow gallery-arrow--left"
          @click="prevSlide"
        >
          ‹
        </button>
        <button
          v-if="images.length > 1"
          class="gallery-arrow gallery-arrow--right"
          @click="nextSlide"
        >
          ›
        </button>
      </section>

      <!-- 底部联系信息 -->
      <footer class="contact-footer" v-if="portfolio">
        <div class="contact-text" v-if="portfolio.contactInfo">
          <p>{{ portfolio.contactInfo }}</p>
        </div>
        <div class="qr-section">
          <img v-if="portfolio.qrCode" :src="portfolio.qrCode" class="qr-img" />
          <div v-else class="qr-placeholder">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <rect width="100" height="100" fill="#f1f3f4" />
              <text x="50" y="52" text-anchor="middle" fill="#9aa0a6" font-size="12">二维码</text>
            </svg>
          </div>
          <span class="qr-text">扫码联系</span>
        </div>
      </footer>
    </div>

    <!-- 加载/错误 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-pulse">加载中...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <p>作品集不存在或已下架</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { portfolioApi } from '@/api/ai'
import type { Portfolio } from '@/types/models'

const route = useRoute()
const portfolioId = computed(() => route.params.id as string)

const portfolio = ref<Portfolio | null>(null)
const images = computed(() => portfolio.value?.images || [])
const currentSlide = ref(0)
const loading = ref(true)
const error = ref(false)

const galleryRef = ref<HTMLElement | null>(null)

const coverBgStyle = computed(() => {
  if (portfolio.value?.coverUrl) {
    return { backgroundImage: `url(${portfolio.value.coverUrl})` }
  }
  return {}
})

function prevSlide() {
  if (currentSlide.value > 0) {
    currentSlide.value--
  }
}

function nextSlide() {
  if (currentSlide.value < images.value.length - 1) {
    currentSlide.value++
  }
}

onMounted(async () => {
  loading.value = true
  error.value = false
  try {
    const res = await portfolioApi.get(portfolioId.value)
    portfolio.value = res.data.data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.portfolio-view {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: $color-surface;
}

.portfolio-scroll {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

// 封面
.cover-page {
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  scroll-snap-align: start;
  color: #fff;

  .cover-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #667eea, #764ba2);
    background-size: cover;
    background-position: center;
    z-index: 0;
  }
}

.cover-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cover-logo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.5);
}

.cover-logo-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 28px;
  border: 3px solid rgba(255, 255, 255, 0.5);
}

.cover-client {
  font-size: 28px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
}

.view-count {
  position: absolute;
  bottom: 40px;
  z-index: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

// 画廊
.gallery-section {
  height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  scroll-snap-align: start;
  overflow: hidden;
}

.gallery-track {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.gallery-slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.4s ease;

  &.active {
    opacity: 1;
  }
}

.gallery-image {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
}

.gallery-desc {
  margin-top: 16px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  max-width: 80%;
  line-height: 1.5;
}

.gallery-dots {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: background 0.2s;

  &.active {
    background: #fff;
  }
}

.gallery-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 40px;
  color: rgba(255, 255, 255, 0.6);
  padding: 12px;
  border-radius: 50%;
  transition: color 0.2s;
  z-index: 2;

  &:hover {
    color: #fff;
  }

  &--left { left: 12px; }
  &--right { right: 12px; }
}

// 底部联系
.contact-footer {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 20px;
  background: $color-surface;
  scroll-snap-align: start;
}

.contact-text {
  font-size: 15px;
  color: $color-text-secondary;
  line-height: 1.6;
  text-align: center;
  max-width: 300px;
  white-space: pre-line;
}

.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qr-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.qr-placeholder {
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid $color-border-light;
}

.qr-text {
  font-size: 13px;
  color: $color-text-muted;
}

// 加载/错误状态
.loading-state, .error-state {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: $color-text-secondary;
  background: $color-bg;
}
</style>