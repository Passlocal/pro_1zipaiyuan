<template>
  <div class="client-project">
    <!-- F-52: 品牌栏 -->
    <div class="brand-bar" v-if="brand.name" :style="{ '--brand-color': safeBrandColor }">
      <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" class="brand-logo" />
      <span class="brand-name">{{ brand.name }}</span>
    </div>

    <!-- UX-37: 标注处理状态横幅 -->
    <div v-if="statusBanner.show" class="status-banner" :class="'status-banner--' + statusBanner.status">
      <span class="status-banner-text">{{ statusBanner.text }}</span>
      <span class="status-banner-time" v-if="statusBanner.updatedAt">更新于 {{ formatDate(statusBanner.updatedAt) }}</span>
    </div>

    <!-- 顶部标题栏 -->
    <header class="top-bar" v-if="project">
      <div class="top-left">
        <h1 class="project-name">{{ project.clientName || '项目' }}</h1>
        <span class="status-label">{{ statusLabel }}</span>
        <span v-if="projectConfirmed" class="confirmed-badge">已确稿</span>
      </div>
      <div class="top-center">
        <div class="progress-area">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%', background: safeBrandColor }"></div>
          </div>
          <span class="progress-text">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="top-right" v-if="project.deadline">
        <span class="deadline-label">预计完成时间</span>
        <span class="deadline-date">{{ formatDate(project.deadline) }}</span>
      </div>
    </header>

    <!-- UX-39: 审片进度条 -->
    <div class="review-progress-bar" v-if="project">
      <div class="review-progress-summary" @click="reviewProgressExpanded = !reviewProgressExpanded">
        <span class="review-progress-text">
          已审 {{ reviewedImages.size }} / {{ totalImages }} 张，已确稿 {{ confirmedCount }} 张
        </span>
        <span class="review-progress-toggle">{{ reviewProgressExpanded ? '▲' : '▼' }}</span>
      </div>
      <div class="review-progress-segments" @click="reviewProgressExpanded = !reviewProgressExpanded">
        <div class="review-segment review-segment--confirmed" :style="{ width: confirmedPercent + '%' }"></div>
        <div class="review-segment review-segment--reviewed" :style="{ width: reviewedPercent + '%' }"></div>
        <div class="review-segment review-segment--unreviewed" :style="{ width: unreviewedPercent + '%' }"></div>
      </div>
      <div v-if="reviewProgressExpanded" class="review-progress-detail">
        <div class="review-detail-list">
          <div
            v-for="(img, idx) in projectImages"
            :key="img.id"
            class="review-detail-item"
            :class="{
              'review-detail--confirmed': cardStatesForImage(img.id) === 'confirmed',
              'review-detail--reviewed': reviewedImages.has(img.id),
              'review-detail--unreviewed': !reviewedImages.has(img.id) && cardStatesForImage(img.id) !== 'confirmed'
            }"
            @click="currentImageIndex = idx"
          >
            <img v-if="img.thumbnailUrls?.[0]" :src="img.thumbnailUrls[0]" class="review-detail-thumb" />
            <div v-else class="review-detail-thumb-placeholder"></div>
            <span class="review-detail-status">
              {{ cardStatesForImage(img.id) === 'confirmed' ? '✓ 已确稿' : reviewedImages.has(img.id) ? '已审' : '未审' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体区 -->
    <div class="main-area" v-if="project">
      <!-- 图片查看器 -->
      <div class="viewer-area" ref="viewerRef">
        <div class="image-viewer" v-if="currentImageUrl"
          @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
          <div class="image-zoom-container" ref="zoomContainerRef" :style="zoomStyle">
            <img
              :src="currentImageUrl"
              :alt="project.clientName || '项目图片'"
              class="viewer-image"
              :style="selectedAiStyle ? { filter: aiStyleAppliedFilter } : {}"
              @dblclick="resetZoom"
            />
            <!-- FEAT-01: 图片上意见编号标记点 -->
            <div
              v-for="(marker, _mIdx) in positionMarkers"
              :key="marker.cardId"
              class="position-marker"
              :style="{ left: marker.x + '%', top: marker.y + '%' }"
              @click.stop="scrollToCard(marker.cardId)"
              :title="'#' + marker.index + ' ' + marker.text"
            >
              <span class="marker-dot">#{{ marker.index }}</span>
            </div>
          </div>

          <!-- Slider comparison mode -->
          <div v-if="compareMode === 'slider' && hasComparison" class="slider-compare" 
               @mousemove="updateSliderPosition" @mouseup="stopSliderDrag"
               @touchmove="updateSliderPosition" @touchend="stopSliderDrag">
            <div class="slider-before" :style="{ width: sliderPosition + '%' }">
              <img :src="originalImageUrl" alt="原图" />
            </div>
            <div class="slider-after">
              <img :src="currentImageUrl" alt="成片" />
            </div>
            <div class="slider-handle" :style="{ left: sliderPosition + '%' }" 
                 @mousedown="startSliderDrag" @touchstart="startSliderDrag">
              <div class="slider-handle-line"></div>
              <span class="slider-handle-arrow">◄ ►</span>
            </div>
          </div>

          <!-- 浮动工具栏 -->
          <div class="floating-toolbar">
            <button class="toolbar-btn" @click="openAIStyle" title="AI 风格样片">
              <Sparkles :size="16" /> AI 风格样片
            </button>
            <button class="btn-mark-reviewed" @click="markAsReviewed" :disabled="currentImageReviewed">
              {{ currentImageReviewed ? '✓ 已确认' : '已阅/无需修改' }}
            </button>
            <div class="toolbar-dropdown" v-if="hasComparison">
              <button class="toolbar-btn" @click="showCompareDropdown = !showCompareDropdown; showSettingsDropdown = false">
                对比模式 ▼
              </button>
              <div v-if="showCompareDropdown" class="dropdown-menu dropdown-menu--up">
                <button
                  class="dropdown-item"
                  :class="{ active: compareMode === 'side' }"
                  @click="compareMode = 'side'; showCompareDropdown = false"
                >左右对比</button>
                <button
                  class="dropdown-item"
                  :class="{ active: compareMode === 'slider' }"
                  @click="compareMode = 'slider'; showCompareDropdown = false"
                >滑块对比</button>
                <button
                  class="dropdown-item"
                  :class="{ active: compareMode === 'overlay' }"
                  @click="compareMode = 'overlay'; showCompareDropdown = false"
                >叠加对比</button>
              </div>
            </div>
            <div class="toolbar-dropdown">
              <button class="toolbar-btn" @click="showSettingsDropdown = !showSettingsDropdown; showCompareDropdown = false">
                设置 ▼
              </button>
              <div v-if="showSettingsDropdown" class="dropdown-menu dropdown-menu--up">
                <label class="dropdown-item dropdown-item--upload">
                  <input type="file" accept="image/*" @change="handleRefUpload" hidden />
                  上传参考图
                </label>
                <span v-if="refImage" class="dropdown-ref-name">{{ refImage.name }}</span>
              </div>
            </div>
          </div>

          <div v-if="projectImages.length > 1" class="image-counter">
            {{ currentImageIndex + 1 }} / {{ projectImages.length }}
            <span v-if="isCurrentImageViewed" class="viewed-check">✓</span>
          </div>
          <!-- FEAT-03: 图片已查看标记 -->
          <button
            class="btn-mark-viewed"
            :class="{ viewed: isCurrentImageViewed }"
            @click="toggleImageView(currentImageId ?? '')"
            :title="isCurrentImageViewed ? '取消标记' : '标记已查看'"
          >
            {{ isCurrentImageViewed ? '✓ 已查看' : '标记已查看' }}
          </button>
          <button
            v-if="projectImages.length > 0 && viewedCount < projectImages.length"
            class="btn-mark-all-viewed"
            @click="markAllImagesViewed"
          >
            全部已查看
          </button>
          <button v-if="currentImageIndex > 0" class="nav-btn nav-prev" @click="currentImageIndex--" aria-label="上一张">
            <ChevronLeft :size="24" />
          </button>
          <button v-if="currentImageIndex < projectImages.length - 1" class="nav-btn nav-next" @click="currentImageIndex++" aria-label="下一张">
            <ChevronRight :size="24" />
          </button>
        </div>
        <div v-else class="viewer-placeholder">
          <span class="viewer-icon">🖼️</span>
          <p>暂无图片</p>
        </div>

        <!-- 浮动意见按钮 (移动端) -->
        <button class="floating-comments-btn" @click="togglePanel" v-if="cards.length > 0">
          <span class="fm-badge">{{ cards.length }}</span>
          意见反馈
        </button>
      </div>

      <!-- AI 风格面板 (右侧滑出) -->
      <div v-if="showAiPanel" class="ai-style-panel-overlay" @click.self="showAiPanel = false">
        <div class="ai-style-panel">
          <div class="ai-panel-header">
            <h3 class="ai-panel-title">AI 风格设置</h3>
            <button class="ai-panel-close" @click="showAiPanel = false">✕</button>
          </div>
          <div class="ai-panel-body">
            <div class="ai-style-upload">
              <label class="btn-upload-ref">
                <input type="file" accept="image/*" @change="handleRefUpload" hidden />
                上传参考图
              </label>
              <span v-if="refImage" class="ref-image-name">{{ refImage.name }}</span>
            </div>
            <div v-if="refImage" class="ai-style-grid">
              <span class="ai-style-grid-label">选择风格方向</span>
              <div class="ai-style-variants">
                <div
                  v-for="variant in aiStyleVariants"
                  :key="variant.key"
                  class="ai-style-variant"
                  :class="{ selected: selectedAiStyle === variant.key }"
                  @click="selectedAiStyle = variant.key"
                >
                  <div class="variant-preview-wrap">
                    <img :src="refImagePreview" :style="{ filter: getComputedFilter(variant.filter) }" class="variant-preview" />
                  </div>
                  <span class="variant-label">{{ variant.label }}</span>
                </div>
              </div>
            </div>
            <div v-if="selectedAiStyle" class="ai-style-intensity">
              <label class="intensity-label">风格强度</label>
              <input
                type="range"
                min="0"
                max="100"
                v-model.number="aiStyleIntensity"
                class="intensity-slider"
              />
              <span class="intensity-value">{{ aiStyleIntensity }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部面板：意见卡片 -->
      <aside class="bottom-panel" :class="{ collapsed: panelCollapsed }" @scroll="onPanelScroll">
        <div class="mobile-sheet-handle"></div>
        <div class="panel-handle" @click="togglePanel">
          <span class="handle-bar"></span>
          <span class="panel-handle-text">{{ panelCollapsed ? '展开意见 (' + cards.length + ')' : '收起' }}</span>
        </div>
        <div class="panel-header" v-show="!panelCollapsed">
          <h2 class="panel-title">意见反馈</h2>
          <span class="card-count">{{ cards.length }} 条</span>
        </div>
        <div class="panel-content" v-show="!panelCollapsed">
        <div class="card-list" v-if="cards.length > 0">
          <div
            v-for="(card, idx) in cards"
            :key="card.id"
            class="comment-card"
            :data-card-id="card.id"
            @mouseenter="startCardViewTimer(card.id)"
            @mouseleave="stopCardViewTimer(card.id)"
          >
            <div class="card-header">
              <span class="card-index">#{{ idx + 1 }}</span>
              <img
                v-if="card.thumbnailUrl"
                :src="card.thumbnailUrl"
                class="card-thumb"
              />
              <div v-else class="card-thumb-placeholder"></div>
            </div>
            <div class="card-body">
              <p class="card-text">{{ card.text }}</p>
              <span v-if="cardReadReceipts[card.id]" class="card-read-receipt">✓ 对方已读</span>
            </div>
            <div class="card-actions">
              <div class="card-reply-row" v-if="!projectConfirmed">
                <textarea
                  v-model="cardReplies[card.id]"
                  class="card-reply-input"
                  placeholder="输入反馈文字..."
                  rows="2"
                ></textarea>
                <button
                  class="btn-reply-submit"
                  :disabled="!cardReplies[card.id]?.trim() || replySubmitting[card.id]"
                  @click="submitReply(card.id)"
                >
                  {{ replySubmitting[card.id] ? '...' : '发送' }}
                </button>
              </div>
              <div class="card-reply-row" v-if="!projectConfirmed">
                <button
                  class="btn-voice"
                  :class="{ recording: recordingCard === card.id }"
                  @click="toggleVoiceInput(card.id)"
                  :title="recordingCard === card.id ? '点击停止录音' : '语音输入'"
                >
                  {{ recordingCard === card.id ? '⏹' : '🎤' }}
                </button>
              </div>
              <div class="card-btns" v-if="!projectConfirmed">
                <button
                  class="btn-card"
                  :class="{ active: cardStates[card.id] === 'confirmed' }"
                  @click="toggleCardState(card.id, 'confirmed')"
                >
                  确认
                </button>
                <button
                  class="btn-card btn-card--modify"
                  :class="{ active: cardStates[card.id] === 'modify' }"
                  @click="toggleCardState(card.id, 'modify')"
                >
                  继续修改
                </button>
              </div>
              <div v-if="projectConfirmed" class="card-readonly-state">
                <span class="card-state-badge" :class="cardStates[card.id] === 'confirmed' ? 'state-confirmed' : 'state-modify'">
                  {{ cardStates[card.id] === 'confirmed' ? '已确认' : '待修改' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="card-empty">
          <span>暂无意见卡片</span>
        </div>
        </div>
      </aside>
      <button v-if="showBackToTop" class="btn-back-to-top" @click="scrollToTop" title="回到顶部">
        ↑
      </button>
    </div>

    <!-- 加载/错误 -->
    <div v-else-if="loading" class="loading-state">
      <div class="skeleton-brand"></div>
      <div class="skeleton-viewer">
        <div class="skeleton-img"></div>
      </div>
      <div class="skeleton-panel">
        <div class="skeleton-line" style="width: 60%;"></div>
        <div class="skeleton-line" style="width: 80%;"></div>
        <div class="skeleton-line" style="width: 70%;"></div>
      </div>
    </div>
    <div v-else-if="errorType === 'not_found'" class="error-state">
      <p>项目不存在或链接已失效</p>
    </div>
    <div v-else class="error-state">
      <p>网络错误，请检查连接后重试</p>
      <button class="btn-retry" @click="fetchProject">重新加载</button>
    </div>

    <!-- 底部确认栏 -->
    <div v-if="project && !projectConfirmed && cards.length > 0" class="confirm-bar">
      <button
        class="btn-preview-confirm"
        :disabled="confirming"
        @click="confirmDelivery"
      >
        全部确稿
      </button>
    </div>

    <!-- 确稿后只读操作栏 -->
    <div v-if="project && projectConfirmed" class="readonly-bar">
      <span class="readonly-notice">项目已确稿，仅可查看</span>
      <div class="readonly-actions">
        <button class="btn-request-modify" @click="requestModification">申请修改</button>
        <button class="btn-download" @click="goToDownload">前往下载</button>
        <!-- FB-004: 下载确认单 -->
        <button class="btn-download-confirmation" @click="downloadConfirmationPdf" :disabled="downloadingConfirmation">
          <Download :size="14" /> {{ downloadingConfirmation ? '下载中...' : '下载确认单' }}
        </button>
      </div>
    </div>

    <!-- 确稿前对比预览弹窗（F-18-1） -->
    <div v-if="showPreviewModal" class="modal-overlay" @click.self="showPreviewModal = false">
      <div class="modal-content preview-modal">
        <h3 class="modal-title">确稿确认</h3>
        <p class="modal-desc">请拖动滑块对比修改前后效果，确认无误后点击「确稿」</p>

        <!-- 对比区域 -->
        <div class="compare-area" v-if="currentImageUrl">
          <div class="compare-container">
            <img :src="currentImageUrl" alt="修改后" class="compare-img compare-after" />
            <div class="compare-before-wrap" :style="{ clipPath: 'inset(0 ' + (100 - compareSlider) + '% 0 0)' }">
              <img :src="originalImageUrl || currentImageUrl" alt="修改前" class="compare-img compare-before" />
            </div>
            <div class="compare-slider-line" :style="{ left: compareSlider + '%' }"></div>
            <!-- 7.3 修改区域高亮 -->
            <div
              v-for="(area, aIdx) in modifiedAreas"
              :key="'area-' + aIdx"
              class="modified-area-highlight"
              :style="{
                left: area.x + '%',
                top: area.y + '%',
                width: area.w + '%',
                height: area.h + '%'
              }"
            >
              <span class="modified-area-label">{{ area.label }}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              v-model.number="compareSlider"
              class="compare-slider-input"
            />
          </div>
          <div class="compare-labels">
            <span>修改前</span>
            <span>修改后</span>
          </div>
        </div>

        <div class="preview-detail-section">
          <button class="btn-detail-toggle" @click="showModifyDetails = !showModifyDetails">
            {{ showModifyDetails ? '收起' : '查看修改详情' }} ({{ cards.length }} 条)
          </button>
          <div v-if="showModifyDetails" class="preview-list">
            <div v-for="(card, idx) in cards" :key="card.id" class="preview-item">
              <span class="preview-index">#{{ idx + 1 }}</span>
              <span class="preview-text">{{ card.text }}</span>
              <span
                class="preview-state"
                :class="cardStates[card.id] === 'confirmed' ? 'state-confirmed' : 'state-modify'"
              >
                {{ cardStates[card.id] === 'confirmed' ? '已确认' : '待修改' }}
              </span>
            </div>
          </div>
        </div>

        <p class="modal-warning" v-if="pendingCount > 0 && !showModifyDetails">
          还有 {{ pendingCount }} 条意见未标记确认
        </p>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showPreviewModal = false">返回修改</button>
          <button
            class="btn-confirm"
            :disabled="confirming"
            @click="onFirstConfirm"
          >
            {{ confirming ? '提交中...' : '确稿' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 7.2 二次确稿确认弹窗 -->
    <div v-if="showSecondConfirmModal" class="modal-overlay" @click.self="showSecondConfirmModal = false">
      <div class="modal-content">
        <span class="modal-icon">⚠️</span>
        <h3 class="modal-title">最后确认</h3>
        <p class="modal-text">确稿后如需修改需联系摄影师申请。确认提交吗？</p>
        <div class="modal-actions modal-actions--center">
          <button class="btn-cancel" @click="showSecondConfirmModal = false">再想想</button>
          <button
            class="btn-confirm"
            :disabled="confirming"
            @click="confirmAll"
          >
            {{ confirming ? '提交中...' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 确稿成功弹窗（F-18-2：确稿后客户只能申请修改） -->
    <div v-if="showCompleteModal" class="modal-overlay" @click.self="goToDownload">
      <div class="modal-content">
        <span class="modal-icon">🎉</span>
        <h3 class="modal-title">确稿成功</h3>
        <p class="modal-text">所有意见已确认。如需修改，请点击「申请修改」通知工作室</p>
        <div class="modal-actions modal-actions--center">
          <button class="btn-request-modify" @click="requestModification">申请修改</button>
          <button class="btn-download" @click="goToDownload">前往下载</button>
        </div>
      </div>
    </div>

    <!-- 申请修改弹窗 -->
    <div v-if="showModifyRequestModal" class="modal-overlay" @click.self="showModifyRequestModal = false">
      <div class="modal-content">
        <h3 class="modal-title">申请修改</h3>
        <p class="modal-text">请描述需要修改的内容，工作室将收到通知</p>
        <textarea
          v-model="modifyRequestText"
          class="modify-request-input"
          placeholder="请描述需要修改的内容..."
          rows="3"
        ></textarea>
        <p v-if="modifyRequestText.trim().length > 0 && modifyRequestText.trim().length < 5" class="modify-request-hint">
          至少5个字
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showModifyRequestModal = false">取消</button>
          <button
            class="btn-confirm"
            :disabled="modifyRequestText.trim().length < 5 || submittingRequest"
            @click="submitModifyRequest"
          >
            {{ submittingRequest ? '提交中...' : '提交申请' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 7.1 首次打开气泡引导 -->
    <div v-if="showBubbleGuide" class="bubble-guide-overlay">
      <div class="bubble-guide-card">
        <div class="bubble-steps">
          <span class="bubble-step-dot" :class="{ active: bubbleStep === 0 }"></span>
          <span class="bubble-step-dot" :class="{ active: bubbleStep === 1 }"></span>
          <span class="bubble-step-dot" :class="{ active: bubbleStep === 2 }"></span>
        </div>
        <p class="bubble-guide-text">{{ bubbleGuides[bubbleStep] }}</p>
        <div class="bubble-guide-actions">
          <button class="btn-bubble-skip" @click="skipBubbleGuide">跳过</button>
          <button
            class="btn-bubble-next"
            @click="bubbleStep < 2 ? bubbleStep++ : finishBubbleGuide()"
          >
            {{ bubbleStep < 2 ? '下一步' : '完成' }}
          </button>
        </div>
      </div>
    </div>

    <!-- UX-32: 确稿二次确认弹窗 -->
    <div v-if="showConfirmModal" class="confirm-modal-overlay" @click.self="showConfirmModal = false">
      <div class="confirm-modal">
        <div class="confirm-modal-icon">⚠️</div>
        <h3 class="confirm-modal-title">确认确稿</h3>
        <p class="confirm-modal-desc">确认后修图师将开始修图，提交后不可撤回。确定吗？</p>
        <div class="confirm-modal-actions">
          <button class="btn-cancel" @click="showConfirmModal = false">取消</button>
          <button class="btn-confirm" @click="doConfirmDelivery">确认确稿</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectApi } from '@/api/projects'
import client from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Project, CommentCard, ImageMedia, ProjectStatus } from '@/types/models'
import { PROJECT_STATUS_LABELS } from '@/types/models'
import { ChevronLeft, ChevronRight, Sparkles, Download } from 'lucide-vue-next'

const toast = useToast()

const route = useRoute()
const router = useRouter()

const shareToken = computed(() => route.params.shareToken as string)
const project = ref<Project | null>(null)
const brand = ref({ name: '', logoUrl: '', themeColor: '#0066FF' })

const safeBrandColor = computed(() => {
  if (!brand.value.themeColor) return '#1a73e8'
  const c = brand.value.themeColor
  if (c === '#ea4335' || c === '#34a853' || c === '#ff0000' || c === '#00ff00') return '#1a73e8'
  return c
})

const cards = ref<CommentCard[]>([])
const projectImages = ref<ImageMedia[]>([])
const currentImageIndex = ref(0)
const loading = ref(true)
const confirming = ref(false)
const showCompleteModal = ref(false)
const showPreviewModal = ref(false)
const showModifyRequestModal = ref(false)
const showModifyDetails = ref(false)
const compareSlider = ref(50)
const modifyRequestText = ref('')
const submittingRequest = ref(false)
const replySubmitting = ref<Record<string, boolean>>({})
const originalImageUrl = ref('')
// FB-004: 下载确认单
const downloadingConfirmation = ref(false)

// UX-12: 已阅/无需修改
const reviewedImages = ref<Set<string>>(new Set())

// UX-14: 对比模式
const compareMode = ref<'side' | 'slider' | 'overlay'>('side')
const sliderPosition = ref(50)
const isDraggingSlider = ref(false)

// UX-21: AI风格参考图
const refImage = ref<File | null>(null)
const refImagePreview = ref('')

// UX-38: AI风格多方向
const aiStyleVariants = [
  { key: 'warm', label: '暖色', filter: 'sepia(0.3) saturate(1.3)' },
  { key: 'cool', label: '冷色', filter: 'saturate(0.8) hue-rotate(-15deg)' },
  { key: 'natural', label: '自然光', filter: 'brightness(1.05)' },
  { key: 'ins', label: 'INS风', filter: 'contrast(0.9) brightness(1.1)' },
]
const selectedAiStyle = ref('')
const aiStyleIntensity = ref(100)

// 简化工具栏：面板和下拉状态
const showAiPanel = ref(false)
const showCompareDropdown = ref(false)
const showSettingsDropdown = ref(false)

const aiStyleAppliedFilter = computed(() => {
  const variant = aiStyleVariants.find(v => v.key === selectedAiStyle.value)
  if (!variant || !variant.filter) return ''
  return getComputedFilter(variant.filter)
})

function getComputedFilter(baseFilter: string): string {
  const intensity = aiStyleIntensity.value / 100
  return baseFilter.replace(/\(([\d.]+)/g, (_, val) => {
    return '(' + (parseFloat(val) * intensity).toFixed(2)
  })
}

// UX-04: 确稿后只读模式
const projectConfirmed = ref(false)

// UX-37: 标注处理状态横幅
const statusBanner = reactive({
  show: false,
  status: 'submitted' as 'submitted' | 'viewed' | 'processing' | 'completed',
  text: '',
  updatedAt: ''
})
let statusPollTimer: ReturnType<typeof setInterval> | null = null

const statusTextMap: Record<string, string> = {
  submitted: '已提交，等待修图师查看',
  viewed: '修图师已查看，正在处理中',
  processing: '修图师正在处理中',
  completed: '已修图完成，请确认',
}

async function fetchProjectStatus() {
  try {
    const res = await client.get(`/v1/share/${shareToken.value}/status`)
    if (res.data?.data) {
      const { status, updatedAt } = res.data.data
      statusBanner.status = status
      statusBanner.text = statusTextMap[status] || '状态未知'
      statusBanner.updatedAt = updatedAt || ''
      statusBanner.show = true
    }
  } catch (e) {
    // 静默失败，不显示横幅
  }
}

function startStatusPolling() {
  fetchProjectStatus()
  statusPollTimer = setInterval(fetchProjectStatus, 10000)
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer)
    statusPollTimer = null
  }
}

// UX-25: 回到顶部
const showBackToTop = ref(false)

// UX-39: 审片进度条
const reviewProgressExpanded = ref(false)
const totalImages = computed(() => projectImages.value.length)
const confirmedCount = computed(() => {
  return cards.value.filter(c => cardStates.value[c.id] === 'confirmed').length
})
const confirmedPercent = computed(() => {
  const total = totalImages.value
  if (total === 0) return 0
  return Math.round((confirmedCount.value / total) * 100)
})
const reviewedPercent = computed(() => {
  const total = totalImages.value
  if (total === 0) return 0
  const reviewedNotConfirmed = Math.max(0, reviewedImages.value.size - confirmedCount.value)
  return Math.round((reviewedNotConfirmed / total) * 100)
})
const unreviewedPercent = computed(() => {
  return Math.max(0, 100 - confirmedPercent.value - reviewedPercent.value)
})

function cardStatesForImage(imageId: string): string {
  const card = cards.value.find(c => c.imageId === imageId)
  if (card) return cardStates.value[card.id] || ''
  return ''
}

// FEAT-02: 语音输入
const recordingCard = ref<string | null>(null)
let recognition: any = null

function toggleVoiceInput(cardId: string) {
  if (recordingCard.value === cardId) {
    stopVoiceInput()
  } else {
    startVoiceInput(cardId)
  }
}

function startVoiceInput(cardId: string) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) {
    toast.info('当前浏览器不支持语音输入')
    return
  }
  if (recordingCard.value) {
    stopVoiceInput()
  }
  try {
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      if (transcript) {
        const existing = cardReplies.value[cardId] || ''
        cardReplies.value[cardId] = existing + transcript
      }
    }
    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error)
      if (event.error !== 'aborted') {
        toast.error('语音识别失败: ' + event.error)
      }
      recordingCard.value = null
    }
    recognition.onend = () => {
      recordingCard.value = null
    }
    recognition.start()
    recordingCard.value = cardId
  } catch (e: any) {
    console.error('启动语音识别失败:', e)
    toast.error('语音输入启动失败')
  }
}

function stopVoiceInput() {
  if (recognition) {
    try { recognition.stop() } catch { /* ignore */ }
    recognition = null
  }
  recordingCard.value = null
}

// 7.2 二次确稿
const showSecondConfirmModal = ref(false)

// UX-32: 确稿二次确认弹窗
const showConfirmModal = ref(false)

function confirmDelivery() {
  showConfirmModal.value = true
}

function doConfirmDelivery() {
  showConfirmModal.value = false
  showPreviewModal.value = true
}

// 7.3 修改区域高亮 — 模拟数据，实际可从API获取
const modifiedAreas = ref<{ x: number; y: number; w: number; h: number; label: string }[]>([])

// 7.1 气泡引导
const showBubbleGuide = ref(false)

// UX-01: 面板折叠
const panelCollapsed = ref(false)
function togglePanel() {
  panelCollapsed.value = !panelCollapsed.value
}

// UX-25: 回到顶部
function onPanelScroll(e: Event) {
  const target = e.target as HTMLElement
  showBackToTop.value = target.scrollTop > 300
}

function scrollToTop() {
  const panel = document.querySelector('.bottom-panel')
  if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' })
}

// UX-001: AI 风格样片功能已迁移至右侧滑出面板
async function openAIStyle() {
  if (!currentImageId.value) {
    toast.warning('请先选择一张图片')
    return
  }
  showAiPanel.value = true
}

// UX-21: AI风格参考图上传
async function handleRefUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    refImage.value = input.files[0]
    refImagePreview.value = URL.createObjectURL(input.files[0])
    selectedAiStyle.value = ''
    toast.info('参考图已上传，请选择风格方向')
  }
}

