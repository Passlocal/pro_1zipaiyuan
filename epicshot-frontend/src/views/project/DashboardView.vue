<template>
  <div class="dashboard">
    <!-- 顶部标题栏 -->
    <div class="dashboard-header">
      <h1 class="page-title">项目看板</h1>
      <button class="btn-create" @click="openCreateModal">+ 新建项目</button>
    </div>

    <!-- 统计概览 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-number">{{ stats.total }}</span>
        <span class="stat-label">全部项目</span>
      </div>
      <div class="stat-item stat-item--active">
        <span class="stat-number">{{ stats.inProgress }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-item stat-item--pending">
        <span class="stat-number">{{ stats.pending }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="stat-item stat-item--done">
        <span class="stat-number">{{ stats.completed }}</span>
        <span class="stat-label">已完成</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeStatus === tab.value }"
          @click="activeStatus = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="search-wrap">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索项目名称或客户..."
          @input="onSearchInput"
        />
        <span class="search-icon">🔍</span>
      </div>
    </div>

    <!-- 项目卡片网格 -->
    <div v-if="projectStore.loading" class="loading-state">
      <span class="loading-pulse">加载中...</span>
    </div>
    <div v-else-if="loadError" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>加载失败：{{ loadError }}</p>
      <button class="btn-retry" @click="loadProjects">重新加载</button>
    </div>
    <div v-else-if="filteredProjects.length === 0" class="empty-state">
      <span class="empty-icon">📋</span>
      <p>暂无项目</p>
      <button class="btn-create" @click="openCreateModal">创建第一个项目</button>
    </div>
    <div v-else class="project-grid">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
        @click="goToProject(project.id)"
      >
        <div class="card-thumbnail">
          <img v-if="projectThumbnails[project.id]" :src="projectThumbnails[project.id]" :alt="project.name || project.clientName || '项目'" />
          <div v-else class="thumbnail-placeholder">
            <span>{{ project.name?.charAt(0) || project.clientName?.charAt(0) || 'P' }}</span>
          </div>
          <span class="status-badge" :class="'status--' + project.status">
            {{ statusLabel(project.status) }}
          </span>
        </div>
        <div class="card-body">
          <h3 class="card-title">{{ project.name || project.clientName || '未命名项目' }}</h3>
          <p v-if="project.clientName" class="card-client">{{ project.clientName }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :class="'progress--' + project.status" :style="{ width: progressPercent(project.status) + '%' }"></div>
          </div>
          <div class="card-meta">
            <span class="pending-count">{{ project.pendingCount }} 条待处理</span>
            <span class="recent-activity">{{ formatTime(project.recentActivity) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建项目弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <h2 class="modal-title">新建项目</h2>
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label class="form-label">项目名称</label>
            <input
              v-model="createForm.name"
              type="text"
              class="form-input"
              placeholder="请输入项目名称"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">客户名称</label>
            <input
              v-model="createForm.clientName"
              type="text"
              class="form-input"
              placeholder="请输入客户名称（选填）"
            />
          </div>
          <div class="form-group">
            <label class="form-label">截止日期</label>
            <input
              v-model="createForm.deadline"
              type="date"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea
              v-model="createForm.note"
              class="form-textarea"
              placeholder="备注信息（选填）"
              rows="3"
            ></textarea>
          </div>
          <div
            class="upload-zone"
            :class="{ 'upload-zone--dragover': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="onDrop"
          >
            <span class="upload-icon">📁</span>
            <p class="upload-text">拖拽图片到此处上传</p>
            <p class="upload-hint">支持 JPG / PNG / TIFF / WebP 格式，可多选</p>
            <label class="upload-btn">
              选择文件
              <input type="file" multiple accept="image/*" hidden @change="onFileSelect" />
            </label>
            <div v-if="uploadFiles.length > 0" class="upload-preview">
              <span v-for="(f, i) in uploadFiles" :key="i" class="upload-file-tag">{{ f.name }}</span>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeCreateModal" :disabled="creating">取消</button>
            <button type="submit" class="btn-submit" :disabled="creating">
              {{ creating ? '创建中...' : '创建项目' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { projectApi } from '@/api/projects'
import { useToast } from '@/composables/useToast'
import type { ProjectStatus } from '@/types/models'
import { PROJECT_STATUS_LABELS } from '@/types/models'

const toast = useToast()

const router = useRouter()
const projectStore = useProjectStore()

// 筛选
const filterTabs = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '待确认', value: 'review' },
  { label: '修改中', value: 'in_progress' },
  { label: '待确稿', value: 'final_review' },
  { label: '已完成', value: 'completed' },
  { label: '已归档', value: 'archived' },
]
const activeStatus = ref('')
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const statusLabelMap: Record<ProjectStatus, string> = PROJECT_STATUS_LABELS

const stats = computed(() => {
  const list = projectStore.projects
  return {
    total: list.length,
    inProgress: list.filter(p => p.status === 'in_progress' || p.status === 'final_review').length,
    pending: list.reduce((s, p) => s + (p.pendingCount || 0), 0),
    completed: list.filter(p => p.status === 'completed').length,
  }
})

function statusLabel(status: ProjectStatus): string {
  return statusLabelMap[status] || status
}

function progressPercent(status: ProjectStatus): number {
  const map: Record<ProjectStatus, number> = {
    draft: 10,
    review: 30,
    in_progress: 55,
    final_review: 80,
    completed: 100,
    archived: 100,
  }
  return map[status] || 0
}

const filteredProjects = computed(() => {
  let list = projectStore.projects
  if (activeStatus.value) {
    list = list.filter((p) => p.status === activeStatus.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q)
    )
  }
  return list
})

// Fetch first image of each project as thumbnail
const projectThumbnails = ref<Record<string, string>>({})
const loadError = ref('')

async function loadProjects() {
  loadError.value = ''
  try {
    await projectStore.fetchProjects()
    loadProjectThumbnails()
  } catch (e: any) {
    loadError.value = e?.message || '未知错误'
  }
}

async function loadProjectThumbnails() {
  const ids = projectStore.projects.map(p => p.id)
  if (ids.length === 0) return
  try {
    const res = await projectApi.batchThumbnails(ids)
    const map = res.data.data || {}
    Object.entries(map).forEach(([projectId, url]) => {
      projectThumbnails.value[projectId] = url
    })
  } catch {
    // ignore errors
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    projectStore.fetchProjects({ search: searchQuery.value || undefined, status: activeStatus.value || undefined })
  }, 300)
}

function goToProject(id: string) {
  router.push(`/project/${id}`)
}

// 新建项目弹窗
const showCreateModal = ref(false)
const creating = ref(false)
const isDragOver = ref(false)
const uploadFiles = ref<File[]>([])
const createForm = ref({
  name: '',
  clientName: '',
  deadline: '',
  note: '',
})

function openCreateModal() {
  createForm.value = { name: '', clientName: '', deadline: '', note: '' }
  uploadFiles.value = []
  showCreateModal.value = true
}

function closeCreateModal() {
  if (createForm.value.name.trim() || uploadFiles.value.length > 0) {
    if (!confirm('关闭后将丢失已填写的内容，确定要关闭吗？')) return
  }
  showCreateModal.value = false
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    uploadFiles.value = [...uploadFiles.value, ...Array.from(input.files)]
  }
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  if (e.dataTransfer?.files) {
    uploadFiles.value = [...uploadFiles.value, ...Array.from(e.dataTransfer.files)]
  }
}

async function handleCreate() {
  if (!createForm.value.name.trim()) return
  creating.value = true
  try {
    const data: any = { name: createForm.value.name.trim() }
    if (createForm.value.clientName.trim()) data.clientName = createForm.value.clientName.trim()
    if (createForm.value.deadline) data.deadline = createForm.value.deadline
    if (createForm.value.note.trim()) data.note = createForm.value.note.trim()
    // Create project first
    const project = await projectStore.createProject(data)
    // Upload files after project created
    if (uploadFiles.value.length > 0) {
      // Create a default unit and upload files
      const unitRes = await projectApi.createProductUnit(project.id, '默认产品')
      const unit = unitRes.data.data
      if (unit && uploadFiles.value.length > 0) {
        await projectApi.uploadImages(unit.id, uploadFiles.value)
      }
    }
    showCreateModal.value = false
    router.push(`/project/${project.id}`)
  } catch (e: any) {
    console.error('创建项目失败:', e)
    toast.error('创建项目失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  await loadProjects()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  .page-title {
    font-size: 22px;
    font-weight: 600;
    color: $color-text;
  }
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-item {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: 16px;
  text-align: center;

  .stat-number {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: $color-text;
    line-height: 1.2;
  }

  .stat-label {
    display: block;
    font-size: 13px;
    color: $color-text-secondary;
    margin-top: 4px;
  }

  &.stat-item--active .stat-number { color: $color-primary; }
  &.stat-item--pending .stat-number { color: $color-warning; }
  &.stat-item--done .stat-number { color: $color-success; }
}

.btn-create {
  padding: 8px 20px;
  background: $color-primary;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  background: $color-surface-hover;
  border-radius: $radius-md;
  padding: 3px;
}

.filter-tab {
  padding: 6px 14px;
  font-size: 13px;
  color: $color-text-secondary;
  border-radius: $radius-sm;
  transition: all 0.2s;

  &:hover {
    color: $color-text;
  }

  &.active {
    background: $color-surface;
    color: $color-text;
    font-weight: 500;
    box-shadow: $shadow-sm;
  }
}

.search-wrap {
  position: relative;
  width: 240px;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 32px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-text;
  background: $color-surface;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
  }
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.5;
  pointer-events: none;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 14px;
}

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;

  .error-icon {
    font-size: 48px;
  }

  p {
    font-size: 15px;
    color: $color-error;
  }

  .btn-retry {
    padding: 8px 20px;
    background: $color-primary;
    color: #fff;
    font-size: 14px;
    border-radius: $radius-md;
    transition: background 0.2s;

    &:hover {
      background: $color-primary-dark;
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $color-text-secondary;

  .empty-icon {
    font-size: 48px;
  }

  p {
    font-size: 15px;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding-bottom: 24px;
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
  position: relative;
  aspect-ratio: 16 / 9;
  background: #e8eaed;
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
    font-size: 36px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
  }
}

.status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  color: #fff;

  &.status--draft { background: $color-text-muted; }
  &.status--review { background: $color-warning; color: #5f4b00; }
  &.status--in_progress { background: $color-primary; }
  &.status--final_review { background: #ff8c00; }
  &.status--completed { background: $color-success; }
  &.status--archived { background: #6c757d; }
}

.card-body {
  padding: 12px 14px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-client {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 10px;
}

.progress-bar {
  height: 4px;
  background: $color-border-light;
  border-radius: 2px;
  margin-bottom: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;

  &.progress--draft { background: $color-text-muted; }
  &.progress--review { background: $color-warning; }
  &.progress--in_progress { background: $color-primary; }
  &.progress--final_review { background: #ff8c00; }
  &.progress--completed { background: $color-success; }
  &.progress--archived { background: #6c757d; }
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;

  .pending-count {
    color: $color-error;
    font-weight: 500;
  }

  .recent-activity {
    color: $color-text-muted;
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
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 28px 32px;
  width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  background: $color-surface;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
  }
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  background: $color-surface;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
  }
}

.upload-zone {
  border: 2px dashed $color-border;
  border-radius: $radius-md;
  padding: 24px;
  text-align: center;
  margin-bottom: 20px;
  transition: border-color 0.2s, background 0.2s;

  &.upload-zone--dragover {
    border-color: $color-primary;
    background: rgba($color-primary, 0.04);
  }
}

.upload-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 4px;
}

.upload-hint {
  font-size: 12px;
  color: $color-text-muted;
  margin-bottom: 12px;
}

.upload-btn {
  display: inline-block;
  padding: 6px 16px;
  background: $color-surface-hover;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $color-text-secondary;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: $color-border-light;
  }
}

.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.upload-file-tag {
  padding: 2px 10px;
  background: rgba($color-primary, 0.08);
  color: $color-primary;
  font-size: 12px;
  border-radius: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 8px 20px;
  background: $color-surface-hover;
  color: $color-text-secondary;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-border-light;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-submit {
  padding: 8px 20px;
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
</style>