<template>
  <div class="dashboard">
    <!-- 顶部标题栏 -->
    <div class="dashboard-header">
      <h1 class="page-title">项目看板</h1>
      <div class="header-right">
        <button class="btn-export" @click="showExportPopup = !showExportPopup">
          <Upload :size="14" /> 导出
        </button>
        <button class="btn-secondary" @click="toggleBatchMode" :class="{ active: batchMode }">
          <CheckSquare :size="14" /> {{ batchMode ? '取消' : '批量操作' }}
        </button>
        <div v-if="showExportPopup" class="export-popup" @click.stop>
          <button class="export-option" @click="exportDashboard('pdf')"><FileText :size="14" /> PDF 报告</button>
          <button class="export-option" @click="exportDashboard('xlsx')"><BarChart3 :size="14" /> Excel 报表</button>
        </div>
        <button class="btn-create" @click="openCreateModal">+ 新建项目</button>
      </div>
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
      <div class="filter-right">
        <div class="search-wrap">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索项目名称或客户..."
            @input="onSearchInput"
          />
          <Search :size="14" class="search-icon" />
        </div>
        <label class="toggle-unprocessed">
          <input type="checkbox" v-model="showUnprocessedOnly" />
          <span class="toggle-label">仅未处理</span>
        </label>
        <div class="sort-wrap">
          <select v-model="sortBy" class="sort-select">
            <option value="updatedAt">更新时间</option>
            <option value="deadline">截止日期</option>
            <option value="createdAt">创建时间</option>
            <option value="clientName">客户名称</option>
          </select>
        </div>
        <div class="template-wrap">
          <button class="btn-template" @click="saveTemplate">保存为筛选模板</button>
          <select v-model="selectedTemplate" class="template-select" @change="loadTemplate">
            <option value="">加载模板...</option>
            <option v-for="t in savedTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 筛选状态提示条 -->
    <div v-if="hasActiveFilter" class="filter-status-bar">
      <span>正在按「{{ filterDescription }}」筛选，共 {{ filteredProjects.length }} 个项目。</span>
      <button class="btn-clear-filter" @click="clearAllFilters">清除筛选</button>
    </div>

    <!-- V1.19: 批量操作工具栏 -->
    <div v-if="batchMode" class="batch-toolbar">
      <span class="batch-count">已选 {{ selectedProjectIds.size }} 个项目</span>
      <button class="btn-sm" @click="selectAllProjects">{{ selectedProjectIds.size === projectStore.projects.length ? '取消全选' : '全选' }}</button>
      <!-- FB-009: 全选筛选结果 -->
      <button v-if="activeStatus" class="btn-sm btn-all-filtered" @click="selectAllFiltered">全选筛选结果</button>
      <button class="btn-sm btn-warning" @click="batchArchive" :disabled="selectedProjectIds.size === 0">批量归档</button>
      <button class="btn-sm" @click="showBatchDeadline = true" :disabled="selectedProjectIds.size === 0">批量修改截止日期</button>
      <button class="btn-sm btn-danger" @click="batchDelete" :disabled="selectedProjectIds.size === 0">批量删除</button>
      <input v-if="showBatchDeadline" type="date" v-model="batchDeadline" class="form-input" style="width:140px" />
      <button v-if="showBatchDeadline" class="btn-sm btn-primary" @click="confirmBatchDeadline">确认</button>
    </div>

    <!-- 项目卡片网格 -->
    <div v-if="projectStore.loading" class="skeleton-grid">
      <div v-for="i in 6" :key="'card-' + i" class="skeleton skeleton-project-card"></div>
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
        v-for="(project, index) in sortedProjects"
        :key="project.id"
        class="project-card"
        @click="handleProjectCardClick(project, index, $event)"
      >
        <div v-if="batchMode" class="project-checkbox" @click.stop>
          <input type="checkbox" :checked="selectedProjectIds.has(project.id)" @change="toggleProjectSelect(project.id)" />
        </div>
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
        <button class="btn-delete-project" @click.stop="confirmDelete(project)" title="删除项目">🗑</button>
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
          <div class="form-group">
            <label class="form-label">合同金额（元）</label>
            <input
              v-model.number="createForm.contractAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="选填，用于财务统计"
              class="form-input"
            />
          </div>
          <button
            type="button"
            class="btn-add-stage"
            @click="addPaymentStage"
            v-if="createForm.paymentStages.length < 5"
          >
            + 添加付款阶段
          </button>
          <div v-if="createForm.paymentStages.length > 0" class="payment-stages">
            <div v-for="(stage, idx) in createForm.paymentStages" :key="idx" class="payment-stage-row">
              <input v-model="stage.name" type="text" placeholder="阶段名称" class="form-input stage-name" />
              <input v-model.number="stage.amount" type="number" step="0.01" min="0" placeholder="金额" class="form-input stage-amount" />
              <span class="stage-ratio" v-if="createForm.contractAmount > 0">{{ ((stage.amount / createForm.contractAmount) * 100).toFixed(0) }}%</span>
              <button type="button" class="btn-remove-stage" @click="removePaymentStage(idx)">×</button>
            </div>
            <div v-if="stageTotal !== createForm.contractAmount && createForm.contractAmount > 0" class="stage-warning">
              阶段合计 ¥{{ stageTotal }}，与总金额 ¥{{ createForm.contractAmount }} 不一致
            </div>
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

    <!-- V1.2.0: 删除项目确认弹窗 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-content">
        <h2 class="modal-title">确认删除项目</h2>
        <p class="modal-text">
          确定要删除项目 <strong>「{{ deleteTarget.name || deleteTarget.clientName || '未命名项目' }}」</strong> 吗？
        </p>
        <p class="modal-warning">此操作不可撤销，项目下的所有图片、标注和意见卡片将被永久删除。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="deleteTarget = null" :disabled="deleting">取消</button>
          <button class="btn-confirm-danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { projectApi } from '@/api/projects'