// UX-03: 图片手势缩放
const zoomScale = ref(1)
const zoomTranslateX = ref(0)
const zoomTranslateY = ref(0)
let touchStartDist = 0
let touchStartScale = 1
let touchStartX = 0
let touchStartY = 0
let touchStartTranslateX = 0
let touchStartTranslateY = 0
let isPinching = false
let isDragging = false

const zoomStyle = computed(() => ({
  transform: `translate(${zoomTranslateX.value}px, ${zoomTranslateY.value}px) scale(${zoomScale.value})`,
  transition: isPinching || isDragging ? 'none' : 'transform 0.2s ease-out'
}))

function getTouchDist(e: TouchEvent): number {
  if (e.touches.length < 2) return 0
  const dx = e.touches[0].clientX - e.touches[1].clientX
  const dy = e.touches[0].clientY - e.touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    isPinching = true
    isDragging = false
    touchStartDist = getTouchDist(e)
    touchStartScale = zoomScale.value
  } else if (e.touches.length === 1 && zoomScale.value > 1) {
    isDragging = true
    isPinching = false
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    touchStartTranslateX = zoomTranslateX.value
    touchStartTranslateY = zoomTranslateY.value
  }
}

function onTouchMove(e: TouchEvent) {
  if (isPinching && e.touches.length === 2) {
    e.preventDefault()
    const dist = getTouchDist(e)
    if (touchStartDist > 0) {
      const newScale = Math.max(1, Math.min(4, touchStartScale * (dist / touchStartDist)))
      zoomScale.value = newScale
      if (newScale <= 1) {
        zoomTranslateX.value = 0
        zoomTranslateY.value = 0
      }
    }
  } else if (isDragging && e.touches.length === 1) {
    const dx = e.touches[0].clientX - touchStartX
    const dy = e.touches[0].clientY - touchStartY
    zoomTranslateX.value = touchStartTranslateX + dx
    zoomTranslateY.value = touchStartTranslateY + dy
  }
}

