<template>
  <div class="portfolio-editor">
    <div class="editor-header">
      <!-- NAV-02: 面包屑导航 -->
      <nav class="breadcrumb-nav">
        <router-link to="/projects" class="breadcrumb-link">项目看板</router-link>
        <span class="breadcrumb-sep">›</span>
        <router-link :to="`/project/${projectId}`" class="breadcrumb-link">项目详情</router-link>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">作品集编辑</span>
      </nav>
      <div class="header-actions">
        <button
          class="btn-generate"
          :disabled="generating"
          @click="generatePortfolio"
        >
          <span v-if="generating" class="loading-pulse">生成中...</span>
          <span v-else>✨ 生成作品集</span>
        </button>
      </div>
    </div>

    <!-- UX-40: 封面设置 -->
    <div class="cover-settings">
      <h3 class="cover-settings-title">封面设置</h3>
      <div class="cover-settings-row">
        <div class="cover-settings-field">
          <label class="cover-settings-label">标题</label>
          <input
            v-model="portfolioSettings.coverTitle"
            type="text"
            class="form-input"
            placeholder="输入封面标题"
          />
        </div>
        <div class="cover-settings-field">
          <label class="cover-settings-label">字体大小</label>
          <select v-model.number="portfolioSettings.titleFontSize" class="form-input">
            <option v-for="s in [12,14,16,18,20,24]" :key="s" :value="s">{{ s }}px</option>
          </select>
        </div>
        <div class="cover-settings-field">
          <label class="cover-settings-label">标题颜色</label>
          <input
            v-model="portfolioSettings.titleColor"
            type="color"
            class="form-color-input"
          />
        </div>
        <div class="cover-settings-field">
          <label class="cover-settings-label">Logo</label>
          <label class="btn-upload-logo">
            <input type="file" accept="image/*" @change="handleLogoUpload" hidden />
            {{ portfolioSettings.logoUrl ? '更换Logo' : '上传Logo' }}
          </label>
          <img v-if="portfolioSettings.logoUrl" :src="portfolioSettings.logoUrl" class="logo-preview" />
        </div>
      </div>
    </div>

    <!-- UX-22: 布局模板选择器 -->
    <div class="template-selector">
      <span class="template-label">布局模板：</span>
      <button
        v-for="tpl in templates"
        :key="tpl.id"
        class="btn-template"
        :class="{ active: activeTemplate === tpl.id }"
        @click="activeTemplate = tpl.id"
      >
        <span class="tpl-icon">{{ tpl.icon }}</span>
        <span class="tpl-name">{{ tpl.name }}</span>
      </button>
    </div>

    <!-- 生成进度 -->
    <div v-if="generating" class="generating-overlay">
      <div class="generating-card">
        <span class="generating-icon">✨</span>
        <p class="generating-text">AI 正在生成作品集...</p>
        <div class="generating-bar">
          <div class="generating-fill"></div>
        </div>
      </div>
    </div>

    <!-- 预览区：H5 手机框架 -->
    <div class="editor-body">
      <div class="preview-area">
        <div class="phone-frame" :style="phoneFrameStyle">
          <div class="phone-screen">
            <!-- 封面 -->
            <div class="cover-section">
              <img v-if="workspaceLogo" :src="workspaceLogo" class="cover-logo" />
              <div v-else class="cover-logo-placeholder">EPX</div>
              <h2 class="cover-client">{{ clientName }}</h2>
              <div class="cover-bg" :style="coverBgStyle"></div>
            </div>

            <!-- 图片列表 -->
            <div class="image-list" :class="'layout-' + activeTemplateConfig.layout">
              <div
                v-for="(img, idx) in portfolioImages"
                :key="idx"
                class="image-item"
                draggable="true"
                @dragstart="onDragStart(idx)"
                @dragover.prevent
                @drop="onDrop(idx)"
              >
                <img :src="img.url" :alt="'img-' + idx" />
                <textarea
                  v-model="img.description"
                  class="image-desc"
                  placeholder="输入图片描述..."
                  rows="2"
                ></textarea>
                <button class="btn-move" title="拖拽排序">⋮⋮</button>
              </div>
              <div v-if="portfolioImages.length === 0" class="image-empty">
                <span>暂无图片，请先生成作品集</span>
              </div>
            </div>

            <!-- 联系区 -->
            <div class="contact-section">
              <div class="contact-info">
                <label class="contact-label">联系信息</label>
                <textarea
                  v-model="contactInfo"
                  class="contact-input"
                  placeholder="输入联系方式..."
                  rows="3"
                ></textarea>
              </div>
              <div class="qr-area">
                <div class="qr-placeholder">
                  <svg viewBox="0 0 80 80" width="80" height="80">
                    <rect width="80" height="80" fill="#f1f3f4" />
                    <text x="40" y="42" text-anchor="middle" fill="#9aa0a6" font-size="10">二维码</text>
                  </svg>
                </div>
                <span class="qr-label">扫码联系</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 背景图上传 -->
      <div class="sidebar-tools">
        <div class="tool-section">
          <h3 class="tool-title">封面背景</h3>
          <div class="bg-upload" @click="triggerBgUpload">
            <img v-if="coverBgPreview" :src="coverBgPreview" class="bg-preview" />
            <span v-else class="bg-placeholder">点击上传背景图</span>
            <input
              ref="bgInputRef"
              type="file"
              accept="image/*"
              hidden
              @change="onBgChange"
            />
          </div>
        </div>

        <div class="tool-section">
          <h3 class="tool-title">客户名称</h3>
          <input
            v-model="clientName"
            type="text"
            class="form-input"
            placeholder="输入客户名称"
          />
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="editor-footer">
      <button class="btn-save" :disabled="saving" @click="savePortfolio">
        {{ saving ? '保存中...' : '保存' }}
      </button>
      <button class="btn-publish" :disabled="publishing" @click="publishPortfolio">
        {{ publishing ? '发布中...' : '发布' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { portfolioApi } from '@/api/ai'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { PortfolioImage } from '@/types/models'

const toast = useToast()

const route = useRoute()
const authStore = useAuthStore()

const projectId = computed(() => route.params.projectId as string)

const generating = ref(false)
const saving = ref(false)
const publishing = ref(false)

// UX-55: 作品集多模板
const templates = [
  { id: 'magazine', name: '杂志风', icon: '📰', config: { layout: 'masonry', gap: 12, bgColor: '#1a1a1a', fontFamily: 'serif', accentColor: '#e63946', textColor: '#ffffff' } },
  { id: 'ecommerce', name: '电商风', icon: '🛍️', config: { layout: 'grid', gap: 16, bgColor: '#ffffff', fontFamily: 'sans-serif', accentColor: '#ff6600', textColor: '#333333' } },
  { id: 'minimal', name: '极简风', icon: '⬜', config: { layout: 'single', gap: 24, bgColor: '#fafafa', fontFamily: 'sans-serif', accentColor: '#333333', textColor: '#666666' } },
  { id: 'wedding', name: '婚礼风', icon: '💐', config: { layout: 'grid', gap: 8, bgColor: '#fdf6f0', fontFamily: 'cursive', accentColor: '#c9a96e', textColor: '#8b7355' } },
]
const activeTemplate = ref('magazine')

const activeTemplateConfig = computed(() => {
  return templates.find(t => t.id === activeTemplate.value)?.config || templates[0].config
})

const phoneFrameStyle = computed(() => ({
  '--tpl-bg-color': activeTemplateConfig.value.bgColor,
  '--tpl-font-family': activeTemplateConfig.value.fontFamily,
  '--tpl-accent-color': activeTemplateConfig.value.accentColor,
  '--tpl-text-color': activeTemplateConfig.value.textColor,
  '--tpl-gap': activeTemplateConfig.value.gap + 'px',
}))

const portfolioId = ref('')
const portfolio = ref<any>(null)
const clientName = ref('')
const contactInfo = ref('')
const portfolioImages = ref<PortfolioImage[]>([])

const coverBgFile = ref<File | null>(null)
const coverBgPreview = ref('')
const bgInputRef = ref<HTMLInputElement | null>(null)

// UX-40: 封面设置
const portfolioSettings = ref({
  coverTitle: '',
  titleFontSize: 18,
  titleColor: '#ffffff',
  logoUrl: '',
  logoFile: null as File | null,
})

function handleLogoUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    portfolioSettings.value.logoFile = input.files[0]
    portfolioSettings.value.logoUrl = URL.createObjectURL(input.files[0])
  }
}