import client from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { ProjectStatus } from '@/types/models'
import { PROJECT_STATUS_LABELS } from '@/types/models'
import { Upload, FileText, BarChart3, Search, CheckSquare } from 'lucide-vue-next'

const toast = useToast()

const router = useRouter()
const projectStore = useProjectStore()

// F-51: 导出
const showExportPopup = ref(false)
const exporting = ref(false)

async function exportDashboard(format: 'pdf' | 'xlsx') {
  showExportPopup.value = false
  exporting.value = true
  try {
    const res = await client.get(`/v1/dashboard/export`, {
      params: { format },
      responseType: 'blob',
    })
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const blob = new Blob([res.data], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-export.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} 导出成功`)
  } catch (e: any) {
    console.error('导出失败:', e)
    toast.error('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

function handleClickOutside(e: MouseEvent) {
  if (showExportPopup.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.export-popup') && !target.closest('.btn-export')) {
      showExportPopup.value = false
    }
  }
}

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
const showUnprocessedOnly = ref(false)
const sortBy = ref('updatedAt')

// V1.19: 批量操作
const batchMode = ref(false)
const selectedProjectIds = ref(new Set<string>())
const showBatchDeadline = ref(false)
const batchDeadline = ref('')
// FB-009: Shift multi-select
const lastClickedIndex = ref<number | null>(null)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedProjectIds.value = new Set()
    showBatchDeadline.value = false
    lastClickedIndex.value = null
  }
}

function toggleProjectSelect(id: string) {
  const newSet = new Set(selectedProjectIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedProjectIds.value = newSet
}

// FB-009: Handle project card click in batch mode
function handleProjectCardClick(project: any, index: number, event: MouseEvent) {
  if (!batchMode.value) {
    goToProject(project.id)
    return
  }
  event.preventDefault()
  if (event.shiftKey && lastClickedIndex.value !== null) {
    // Shift+click: select range
    const start = Math.min(lastClickedIndex.value, index)
    const end = Math.max(lastClickedIndex.value, index)
    const newSet = new Set(selectedProjectIds.value)
    for (let i = start; i <= end; i++) {
      newSet.add(sortedProjects.value[i].id)
    }
    selectedProjectIds.value = newSet
  } else {
    toggleProjectSelect(project.id)
    lastClickedIndex.value = index
  }
}

function selectAllProjects() {
  if (selectedProjectIds.value.size === projectStore.projects.length) {
    selectedProjectIds.value = new Set()
  } else {
    selectedProjectIds.value = new Set(projectStore.projects.map(p => p.id))
  }
}

// FB-009: 全选筛选结果
function selectAllFiltered() {
  const filteredIds = filteredProjects.value.map(p => p.id)
  if (selectedProjectIds.value.size === filteredIds.length) {
    selectedProjectIds.value = new Set()
  } else {
    selectedProjectIds.value = new Set(filteredIds)
  }
}

async function batchArchive() {
  if (selectedProjectIds.value.size === 0) return
  try {
    const res = await client.post('/v1/projects/batch', {
      ids: Array.from(selectedProjectIds.value),
      action: 'archive'
    })
    const summary = res.data.data.summary
    alert(`成功归档 ${summary.success} 个项目，${summary.failed} 个跳过`)
    selectedProjectIds.value = new Set()
    await loadProjects()
  } catch (e) { /* ignore */ }
}

async function batchDelete() {
  if (selectedProjectIds.value.size === 0) return
  if (!confirm(`确定要删除选中的 ${selectedProjectIds.value.size} 个项目？已完成的项目将跳过。`)) return
  try {
    const res = await client.post('/v1/projects/batch', {
      ids: Array.from(selectedProjectIds.value),
      action: 'delete'
    })
    const summary = res.data.data.summary
    alert(`成功删除 ${summary.success} 个项目，${summary.failed} 个跳过`)
    selectedProjectIds.value = new Set()
    await loadProjects()
  } catch (e) { /* ignore */ }
}

async function confirmBatchDeadline() {
  if (selectedProjectIds.value.size === 0 || !batchDeadline.value) return
  try {
    const res = await client.post('/v1/projects/batch', {
      ids: Array.from(selectedProjectIds.value),
      action: 'update-deadline',
      deadline: batchDeadline.value
    })
    const summary = res.data.data.summary
    alert(`成功修改 ${summary.success} 个项目的截止日期`)
    showBatchDeadline.value = false
    batchDeadline.value = ''
    selectedProjectIds.value = new Set()
    await loadProjects()
  } catch (e) { /* ignore */ }
}
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 行话模板
const savedTemplates = ref<Array<{ id: string; name: string; keywords: string }>>([])
const selectedTemplate = ref('')

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
  if (showUnprocessedOnly.value) {
    list = list.filter((p) => (p.pendingCount || 0) > 0)
  }
  return list
})

const sortedProjects = computed(() => {
  const list = [...filteredProjects.value]
  const key = sortBy.value
  list.sort((a: any, b: any) => {
    const va = a[key] || ''
    const vb = b[key] || ''
    if (key === 'clientName') {
      return va.localeCompare(vb, 'zh-CN')
    }
    return vb > va ? 1 : -1
  })
  return list
})

const hasActiveFilter = computed(() => {
  return searchQuery.value.trim().length > 0 || showUnprocessedOnly.value
})

const filterDescription = computed(() => {
  const parts: string[] = []
  if (searchQuery.value.trim()) parts.push(searchQuery.value.trim())
  if (showUnprocessedOnly.value) parts.push('仅未处理')
  return parts.join(' + ')
})

function clearAllFilters() {
  searchQuery.value = ''
  showUnprocessedOnly.value = false
}

// 行话模板
async function saveTemplate() {
  const kw = searchQuery.value.trim()
  if (!kw) {
    toast.error('请先输入筛选关键词再保存为模板')
    return
  }
  const name = kw.length > 10 ? kw.slice(0, 10) + '...' : kw
  try {
    await client.post('/v1/personal-jargon-templates', { name, keywords: kw })
    toast.success('模板已保存')
    await loadTemplates()
  } catch (e: any) {
    toast.error(e?.response?.data?.message || '保存失败')
  }
}

async function loadTemplates() {
  try {
    const res = await client.get('/v1/personal-jargon-templates')
    savedTemplates.value = res.data?.data || []
  } catch {
    // ignore
  }
}

function loadTemplate() {
  if (!selectedTemplate.value) return
  const t = savedTemplates.value.find(t => t.id === selectedTemplate.value)
  if (t) {
    searchQuery.value = t.keywords
  }
  selectedTemplate.value = ''
}

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
  contractAmount: 0,
  paymentStages: [] as Array<{ name: string; amount: number }>,
})

const stageTotal = computed(() =>
  createForm.value.paymentStages.reduce((sum, s) => sum + (s.amount || 0), 0)
)

function addPaymentStage() {
  createForm.value.paymentStages.push({ name: '', amount: 0 })
}

function removePaymentStage(idx: number) {
  createForm.value.paymentStages.splice(idx, 1)
}

// V1.2.0: 删除项目
const deleteTarget = ref<any>(null)
const deleting = ref(false)

function confirmDelete(project: any) {
  deleteTarget.value = project
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await projectApi.delete(deleteTarget.value.id)
    toast.success('项目已删除')
    deleteTarget.value = null
    await projectStore.fetchProjects()
  } catch (e: any) {
    toast.error(e?.response?.data?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

function openCreateModal() {
  createForm.value = { name: '', clientName: '', deadline: '', note: '', contractAmount: 0, paymentStages: [] }
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
    if (createForm.value.contractAmount > 0) data.contractAmount = createForm.value.contractAmount
    if (createForm.value.paymentStages.length > 0) {
      data.paymentStages = createForm.value.paymentStages
    }
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
  loadTemplates()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style lang="scss" scoped>
@use 'sass:color';
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.btn-export {
  padding: 8px 16px;
  background: $color-surface;
  border: 1px solid $color-border;
  color: $color-text-secondary;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
    border-color: $color-primary;
  }
}

.export-popup {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  z-index: 100;
  min-width: 160px;
  padding: 4px;
  animation: fadeIn 0.15s ease;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: $color-text;
  border-radius: $radius-sm;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
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
  flex-wrap: wrap;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: $color-text-muted;
}

// 仅未处理开关
.toggle-unprocessed {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 13px;
  color: $color-text-secondary;
  white-space: nowrap;
  user-select: none;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

// 排序下拉
.sort-wrap {
  flex-shrink: 0;
}

.sort-select {
  height: 36px;
  padding: 0 8px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-text;
  background: $color-surface;
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: $color-primary;
  }
}

// 行话模板
.template-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-template {
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  color: $color-primary;
  background: rgba($color-primary, 0.08);
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: $radius-md;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    background: rgba($color-primary, 0.15);
  }
}

.template-select {
  height: 36px;
  padding: 0 8px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-text;
  background: $color-surface;
  cursor: pointer;
  outline: none;
  min-width: 100px;

  &:focus {
    border-color: $color-primary;
  }
}

// 筛选状态提示条
.filter-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: #e8f0fe;
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: $radius-md;
  font-size: 13px;
  color: $color-primary;
}

.btn-clear-filter {
  padding: 4px 12px;
  font-size: 12px;
  color: $color-primary;
  background: transparent;
  border: 1px solid $color-primary;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: $color-primary;
    color: #fff;
  }
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 14px;
}

// EMO-03: 骨架屏
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-bottom: 24px;
}

.skeleton-project-card {
  height: 280px;
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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

.modal-warning {
  font-size: 13px;
  color: $color-error;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: rgba($color-error, 0.08);
  border-left: 3px solid $color-error;
  border-radius: 4px;
}

.btn-delete-project {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid $color-border-light;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  z-index: 2;

  &:hover {
    background: $color-error;
    border-color: $color-error;
  }
}

.project-card:hover .btn-delete-project {
  opacity: 1;
}

.btn-confirm-danger {
  padding: 8px 20px;
  border-radius: $radius-md;
  background: $color-error;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;

  &:hover { background: color.adjust($color-error, $lightness: -10%); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
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

// V1.19: 批量操作
.btn-secondary {
  padding: 8px 16px;
  background: $color-surface;
  border: 1px solid $color-border;
  color: $color-text-secondary;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
    border-color: $color-primary;
  }

  &.active {
    background: rgba($color-primary, 0.08);
    border-color: $color-primary;
    color: $color-primary;
  }
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f0f4ff;
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.batch-count {
  font-weight: 600;
  font-size: 14px;
  margin-right: 8px;
}
.project-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: #fff;
  color: #333;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f5f5f5; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
.btn-warning { color: #e37400; border-color: #e37400; &:hover:not(:disabled) { background: #fff8e1; } }
.btn-danger { color: #c62828; border-color: #c62828; &:hover:not(:disabled) { background: #ffebee; } }
.btn-primary { background: $color-primary; color: #fff; border-color: $color-primary; &:hover:not(:disabled) { background: $color-primary-dark; } }

// Mobile responsive styles
@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .header-right {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .filter-bar {
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    gap: 6px;
    flex-wrap: nowrap;
  }

  .filter-tab {
    white-space: nowrap;
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 13px;
  }

  .project-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .project-card {
    padding: 16px;
  }

  .batch-toolbar {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .search-input {
    width: 100%;
  }

  button, .btn, .filter-tab {
    min-height: 44px;
  }

  .modal-content {
    width: 94vw;
    padding: 20px 16px;
  }

  .search-wrap {
    width: 100%;
  }

  .filter-right {
    width: 100%;
  }

  .dashboard {
    padding: 16px;
  }
}
</style>