function onTouchEnd() {
  isPinching = false
  isDragging = false
  if (zoomScale.value <= 1) {
    zoomScale.value = 1
    zoomTranslateX.value = 0
    zoomTranslateY.value = 0
  }
}

// 双击重置缩放
function resetZoom() {
  zoomScale.value = 1
  zoomTranslateX.value = 0
  zoomTranslateY.value = 0
}

// UX-14: 滑块对比拖拽
function startSliderDrag(e: MouseEvent | TouchEvent) {
  isDraggingSlider.value = true
  updateSliderPosition(e)
}

function updateSliderPosition(e: MouseEvent | TouchEvent) {
  if (!isDraggingSlider.value) return
  const container = (e.currentTarget as HTMLElement)
  const rect = container.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const pos = ((clientX - rect.left) / rect.width) * 100
  sliderPosition.value = Math.max(0, Math.min(100, pos))
}

function stopSliderDrag() {
  isDraggingSlider.value = false
}
const bubbleStep = ref(0)
const bubbleGuides = [
  '双指缩放查看细节',
  '点击画笔开始标注',
  '写完意见点发送',
]

// 7.5 已读回执
const cardReadReceipts = ref<Record<string, boolean>>({})
const cardViewTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})

const pendingCount = computed(() => {
  return cards.value.filter(c => cardStates.value[c.id] !== 'confirmed').length
})

