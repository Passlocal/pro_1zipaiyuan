<template>
  <div class="project-detail">
    <!-- 顶部工具栏 -->
    <div class="detail-topbar">
      <div class="topbar-left">
        <button class="btn-back" @click="router.back()">
          <span>← 返回</span>
        </button>
        <h1 class="project-name">{{ (projectStore.currentProject as any)?.name || projectStore.currentProject?.clientName || '项目详情' }}</h1>
        <span
          v-if="projectStore.currentProject"
          class="status-badge"
          :class="'status--' + projectStore.currentProject.status"
        >
          {{ statusLabel(projectStore.currentProject.status) }}
        </span>
      </div>
      <div class="topbar-right">
        <button class="btn-toolbar" title="分享">
          <span>🔗</span> 分享
        </button>
        <button class="btn-toolbar" title="AI样片">
          <span>✨</span> AI样片
        </button>
        <button class="btn-toolbar" title="一键巡检" @click="router.push(`/project/${projectId}/color-check`)">
          <span>🔍</span> 一键巡检
        </button>
        <button class="btn-toolbar" title="导出意见">
          <span>📥</span> 导出意见
        </button>
        <button class="btn-toolbar" title="作品集" @click="router.push(`/project/${projectId}/portfolio`)">
          <span>📖</span> 作品集
        </button>
        <button class="btn-toolbar" title="时间轴" @click="router.push(`/project/${projectId}/timeline`)">
          <span>📅</span> 时间轴
        </button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="detail-body">
      <!-- 左侧：图片查看器 -->
      <div class="viewer-panel">
        <div class="image-viewer">
          <div class="viewer-placeholder">
            <span class="viewer-icon">🖼️</span>
            <p>图片查看器</p>
            <p class="viewer-hint" v-if="currentUnitImages.length === 0">
              请先在右侧选择一个产品单元查看图片
            </p>
          </div>
        </div>
      </div>

      <!-- 标注工具栏 -->
      <div class="annotation-toolbar">
        <div class="tool-group">
          <button
            v-for="tool in tools"
            :key="tool.type"
            class="tool-btn"
            :class="{ active: annotationStore.activeTool === tool.type }"
            :title="tool.label"
            @click="annotationStore.setTool(tool.type)"
          >
            <span>{{ tool.icon }}</span>
          </button>
        </div>
        <div class="divider-h"></div>
        <div class="color-group">
          <button
            v-for="c in colors"
            :key="c"
            class="color-btn"
            :class="{ active: annotationStore.activeColor === c }"
            :style="{ background: c }"
            @click="annotationStore.setColor(c)"
          ></button>
        </div>
        <div class="divider-h"></div>
        <div class="width-group">
          <button
            v-for="w in widths"
            :key="w"
            class="width-btn"
            :class="{ active: annotationStore.activeWidth === w }"
            @click="annotationStore.setWidth(w)"
          >
            {{ w }}px
          </button>
        </div>
        <div class="divider-h"></div>
        <div class="tool-group">
          <button class="tool-btn" title="撤销" @click="annotationStore.undo()">
            <span>↩</span>
          </button>
          <button class="tool-btn" title="重做" @click="annotationStore.redo()">
            <span>↪</span>
          </button>
        </div>
      </div>

      <!-- 右侧面板 -->
      <aside class="comment-panel">
        <!-- 产品单元标签 -->
        <div class="unit-tabs">
          <div class="unit-tabs-scroll">
            <button
              v-for="unit in projectStore.productUnits"
              :key="unit.id"
              class="unit-tab"
              :class="{ active: activeUnitId === unit.id }"
              @click="selectUnit(unit.id)"
            >
              {{ unit.name }}
            </button>
          </div>
          <button class="btn-add-unit" title="添加产品单元">+</button>
        </div>

        <!-- 图片缩略图条 -->
        <div class="thumbnail-strip" v-if="currentUnitImages.length > 0">
          <button
            v-for="img in currentUnitImages"
            :key="img.id"
            class="thumbnail-item"
            :class="{ active: projectStore.currentImage?.id === img.id }"
            @click="selectImage(img)"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" :alt="img.id" />
            <div v-else class="thumb-placeholder"></div>
          </button>
        </div>
        <div v-else class="thumbnail-empty">
          <span>暂无图片</span>
        </div>

        <div class="divider-h"></div>

        <!-- 意见卡片列表 -->
        <div class="comment-list" v-if="annotationStore.commentCards.length > 0">
          <div
            v-for="(card, index) in annotationStore.commentCards"
            :key="card.id"
            class="comment-card"
            :class="{ focused: focusedCardId === card.id }"
            @click="focusCard(card)"
          >
            <div class="card-number">#{{ index + 1 }}</div>
            <div class="card-thumbnail">
              <img v-if="card.thumbnailUrl" :src="card.thumbnailUrl" :alt="'card ' + (index + 1)" />
              <div v-else class="card-thumb-placeholder"></div>
            </div>
            <div class="card-content">
              <p class="card-text">{{ card.text }}</p>
            </div>
            <div class="card-status-dot" :class="card.status === 'resolved' ? 'dot-resolved' : 'dot-unresolved'"></div>
          </div>
        </div>
        <div v-else class="comment-empty">
          <span>暂无意见卡片</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useAnnotationStore } from '@/stores/annotation'
import type { ProjectStatus, AnnotationToolType, AnnotationColor, PenWidth, ArrowWidth, ImageMedia, CommentCard } from '@/types/models'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const annotationStore = useAnnotationStore()