const workspaceLogo = computed(() => authStore.workspace?.logoUrl || '')

const coverBgStyle = computed(() => {
  if (coverBgPreview.value) {
    return { backgroundImage: `url(${coverBgPreview.value})` }
  }
  return {}
})

function triggerBgUpload() {
  bgInputRef.value?.click()
}

function onBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    coverBgFile.value = input.files[0]
    coverBgPreview.value = URL.createObjectURL(input.files[0])
    // Upload immediately if portfolio exists
    if (portfolioId.value) {
      portfolioApi.uploadCover(portfolioId.value, input.files[0]).then(res => {
        if (portfolio.value) portfolio.value.coverUrl = res.data.data.url
      }).catch(err => {
        console.error('封面上传失败:', err)
      })
    }
  }
}

let dragIndex = -1

function onDragStart(idx: number) {
  dragIndex = idx
}

function onDrop(idx: number) {
  if (dragIndex < 0 || dragIndex === idx) return
  const list = [...portfolioImages.value]
  const [item] = list.splice(dragIndex, 1)
  list.splice(idx, 0, item)
  portfolioImages.value = list
  dragIndex = -1
}

async function generatePortfolio() {
  generating.value = true
  try {
    await portfolioApi.generate(projectId.value)
    const portfolioRes = await portfolioApi.get(projectId.value)
    const p = portfolioRes.data.data
    portfolio.value = p
    portfolioId.value = p.id
    clientName.value = p.clientName || clientName.value
    contactInfo.value = p.contactInfo || contactInfo.value
    portfolioImages.value = p.images || []
  } catch (e: any) {
    console.error('生成作品集失败:', e)
    toast.error('生成失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    generating.value = false
  }
}

async function savePortfolio() {
  if (!portfolioId.value) {
    toast.error('请先生成作品集')
    return
  }
  saving.value = true
  try {
    await portfolioApi.update(portfolioId.value, {
      images: portfolioImages.value,
      contactInfo: contactInfo.value,
      clientName: clientName.value,
      coverUrl: portfolio.value?.coverUrl || undefined,
    })
    toast.success('保存成功')
  } catch (e: any) {
    console.error('保存失败:', e)
    toast.error('保存失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    saving.value = false
  }
}

async function publishPortfolio() {
  if (!confirm('确认发布作品集？发布后客户将可以查看。')) return
  publishing.value = true
  try {
    await portfolioApi.update(portfolioId.value!, {
      images: portfolioImages.value,
      contactInfo: contactInfo.value,
      clientName: clientName.value,
      coverUrl: portfolio.value?.coverUrl || undefined,
      isPublished: true,
    })
    if (portfolio.value) portfolio.value.isPublished = true
    toast.success('发布成功')
  } catch (e: any) {
    console.error('发布失败:', e)
    toast.error('发布失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    publishing.value = false
  }
}

onMounted(() => {
  portfolioApi.get(projectId.value).then((res) => {
    const p = res.data.data
    if (p) {
      portfolio.value = p
      portfolioId.value = p.id
      clientName.value = p.clientName
      contactInfo.value = p.contactInfo
      portfolioImages.value = p.images || []
    }
  }).catch((e: any) => {
    // 区分 404 (尚未生成) 和 其他网络错误
    if (e?.response?.status !== 404) {
      console.error('获取作品集失败:', e)
      toast.error('加载作品集失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
    }
  })
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.portfolio-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid $color-border;
  flex-shrink: 0;

  .page-title {
    font-size: 18px;
    font-weight: 600;
    color: $color-text;
  }
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-generate {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.92;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

// UX-22: 模板选择器
.template-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

// UX-40: 封面设置
.cover-settings {
  padding: 16px 24px;
  border-bottom: 1px solid $color-border;
  background: $color-surface;
  flex-shrink: 0;
}

.cover-settings-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 12px;
}

.cover-settings-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.cover-settings-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cover-settings-label {
  font-size: 12px;
  font-weight: 500;
  color: $color-text-secondary;
}

.form-color-input {
  width: 40px;
  height: 36px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: 2px;
  cursor: pointer;
  background: #fff;
}

.btn-upload-logo {
  display: inline-block;
  padding: 6px 12px;
  background: #f0f7ff;
  color: #1a73e8;
  border: 1px dashed #1a73e8;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  &:hover { background: #e3f0ff; }
}

.logo-preview {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid $color-border;
  margin-top: 4px;
}

.template-label {
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
}

.btn-template {
  padding: 4px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
  &:hover { background: #e8e8e8; }
  &.active {
    background: #e8f0fe;
    color: #1a73e8;
    border-color: #1a73e8;
  }
}

.tpl-icon {
  margin-right: 2px;
  font-size: 14px;
}
.tpl-name {
  font-size: 12px;
}

// 生成进度
.generating-overlay {
  position: absolute;
  inset: 0;
  top: 57px;
  background: rgba($color-bg, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.generating-card {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 40px 48px;
  text-align: center;
  box-shadow: $shadow-lg;
}

.generating-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.generating-text {
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
  margin-bottom: 16px;
}

.generating-bar {
  width: 200px;
  height: 4px;
  background: $color-border-light;
  border-radius: 2px;
  overflow: hidden;

  .generating-fill {
    width: 30%;
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 2px;
    animation: generatingSlide 1.5s ease-in-out infinite;
  }
}

@keyframes generatingSlide {
  0% { width: 5%; }
  50% { width: 70%; }
  100% { width: 5%; }
}

// 主体区
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  padding: 24px;
}

.phone-frame {
  width: 320px;
  height: 640px;
  border: 8px solid #333;
  border-radius: 32px;
  overflow: hidden;
  background: $color-surface;
  box-shadow: $shadow-lg;

  --tpl-bg-color: #1a1a1a;
  --tpl-font-family: serif;
  --tpl-accent-color: #e63946;
  --tpl-text-color: #ffffff;
  --tpl-gap: 12px;
}

.phone-screen {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.cover-section {
  position: relative;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  z-index: 0;
  background: var(--tpl-bg-color);
  font-family: var(--tpl-font-family);

  .cover-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #667eea, #764ba2);
    background-size: cover;
    background-position: center;
    z-index: -1;
  }

  .cover-logo {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.4);
  }

  .cover-logo-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 16px;
    border: 2px solid rgba(255, 255, 255, 0.4);
  }

  .cover-client {
    font-size: 18px;
    font-weight: 600;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: var(--tpl-text-color);
  }
}

.image-list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: var(--tpl-gap);
  background: var(--tpl-bg-color);
}

.image-list.layout-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.image-list.layout-masonry {
  columns: 2;
  column-gap: var(--tpl-gap);
}

.image-list.layout-single {
  display: flex;
  flex-direction: column;
}

.image-item {
  border: 1px solid var(--tpl-accent-color, $color-border-light);
  border-radius: $radius-md;
  overflow: hidden;

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }

  .image-desc {
    width: 100%;
    padding: 8px;
    font-size: 12px;
    color: $color-text;
    border: none;
    border-top: 1px solid $color-border-light;
    outline: none;
    resize: none;
    background: $color-surface;
    font-family: inherit;

    &::placeholder {
      color: $color-text-muted;
    }
  }

  .btn-move {
    width: 100%;
    padding: 4px 0;
    font-size: 12px;
    color: $color-text-muted;
    text-align: center;
    border-top: 1px solid $color-border-light;
    cursor: grab;
    transition: background 0.15s;

    &:hover {
      background: $color-surface-hover;
    }
  }
}

.image-empty {
  text-align: center;
  padding: 20px 0;
  font-size: 13px;
  color: $color-text-muted;
}

.contact-section {
  padding: 12px;
  border-top: 1px solid $color-border-light;
  margin-top: auto;
}

.contact-info {
  margin-bottom: 10px;

  .contact-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: $color-text-secondary;
    margin-bottom: 4px;
  }

  .contact-input {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    color: $color-text;
    border: 1px solid $color-border-light;
    border-radius: $radius-sm;
    resize: none;
    outline: none;
    background: $color-surface;
    font-family: inherit;

    &::placeholder {
      color: $color-text-muted;
    }

    &:focus {
      border-color: $color-primary;
    }
  }
}

.qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.qr-placeholder {
  border-radius: $radius-sm;
  overflow: hidden;
  border: 1px solid $color-border-light;
}

.qr-label {
  font-size: 11px;
  color: $color-text-muted;
}

// 侧边栏工具
.sidebar-tools {
  width: 220px;
  border-left: 1px solid $color-border;
  padding: 16px;
  background: $color-surface;
  overflow-y: auto;
  flex-shrink: 0;
}

.tool-section {
  margin-bottom: 20px;

  .tool-title {
    font-size: 13px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: 8px;
  }
}

.bg-upload {
  height: 100px;
  border: 2px dashed $color-border;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;

  &:hover {
    border-color: $color-primary;
  }
}

.bg-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bg-placeholder {
  font-size: 12px;
  color: $color-text-muted;
}

.form-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-text;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
  }
}

// 底部
.editor-footer {
  height: 56px;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 24px;
  background: $color-surface;
  flex-shrink: 0;
}

.btn-save {
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: $color-primary;
    color: $color-primary;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-publish {
  padding: 8px 24px;
  background: $color-primary;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .cover-settings {
    padding: 12px 16px;
  }

  .cover-settings-row {
    flex-direction: column;
    gap: 10px;
  }

  .editor-body {
    flex-direction: column;
  }

  .preview-area {
    padding: 16px;
    overflow: auto;
  }

  .phone-frame {
    width: 280px;
    height: 520px;
    border-width: 6px;
    border-radius: 24px;
    flex-shrink: 0;
  }

  .sidebar-tools {
    width: 100%;
    border-left: none;
    border-top: 1px solid $color-border;
    padding: 12px 16px;
    max-height: 200px;
  }

  .editor-footer {
    padding: 0 16px;
    gap: 8px;
  }

  .btn-save,
  .btn-publish,
  .btn-generate {
    min-height: 44px;
    font-size: 15px;
  }

  .form-input {
    min-height: 44px;
    font-size: 16px;
  }

  .btn-template {
    min-height: 44px;
    padding: 8px 14px;
    font-size: 14px;
  }
}
</style>