const cardReplies = ref<Record<string, string>>({})
const cardStates = ref<Record<string, 'confirmed' | 'modify' | null>>({})

const statusLabelMap: Record<ProjectStatus, string> = PROJECT_STATUS_LABELS

const statusLabel = computed(() => {
  if (!project.value) return ''
  return statusLabelMap[project.value.status] || project.value.status
})

const progressPercent = computed(() => {
  if (!project.value) return 0
  const map: Record<ProjectStatus, number> = {
    draft: 10,
    review: 30,
    in_progress: 55,
    final_review: 80,
    completed: 100,
    archived: 100,
  }
  return map[project.value.status] || 0
})

const currentImageUrl = computed(() => {
  if (projectImages.value.length > 0) {
    const img = projectImages.value[currentImageIndex.value]
    return img?.thumbnailUrls?.[0] || img?.originalUrl || ''
  }
  return project.value?.thumbnailUrl || ''
})

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// FEAT-01: 当前图片上有位置标记的意见卡片
const currentImageId = computed(() => {
  if (projectImages.value.length > 0) {
    return projectImages.value[currentImageIndex.value]?.id
  }
  return null
})

// FEAT-03: 图片已查看标记
const imageViewed = ref<Record<string, boolean>>({})

const isCurrentImageViewed = computed(() => {
  const id = currentImageId.value
  return id ? !!imageViewed.value[id] : false
})