const projectId = computed(() => route.params.id as string)
const activeUnitId = ref<string>('')
const focusedCardId = ref<string>('')

const statusLabelMap: Record<ProjectStatus, string> = {
  draft: '草稿',
  review: '待确认',
  in_progress: '修改中',
  final_review: '待确稿',
  completed: '已完成',
}

function statusLabel(status: ProjectStatus): string {
  return statusLabelMap[status] || status
}

const tools: { type: AnnotationToolType; label: string; icon: string }[] = [
  { type: 'pen', label: '画笔', icon: '✏️' },
  { type: 'arrow', label: '箭头', icon: '➡️' },
  { type: 'rectangle', label: '矩形', icon: '⬜' },
  { type: 'ellipse', label: '椭圆', icon: '⭕' },
  { type: 'text', label: '文字', icon: '🔤' },
  { type: 'eraser', label: '橡皮擦', icon: '🧹' },
]

const colors: AnnotationColor[] = ['#FF0000', '#FFCC00', '#0066FF', '#FFFFFF']
const widths: (PenWidth | ArrowWidth)[] = [3, 5, 10]

async function selectUnit(unitId: string) {
  activeUnitId.value = unitId
  await projectStore.fetchImages(unitId)
}

function selectImage(img: ImageMedia) {
  projectStore.setCurrentImage(img)
  annotationStore.loadAnnotations(img.id)
  annotationStore.loadCommentCards(img.id)
}

function focusCard(card: CommentCard) {
  focusedCardId.value = card.id
}

const currentUnitImages = computed(() => projectStore.currentImages)

watch(projectId, (id) => {
  if (id) {
    projectStore.fetchProject(id)
    projectStore.fetchProductUnits(id)
  }
}, { immediate: true })

onMounted(() => {
  if (projectId.value) {
    projectStore.fetchProject(projectId.value)
    projectStore.fetchProductUnits(projectId.value)
  }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.project-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-topbar {
  height: 48px;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .btn-back {
    font-size: 13px;
    color: $color-text-secondary;
    padding: 4px 8px;
    border-radius: $radius-sm;
    white-space: nowrap;

    &:hover {
      background: $color-surface-hover;
    }
  }

  .project-name {
    font-size: 15px;
    font-weight: 600;
    color: $color-text;
    white-space: nowrap;
  }
}

.status-badge {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  color: #fff;
  white-space: nowrap;

  &.status--draft { background: $color-text-muted; }
  &.status--review { background: $color-warning; color: #5f4b00; }
  &.status--in_progress { background: $color-primary; }
  &.status--final_review { background: #ff8c00; }
  &.status--completed { background: $color-success; }
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-toolbar {
  padding: 5px 10px;
  font-size: 12px;
  color: $color-text-secondary;
  border-radius: $radius-sm;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }
}

.detail-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.viewer-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  overflow: hidden;
}

.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-placeholder {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);

  .viewer-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
  }

  p {
    font-size: 18px;
    font-weight: 500;
  }

  .viewer-hint {
    font-size: 13px;
    margin-top: 8px;
    opacity: 0.7;
  }
}

.annotation-toolbar {
  width: 48px;
  background: $color-surface;
  border-left: 1px solid $color-border;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 6px;
  flex-shrink: 0;
  overflow-y: auto;
}

.tool-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  font-size: 16px;
  color: $color-text-secondary;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
  }
}

.color-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.color-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid $color-border;
  transition: transform 0.15s, border-color 0.15s;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    border-color: $color-text;
    transform: scale(1.15);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
  }
}

.width-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.width-btn {
  font-size: 11px;
  color: $color-text-secondary;
  padding: 3px 6px;
  border-radius: $radius-sm;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 600;
  }
}

.divider-h {
  width: 28px;
  height: 1px;
  background: $color-border-light;
  margin: 4px 0;
}

.comment-panel {
  width: $comment-panel-width;
  background: $color-surface;
  border-left: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.unit-tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid $color-border-light;
  padding: 6px 8px;
  gap: 4px;
  flex-shrink: 0;
}

.unit-tabs-scroll {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    height: 3px;
  }
}

.unit-tab {
  padding: 5px 12px;
  font-size: 12px;
  color: $color-text-secondary;
  border-radius: 20px;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }

  &.active {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 500;
  }
}

.btn-add-unit {
  width: 28px;
  height: 28px;
  font-size: 16px;
  color: $color-text-muted;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: $color-surface-hover;
    color: $color-text;
  }
}

.thumbnail-strip {
  display: flex;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  flex-shrink: 0;
  border-bottom: 1px solid $color-border-light;

  &::-webkit-scrollbar {
    height: 3px;
  }
}

.thumbnail-item {
  width: 48px;
  height: 36px;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 2px solid transparent;
  flex-shrink: 0;
  padding: 0;
  transition: border-color 0.15s;

  &:hover {
    border-color: $color-border;
  }

  &.active {
    border-color: $color-primary;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  background: $color-border-light;
}

.thumbnail-empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 12px;
  color: $color-text-muted;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.comment-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.comment-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: $radius-md;
  border: 1px solid $color-border-light;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: $color-border;
  }

  &.focused {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba($color-primary, 0.15);
  }
}

.card-number {
  font-size: 13px;
  font-weight: 600;
  color: $color-text-muted;
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

.card-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-border-light;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.card-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: $color-border-light;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-text {
  font-size: 13px;
  color: $color-text;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-unresolved {
    background: $color-error;
  }

  &.dot-resolved {
    background: $color-success;
  }
}

.comment-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $color-text-muted;
}
</style>