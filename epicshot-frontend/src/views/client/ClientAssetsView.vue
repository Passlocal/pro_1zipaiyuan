<template>
  <div class="client-assets">
    <h1 class="page-title">我的项目</h1>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-pulse">加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="projects.length === 0" class="empty-state">
      <span class="empty-icon">📂</span>
      <p>暂无已完成的项目</p>
    </div>

    <!-- 项目卡片网格 -->
    <div v-else class="project-grid">
      <div
        v-for="proj in projects"
        :key="proj.id"
        class="project-card"
        @click="openProject(proj)"
      >
        <div class="card-thumbnail">
          <img v-if="proj.thumbnailUrl" :src="proj.thumbnailUrl" :alt="proj.clientName" />
          <div v-else class="thumbnail-placeholder">
            <span>{{ proj.clientName?.charAt(0) || 'P' }}</span>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-name">{{ proj.clientName || '未命名客户' }}</h3>
          <p class="card-date">完成于 {{ formatDate(proj.updatedAt) }}</p>
        </div>
        <div class="card-footer">
          <button class="btn-download" @click.stop="downloadProject(proj)">下载全部</button>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="selectedProject" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">{{ selectedProject.clientName || '项目图片' }}</h2>
          <button class="btn-modal-close" @click="closeModal">✕</button>
        </div>
        <div class="image-grid" v-if="projectImages.length > 0">
          <div
            v-for="img in projectImages"
            :key="img.id"
            class="image-item"
          >
            <img
              v-if="img.thumbnailUrls?.[0]"
              :src="img.thumbnailUrls[0]"
              :alt="img.id"
              class="image-thumb"
            />
            <div v-else class="image-thumb-placeholder"></div>
            <button class="btn-download-img" @click="downloadImage(img)">下载</button>
          </div>
        </div>
        <div v-else class="modal-empty">
          <span>暂无图片</span>
        </div>
        <div class="modal-actions">
          <button class="btn-original" :disabled="requestingOriginal" @click="requestOriginal">
            {{ requestingOriginal ? '请求中...' : '原片下载' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { projectApi } from '@/api/projects'
import type { Project, ImageMedia } from '@/types/models'

const projects = ref<Project[]>([])
const loading = ref(true)

const selectedProject = ref<Project | null>(null)
const projectImages = ref<ImageMedia[]>([])
const requestingOriginal = ref(false)

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await projectApi.getClientProjects()
    projects.value = (res.data as any).data || []
    // 只展示已完成的
    projects.value = projects.value.filter((p) => p.status === 'completed')
  } catch {
    projects.value = []
  } finally {
    loading.value = false
  }
}

function openProject(proj: Project) {
  selectedProject.value = proj
  projectImages.value = []
}

function closeModal() {
  selectedProject.value = null
  projectImages.value = []
}

function downloadProject(proj: Project) {
  // 触发项目打包下载
  window.open(`/api/projects/${proj.id}/download`, '_blank')
}

function downloadImage(img: ImageMedia) {
  window.open(img.originalUrl, '_blank')
}

async function requestOriginal() {
  if (!selectedProject.value) return
  requestingOriginal.value = true
  try {
    // 原片下载需要拥有者授权，此处为客户端触发请求
    window.open(`/api/projects/${selectedProject.value.id}/download?original=true`, '_blank')
  } finally {
    requestingOriginal.value = false
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.client-assets {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 24px;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 14px;
  padding: 60px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;
  padding: 60px 0;

  .empty-icon {
    font-size: 48px;
  }

  p {
    font-size: 15px;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.project-card {
  background: $color-surface;
  border-radius: $radius-lg;
  overflow: hidden;
  border: 1px solid $color-border-light;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: $shadow-md;
    transform: translateY(-2px);
  }
}

.card-thumbnail {
  aspect-ratio: 16 / 9;
  background: $color-border-light;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);

  span {
    font-size: 32px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
  }
}

.card-body {
  padding: 12px 14px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-date {
  font-size: 13px;
  color: $color-text-secondary;
}

.card-footer {
  padding: 0 14px 12px;
}

.btn-download {
  width: 100%;
  padding: 8px 0;
  background: $color-primary;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}

// 弹窗
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: $color-surface;
  border-radius: $radius-xl;
  width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text;
}

.btn-modal-close {
  width: 28px;
  height: 28px;
  font-size: 16px;
  color: $color-text-muted;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.image-item {
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid $color-border-light;
}

.image-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.image-thumb-placeholder {
  width: 100%;
  aspect-ratio: 1;
  background: $color-border-light;
}

.btn-download-img {
  width: 100%;
  padding: 6px 0;
  font-size: 12px;
  color: $color-primary;
  background: $color-surface;
  border-top: 1px solid $color-border-light;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
  }
}

.modal-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $color-text-muted;
  padding: 40px 0;
}

.modal-actions {
  padding: 12px 20px;
  border-top: 1px solid $color-border-light;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-original {
  padding: 8px 20px;
  font-size: 13px;
  color: $color-text-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: $color-primary;
    color: $color-primary;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>