const viewedCount = computed(() => Object.values(imageViewed.value).filter(Boolean).length)

// UX-12: 当前图片是否已标记为已阅
const currentImageReviewed = computed(() => {
  const img = projectImages.value[currentImageIndex.value]
  return img ? reviewedImages.value.has(img.id) : false
})

// UX-14: 是否有对比图
const hasComparison = computed(() => {
  return !!originalImageUrl.value
})

function toggleImageView(imageId: string) {
  if (!imageId) return
  imageViewed.value[imageId] = !imageViewed.value[imageId]
  persistImageViewed()
}

function markAllImagesViewed() {
  projectImages.value.forEach(img => {
    imageViewed.value[img.id] = true
  })
  persistImageViewed()
}

function persistImageViewed() {
  try {
    sessionStorage.setItem('client_image_viewed', JSON.stringify(imageViewed.value))
  } catch { /* ignore */ }
}

// UX-12: 标记已阅/无需修改
async function markAsReviewed() {
  const img = projectImages.value[currentImageIndex.value]
  if (!img) return
  try {
    await client.post(`/v1/images/${img.id}/mark-reviewed`)
    reviewedImages.value.add(img.id)
    toast.success('已标记为无需修改')
  } catch (e) {
    toast.error('标记失败，请重试')
  }
}

const positionMarkers = computed(() => {
  if (!currentImageId.value) return []
  return cards.value
    .filter(c => c.imageId === currentImageId.value && c.positionX != null && c.positionY != null)
    .map(c => {
      const idx = cards.value.findIndex(x => x.id === c.id) + 1
      return { cardId: c.id, x: c.positionX!, y: c.positionY!, index: idx, text: c.text }
    })
})

function scrollToCard(cardId: string) {
  // 展开面板并滚动到对应卡片
  panelCollapsed.value = false
  setTimeout(() => {
    const cardEl = document.querySelector(`.comment-card[data-card-id="${cardId}"]`)
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, 100)
}

function toggleCardState(cardId: string, state: 'confirmed' | 'modify') {
  cardStates.value[cardId] = cardStates.value[cardId] === state ? null : state
  // Persist to sessionStorage so it survives refresh
  try {
    sessionStorage.setItem('client_card_states', JSON.stringify(cardStates.value))
  } catch { /* ignore */ }
}

async function submitReply(cardId: string) {
  const reply = cardReplies.value[cardId]
  if (!reply?.trim()) return
  replySubmitting.value[cardId] = true
  try {
    await projectApi.submitCardReply(cardId, reply.trim())
    cardReplies.value[cardId] = ''
    toast.success('回复已提交')
  } catch (e: any) {
    console.error('提交反馈失败:', e)
    toast.error('提交失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    replySubmitting.value[cardId] = false
  }
}

const errorType = ref<'none' | 'not_found' | 'network'>('none')

async function fetchProject() {
  loading.value = true
  try {
    const res = await projectApi.getByShareToken(shareToken.value)
    project.value = res.data.data.project
    cards.value = res.data.data.cards
    // Load project images
    if ((res.data.data as any).images && (res.data.data as any).images.length > 0) {
      projectImages.value = (res.data.data as any).images
    }
    // 7.1 气泡引导检查
    if ((res.data.data.project as any).clientFirstVisit === 'true') {
      showBubbleGuide.value = true
    }
    // 7.3 加载修改区域（模拟）
    if ((res.data.data as any).modifiedAreas) {
      modifiedAreas.value = (res.data.data as any).modifiedAreas
    }
    errorType.value = 'none'
  } catch (e: any) {
    console.error('获取项目失败:', e)
    project.value = null
    // 区分 404 (项目不存在/链接失效) 和 网络错误
    if (e?.response?.status === 404) {
      errorType.value = 'not_found'
    } else {
      errorType.value = 'network'
    }
  } finally {
    loading.value = false
  }
}

async function confirmAll() {
  showSecondConfirmModal.value = false
  confirming.value = true
  try {
    if (project.value) {
      await projectApi.completeProject(project.value.id)
    }
    // UX-04: 确稿后进入只读模式，不再弹出阻塞弹窗
    projectConfirmed.value = true
    toast.success('确稿成功！项目已进入只读模式，可查看图片和意见')
  } catch (e: any) {
    console.error('确稿失败:', e)
    toast.error('确稿失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    confirming.value = false
  }
}

// 7.2 二次确稿：先关闭预览弹窗，再打开二次确认
function onFirstConfirm() {
  showPreviewModal.value = false
  showSecondConfirmModal.value = true
}

// 7.1 气泡引导
function skipBubbleGuide() {
  showBubbleGuide.value = false
  finishBubbleVisit()
}

function finishBubbleGuide() {
  showBubbleGuide.value = false
  finishBubbleVisit()
}

async function finishBubbleVisit() {
  if (!project.value) return
  try {
    await client.put(`/v1/projects/${project.value.id}/client-first-visit`, { firstVisit: false })
  } catch { /* ignore */ }
}

// 7.5 已读回执
function startCardViewTimer(cardId: string) {
  if (cardViewTimers.value[cardId] || cardReadReceipts.value[cardId]) return
  cardViewTimers.value[cardId] = setTimeout(() => {
    sendReadReceipt(cardId)
  }, 3000)
}

function stopCardViewTimer(cardId: string) {
  const timer = cardViewTimers.value[cardId]
  if (timer) {
    clearTimeout(timer)
    delete cardViewTimers.value[cardId]
  }
}

async function sendReadReceipt(cardId: string) {
  try {
    await client.post(`/v1/comment-cards/${cardId}/read-receipt`)
    cardReadReceipts.value[cardId] = true
  } catch { /* ignore */ }
}

function goToDownload() {
  showCompleteModal.value = false
  router.push(`/client/assets?token=${shareToken.value}`)
}

// FB-004: 下载确认单
async function downloadConfirmationPdf() {
  if (!project.value) return
  downloadingConfirmation.value = true
  try {
    const res = await client.get(`/v1/projects/${project.value.id}/confirmation-pdf`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `确认单-${project.value.clientName || project.value.name || '项目'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('确认单已生成，正在下载...')
  } catch (e: any) {
    console.error('下载确认单失败:', e)
    toast.error('下载确认单失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    downloadingConfirmation.value = false
  }
}

function requestModification() {
  showCompleteModal.value = false
  showModifyRequestModal.value = true
}

async function submitModifyRequest() {
  if (!modifyRequestText.value.trim()) return
  submittingRequest.value = true
  try {
    if (project.value) {
      await projectApi.requestModification(project.value.id, modifyRequestText.value.trim())
    }
    showModifyRequestModal.value = false
    modifyRequestText.value = ''
    toast.success('修改申请已提交，工作室将尽快处理')
  } catch (e: any) {
    toast.error('提交失败: ' + (e?.response?.data?.message || e?.message || '请稍后重试'))
  } finally {
    submittingRequest.value = false
  }
}

async function fetchBrand() {
  try {
    const res = await client.get(`/v1/share/${shareToken.value}/brand`)
    if (res.data?.data) {
      brand.value = res.data.data
    }
  } catch { /* use defaults */ }
}

onMounted(() => {
  // Restore card states from sessionStorage
  try {
    const saved = sessionStorage.getItem('client_card_states')
    if (saved) cardStates.value = JSON.parse(saved)
  } catch { /* ignore */ }
  // FEAT-03: 恢复图片已查看状态
  try {
    const viewed = sessionStorage.getItem('client_image_viewed')
    if (viewed) imageViewed.value = JSON.parse(viewed)
  } catch { /* ignore */ }
  // DATA-05: 记录客户已查看分享链接
  client.post(`/v1/share/${shareToken.value}/view`).catch(() => { /* ignore */ })
  // UX-37: 启动状态轮询
  startStatusPolling()
  fetchBrand()
  fetchProject().then(() => {
    // UX-04: 页面刷新后恢复确稿状态
    if (project.value?.status === 'completed') {
      projectConfirmed.value = true
    }
  })
})

onUnmounted(() => {
  // 清理所有已读回执计时器
  Object.values(cardViewTimers.value).forEach(t => clearTimeout(t))
  cardViewTimers.value = {}
  // FEAT-02: 停止语音识别
  stopVoiceInput()
  // UX-37: 停止状态轮询
  stopStatusPolling()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.client-project {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $color-bg;
  overflow: hidden;
}

// F-52: 品牌栏
.brand-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  background: #fff;
  border-bottom: 2px solid var(--brand-color, #1a73e8);
  flex-shrink: 0;
}
.brand-logo {
  height: 24px;
  max-width: 100px;
  object-fit: contain;
}
.brand-name {
  font-size: 13px;
  font-weight: 600;
  color: $color-text;
}

// UX-37: 标注处理状态横幅
.status-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
  text-align: center;

  &--submitted {
    background: #e8f0fe;
    color: #1a56db;
    border-bottom: 1px solid #a8c7fa;
  }

  &--viewed {
    background: #e8f0fe;
    color: #1a56db;
    border-bottom: 1px solid #a8c7fa;
  }

  &--processing {
    background: #fef7e0;
    color: #9a6b00;
    border-bottom: 1px solid #fdd663;
  }

  &--completed {
    background: #e6f4ea;
    color: #137333;
    border-bottom: 1px solid #a8dab5;
  }
}

.status-banner-text {
  font-weight: 600;
}

.status-banner-time {
  font-size: 12px;
  opacity: 0.7;
}

.top-bar {
  height: 56px;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  gap: 20px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .project-name {
    font-size: 16px;
    font-weight: 600;
    color: $color-text;
  }

  .status-label {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 500;
  }
}

.top-center {
  flex: 1;
  max-width: 300px;
}

.progress-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: $color-border-light;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: $color-primary;
  transition: width 0.4s ease;
}

.progress-text {
  font-size: 12px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;

  .deadline-label {
    color: $color-text-secondary;
  }

  .deadline-date {
    color: $color-text;
    font-weight: 500;
  }
}

// UX-39: 审片进度条
.review-progress-bar {
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  flex-shrink: 0;
}

.review-progress-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: $color-surface-hover; }
}

.review-progress-text {
  font-size: 13px;
  font-weight: 500;
  color: $color-text;
}

.review-progress-toggle {
  font-size: 10px;
  color: $color-text-muted;
}

.review-progress-segments {
  display: flex;
  height: 6px;
  cursor: pointer;
  margin: 0 20px 8px;
  border-radius: 3px;
  overflow: hidden;
}

.review-segment {
  transition: width 0.3s ease;
  &--confirmed { background: #34a853; }
  &--reviewed { background: #1a73e8; }
  &--unreviewed { background: #e0e0e0; }
}

.review-progress-detail {
  padding: 0 20px 12px;
}

.review-detail-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.review-detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 6px;
  border-radius: 6px;
  border: 2px solid transparent;
  transition: border-color 0.15s;

  &:hover {
    border-color: $color-border;
  }

  &.review-detail--confirmed {
    border-color: #34a853;
    background: rgba(52, 168, 83, 0.06);
  }
  &.review-detail--reviewed {
    border-color: #1a73e8;
    background: rgba(26, 115, 232, 0.06);
  }
  &.review-detail--unreviewed {
    border-color: #e0e0e0;
  }
}

.review-detail-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}

.review-detail-thumb-placeholder {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  background: $color-border-light;
}

.review-detail-status {
  font-size: 11px;
  font-weight: 500;
  color: $color-text-secondary;
  .review-detail--confirmed & { color: #34a853; }
  .review-detail--reviewed & { color: #1a73e8; }
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.image-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  position: relative;
  overflow: hidden;
}

// UX-03: 缩放容器
.image-zoom-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

// UX-02: 浮动工具栏（简化版）
.floating-toolbar {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.85);
  }
}

// 工具栏下拉菜单
.toolbar-dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 6px;
  min-width: 140px;
  z-index: 20;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: dropdownFadeIn 0.15s ease;

  &--up {
    bottom: calc(100% + 8px);
    top: auto;
  }
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  background: none;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &.active {
    background: rgba(26, 115, 232, 0.3);
    color: #fff;
  }

  &--upload {
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    &:hover {
      color: #fff;
    }
  }
}

.dropdown-ref-name {
  display: block;
  padding: 4px 14px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

@keyframes dropdownFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

// UX-01: 浮动意见按钮
.floating-comments-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: $color-brand;
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 102, 255, 0.35);
  z-index: 10;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover { transform: scale(1.05); }
  &:active { transform: scale(0.97); }
}

.fm-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #fff;
  color: $color-brand;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.image-counter {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 13px;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover { background: rgba(0, 0, 0, 0.7); }
}

.nav-prev { left: 12px; }
.nav-next { right: 12px; }

// FEAT-03: 图片已查看按钮
.btn-mark-viewed {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(calc(-50% - 80px));
  padding: 4px 14px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
  }

  &.viewed {
    background: rgba(0, 200, 100, 0.3);
    border-color: rgba(0, 200, 100, 0.5);
    color: #fff;
  }
}

.btn-mark-all-viewed {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(calc(-50% + 80px));
  padding: 4px 14px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.8);
  }
}

// UX-12: 已阅/无需修改按钮
.btn-mark-reviewed {
  padding: 8px 16px;
  background: #e6f4ea;
  color: #137333;
  border: 1px solid #a8dab5;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  white-space: nowrap;
  &:disabled {
    background: #f0f0f0;
    color: #999;
    border-color: #e0e0e0;
    cursor: default;
  }
  &:not(:disabled):hover {
    background: #ceead6;
  }
}

.viewed-check {
  color: $color-confirmed;
  margin-left: 4px;
  font-weight: 700;
}

.viewer-placeholder {
  text-align: center;
  color: rgba(255, 255, 255, 0.35);

  .viewer-icon {
    font-size: 56px;
    display: block;
    margin-bottom: 12px;
  }

  p {
    font-size: 16px;
  }
}

.viewer-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bottom-panel {
  height: 240px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: height 0.2s ease;

  &.collapsed {
    height: 44px;
    overflow: hidden;
  }
}

.panel-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  cursor: pointer;
  padding: 0 16px;
  user-select: none;
  border-bottom: 1px solid $color-border-light;

  .handle-bar {
    width: 40px;
    height: 4px;
    background: $color-border;
    border-radius: 2px;
    transition: background 0.2s;
  }

  .panel-handle-text {
    position: absolute;
    right: 16px;
    font-size: 12px;
    color: $color-text-muted;
  }

  &:hover .handle-bar {
    background: $color-text-muted;
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid $color-border-light;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.card-count {
  font-size: 12px;
  color: $color-text-muted;
}

.card-list {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  gap: 10px;
  padding: 12px 16px;
}

.comment-card {
  width: 220px;
  flex-shrink: 0;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: $color-bg;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-index {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-muted;
  width: 18px;
}

.card-thumb {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  object-fit: cover;
}

.card-thumb-placeholder {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  background: $color-border-light;
}

.card-body {
  flex: 1;
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

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-reply-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;

  .card-reply-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: 12px;
  color: $color-text;
  resize: none;
  outline: none;
  background: $color-surface;
  transition: border-color 0.2s;

  &::placeholder {
    color: $color-text-muted;
  }

  &:focus {
    border-color: $color-primary;
  }
}
}

.btn-reply-submit {
  padding: 6px 12px;
  background: $color-primary;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  border-radius: $radius-sm;
  flex-shrink: 0;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// FEAT-02: 语音输入按钮
.btn-voice {
  padding: 6px 10px;
  font-size: 14px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;

  &:hover {
    background: $color-surface-hover;
  }

  &.recording {
    background: #ff4444;
    color: #fff;
    border-color: #ff4444;
    animation: pulse-recording 1.2s infinite;
  }
}

@keyframes pulse-recording {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255, 68, 68, 0); }
}

.card-btns {
  display: flex;
  gap: 6px;
}

.btn-card {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  font-weight: 500;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
  color: $color-text-secondary;
  background: $color-surface;
  transition: all 0.15s;

  &:hover {
    background: $color-surface-hover;
  }

  &.active {
    background: rgba($color-success, 0.1);
    border-color: $color-success;
    color: $color-success;
  }

  &.btn-card--modify {
    &.active {
      background: rgba($color-warning, 0.1);
      border-color: $color-warning;
      color: #b06000;
    }
  }
}

.card-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $color-text-muted;
}

.loading-state, .error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 15px;
  color: $color-text-secondary;
}

// PERF-01: 骨架屏
$skeleton-base: #e8e8e8;

.skeleton-brand {
  width: 100%;
  height: 32px;
  background: linear-gradient(90deg, $skeleton-base 25%, #f0f0f0 50%, $skeleton-base 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-viewer {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
}

.skeleton-img {
  width: 60%;
  max-width: 300px;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.skeleton-panel {
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  flex-shrink: 0;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, $skeleton-base 25%, #f0f0f0 50%, $skeleton-base 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
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

.confirm-bar {
  height: 52px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-preview-confirm {
  padding: 10px 40px;
  background: $color-success;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2d9249;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// Preview modal
.preview-modal {
  width: 480px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-desc {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 16px;
}

.preview-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  max-height: 300px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: none;
  }
}

.preview-index {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-muted;
  min-width: 28px;
}

.preview-text {
  flex: 1;
  font-size: 13px;
  color: $color-text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-state {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;

  &.state-confirmed {
    background: rgba($color-success, 0.1);
    color: $color-success;
  }

  &.state-modify {
    background: rgba($color-warning, 0.1);
    color: #b06000;
  }
}

.modal-warning {
  font-size: 13px;
  color: $color-warning;
  margin-bottom: 16px;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 8px 20px;
  font-size: 14px;
  color: $color-text-secondary;
  background: $color-surface-hover;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-border-light;
  }
}

.btn-confirm {
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: $color-success;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2d9249;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 确稿成功弹窗
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
  padding: 40px 32px;
  width: 360px;
  text-align: center;
  animation: slideUp 0.3s ease;
}

.modal-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 8px;
}

.modal-text {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 24px;
}

.btn-download {
  padding: 10px 32px;
  background: $color-primary;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: $color-primary-dark;
  }
}

// FB-004: 下载确认单按钮
.btn-download-confirmation {
  padding: 10px 20px;
  background: $color-success;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2d9249;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-request-modify {
  padding: 10px 24px;
  background: $color-warning;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: #d97706;
  }
}

.modal-actions--center {
  justify-content: center;
}

// UX-04: 确稿后只读操作栏
.readonly-bar {
  height: 52px;
  background: $color-surface;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.readonly-notice {
  font-size: 13px;
  color: $color-text-muted;
}

.readonly-actions {
  display: flex;
  gap: 10px;
}

// UX-04: 已确稿徽章
.confirmed-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba($color-success, 0.1);
  color: $color-success;
  font-weight: 500;
}

// UX-04: 只读卡片状态
.card-readonly-state {
  padding-top: 4px;
}

// FEAT-01: 图片上意见编号标记点
.position-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
  cursor: pointer;
  pointer-events: auto;
}

.marker-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: rgba(0, 102, 255, 0.85);
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s, background 0.15s;

  .position-marker:hover & {
    transform: scale(1.15);
    background: $color-brand;
  }
}

.card-state-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;

  &.state-confirmed {
    background: rgba($color-success, 0.1);
    color: $color-success;
  }

  &.state-modify {
    background: rgba($color-warning, 0.1);
    color: #b06000;
  }
}

.modify-request-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  resize: vertical;
  outline: none;
  margin-bottom: 16px;
  background: $color-bg;
  transition: border-color 0.2s;

  &::placeholder { color: $color-text-muted; }
  &:focus { border-color: $color-primary; }
}

// F-18-1: 对比视图
.compare-area {
  margin-bottom: 16px;
}

.compare-container {
  position: relative;
  width: 100%;
  height: 260px;
  border-radius: $radius-md;
  overflow: hidden;
  background: #1a1a2e;
}

.compare-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-before-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.compare-slider-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: $color-primary;
  z-index: 2;
  pointer-events: none;
}

.compare-slider-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: col-resize;
  z-index: 3;
  margin: 0;
}

.compare-labels {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px 0;
  font-size: 12px;
  color: $color-text-muted;
}

.preview-detail-section {
  margin-bottom: 12px;
}

.btn-detail-toggle {
  font-size: 13px;
  color: $color-primary;
  padding: 4px 0;
  &:hover { text-decoration: underline; }
}

// 7.4 修改理由验证
.modify-request-hint {
  font-size: 12px;
  color: $color-error;
  margin: -12px 0 12px 0;
  text-align: left;
}

// 7.5 已读回执
.card-read-receipt {
  font-size: 11px;
  color: $color-success;
  margin-top: 4px;
  display: block;
}

// 7.1 气泡引导
.bubble-guide-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.bubble-guide-card {
  background: $color-surface;
  border-radius: $radius-xl;
  padding: 32px 40px;
  text-align: center;
  max-width: 360px;
  width: 90%;
  animation: slideUp 0.3s ease;
}

.bubble-steps {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.bubble-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-border-light;
  transition: background 0.2s;

  &.active {
    background: $color-primary;
    transform: scale(1.2);
  }
}

.bubble-guide-text {
  font-size: 16px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 24px;
  line-height: 1.5;
}

.bubble-guide-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.btn-bubble-skip {
  padding: 8px 20px;
  font-size: 14px;
  color: $color-text-muted;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  &:hover { background: $color-surface-hover; }
}

.btn-bubble-next {
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  &:hover { background: $color-primary-dark; }
}

// 7.3 修改区域高亮
.modified-area-highlight {
  position: absolute;
  border: 2px dashed rgba($color-warning, 0.6);
  border-radius: 2px;
  z-index: 4;
  pointer-events: none;
  background: rgba($color-warning, 0.1);
}

.modified-area-label {
  position: absolute;
  top: -20px;
  left: 0;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba($color-warning, 0.9);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

// UX-14: 滑块对比
.slider-compare {
  position: absolute;
  inset: 0;
  overflow: hidden;
  user-select: none;
  z-index: 5;
}

.slider-before {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  overflow: hidden;
  z-index: 2;
  img { width: auto; height: 100%; max-width: none; }
}

.slider-after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  img { width: auto; height: 100%; max-width: none; }
}

.slider-handle {
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 3;
  transform: translateX(-50%);
  cursor: ew-resize;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.slider-handle-line {
  width: 5px;
  height: 100%;
  background: #1a73e8;
  box-shadow: 0 0 4px rgba(0,0,0,0.3);
}

.slider-handle-arrow {
  position: absolute;
  background: #1a73e8;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

// ===== AI 风格右侧滑出面板 =====
.ai-style-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 500;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}

.ai-style-panel {
  width: 360px;
  max-width: 90vw;
  height: 100%;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s ease;
  overflow: hidden;
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.ai-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text;
  margin: 0;
}

.ai-panel-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f0f0f0;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover {
    background: #e0e0e0;
    color: #333;
  }
}

.ai-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

// UX-21: AI风格参考图上传（面板内使用）
.ai-style-upload {
  margin-bottom: 16px;
}

.btn-upload-ref {
  display: inline-block;
  padding: 10px 18px;
  background: #f0f7ff;
  color: #1a73e8;
  border: 1px dashed #1a73e8;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #e3f0ff; }
}

.ref-image-name {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// UX-38: AI风格多方向2x2网格（面板内使用）
.ai-style-grid {
  margin-top: 0;
  padding: 0;
  background: none;
  border-radius: 0;
  border: none;
}

.ai-style-grid-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.ai-style-variants {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ai-style-variant {
  cursor: pointer;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  padding: 6px;
  text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fafbfc;

  &:hover {
    border-color: #b0b0b0;
  }

  &.selected {
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    background: #fff;
  }
}

.variant-preview-wrap {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  background: #f0f0f0;
}

.variant-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.variant-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-top: 6px;
}

// UX-48: AI风格微调滑块（面板内使用）
.ai-style-intensity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 10px;
}
.intensity-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
  font-weight: 500;
}
.intensity-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
}
.intensity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #1a73e8;
  border-radius: 50%;
  cursor: pointer;
}
.intensity-value {
  font-size: 13px;
  color: #1a73e8;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

// UX-25: 回到顶部按钮
.btn-back-to-top {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1a73e8;
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: pointer;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: transform 0.2s;
  &:hover { transform: scale(1.1); }
}

// ======== A11Y-01: 移动端响应式 ========
.mobile-sheet-handle {
  display: none;
}

@media (max-width: 768px) {
  .client-project {
    overflow: hidden;
  }

  // 品牌栏：缩小
  .brand-bar {
    padding: 4px 12px;
    gap: 6px;
  }
  .brand-logo {
    height: 20px;
    max-width: 80px;
  }
  .brand-name {
    font-size: 12px;
  }

  // 顶部栏：折行
  .top-bar {
    height: auto;
    min-height: 48px;
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .top-left {
    gap: 6px;
    .project-name {
      font-size: 14px;
    }
    .status-label {
      font-size: 11px;
      padding: 2px 8px;
    }
  }
  .top-center {
    flex: 1 1 100%;
    max-width: none;
    order: 3;
  }
  .top-right {
    font-size: 11px;
    gap: 4px;
  }
  .progress-text {
    font-size: 11px;
  }

  // 主体区：纵向堆叠
  .main-area {
    flex-direction: column;
  }

  // 查看器：全宽、60vh
  .viewer-area {
    width: 100%;
    height: 60vh;
    flex: none;
  }

  // 图片查看器：触摸支持
  .image-viewer {
    touch-action: pan-x pan-y pinch-zoom;
  }

  // 浮动工具栏：固定在右下角，简洁排列
  .floating-toolbar {
    position: fixed;
    bottom: 16px;
    right: 16px;
    left: auto;
    transform: none;
    z-index: 100;
    flex-direction: column;
    gap: 6px;
  }

  .toolbar-btn {
    padding: 10px 14px;
    font-size: 12px;
    border-radius: 24px;
  }

  .btn-mark-reviewed {
    padding: 10px 14px;
    font-size: 12px;
    border-radius: 24px;
  }

  // 移动端下拉菜单向上弹出
  .dropdown-menu {
    bottom: calc(100% + 6px);
    right: 0;
    left: auto;
    transform: none;
  }

  @keyframes dropdownFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  // 标记已查看按钮：更大触摸目标
  .btn-mark-viewed {
    min-height: 48px;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 24px;
    bottom: 12px;
    transform: translateX(calc(-50% - 70px));
  }

  .btn-mark-all-viewed {
    min-height: 48px;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 24px;
    bottom: 12px;
    transform: translateX(calc(-50% + 70px));
  }

  // 底部面板：全宽、底部抽屉样式
  .bottom-panel {
    width: 100%;
    max-height: 40vh;
    height: auto;
    flex: none;
    overflow-y: auto;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 10;

    &.collapsed {
      height: 44px;
      max-height: 44px;
    }
  }

  // 移动端抽屉手柄
  .mobile-sheet-handle {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px 0 4px;
    flex-shrink: 0;

    &::after {
      content: '';
      width: 32px;
      height: 6px;
      background: #c4c4c4;
      border-radius: 3px;
    }
  }

  // 面板内容可滚动
  .panel-content {
    overflow-y: auto;
  }

  .card-list {
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .comment-card {
    width: 100%;
    flex-shrink: 1;
  }

  // 浮动意见按钮隐藏（面板已可见）
  .floating-comments-btn {
    display: none;
  }

  // 导航按钮更小
  .nav-btn {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }

  // 确稿栏
  .confirm-bar,
  .readonly-bar {
    padding: 0 12px;
    height: 48px;
  }

  .btn-preview-confirm {
    padding: 8px 28px;
    font-size: 14px;
  }

  // 弹窗适配
  .modal-content {
    width: 90%;
    max-width: 360px;
    padding: 24px 20px;
  }

  .preview-modal {
    width: 95%;
    max-height: 80vh;
  }

  // AI 面板移动端全宽
  .ai-style-panel {
    width: 100%;
    max-width: 100vw;
  }

  // UX-24: 移动端标注工具图标放大
  .tool-icon-svg {
    width: 24px !important;
    height: 24px !important;
  }
  .tool-label {
    font-size: 13px;
  }
  .tool-btn {
    padding: 12px 8px;
  }

  // UX-30: 移动端滑块手柄加粗
  .slider-handle {
    min-width: 44px;
  }
  .slider-handle-line {
    width: 8px;
  }
  .slider-handle-arrow {
    padding: 6px 10px;
    font-size: 14px;
  }
}

// UX-32: 确稿二次确认弹窗
.confirm-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 2000;
  display: flex; align-items: center; justify-content: center;
}
.confirm-modal {
  background: #fff; border-radius: 12px; padding: 32px; width: 360px;
  text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.confirm-modal-icon { font-size: 40px; margin-bottom: 12px; }
.confirm-modal-title { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
.confirm-modal-desc { font-size: 14px; color: #666; margin: 0 0 20px; line-height: 1.5; }
.confirm-modal-actions { display: flex; gap: 12px; justify-content: center; }
.btn-cancel { padding: 8px 24px; border-radius: 6px; border: 1px solid #ddd; background: #fff; font-size: 14px; cursor: pointer; }
.btn-confirm { padding: 8px 24px; border-radius: 6px; border: none; background: #1a73e8; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; &:hover { background: #1557b0; } }

// ===== FB-003: 移动端按钮热区优化 =====
@media (max-width: 768px) {
  .btn-annotate,
  .btn-toolbar,
  .btn-style,
  .btn-ai,
  .btn-lock,
  .btn-delivery,
  .btn-confirm,
  .btn-cancel,
  .btn-submit,
  .btn-save,
  .btn-add-unit,
  .btn-navigate,
  .btn-card-action,
  .btn-comment-action,
  .annotation-toolbar button,
  .comment-card-actions button {
    min-height: 44px;
    min-width: 44px;
    font-size: 16px;
    padding: 12px;
  }
}
</style>