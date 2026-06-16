<template>
  <div class="batch-filter">
    <div class="filter-bar">
      <div class="filter-input-wrap">
        <input
          v-model="query"
          class="filter-input"
          placeholder="输入筛选条件，如"背景不够白"、"去雾"…"
          @keyup.enter="doFilter"
        />
        <button class="btn-filter" :disabled="!query.trim() || loading" @click="doFilter">
          {{ loading ? '分析中...' : 'AI帮我选' }}
        </button>
      </div>

      <!-- 行话模板快捷入口 -->
      <div class="jargon-presets">
        <span class="jargon-label">常用模板：</span>
        <button
          v-for="t in jargonTemplates"
          :key="t.key"
          class="jargon-chip"
          :class="{ active: query === t.key }"
          @click="query = t.key; doFilter()"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- 结果区 -->
    <div v-if="result" class="filter-result">
      <div class="result-header">
        <span class="result-summary">
          筛选「{{ result.query }}」{{ result.matchedKeyword ? '（匹配行话模板）' : '' }}：
          共 {{ result.total }} 张图片，匹配 <strong>{{ result.matched.length }}</strong> 张
        </span>
        <button v-if="result.matched.length > 0" class="btn-select-all" @click="selectAllMatched">
          全选匹配结果
        </button>
      </div>

      <!-- AI 建议 -->
      <div v-if="result.suggestion" class="suggestion-box">
        <span class="suggestion-icon">💡</span>
        <span class="suggestion-text">{{ result.suggestion.description }}</span>
        <button class="btn-apply-suggestion" @click="applySuggestion">一键应用建议</button>
      </div>

      <!-- 匹配图片网格 -->
      <div v-if="result.matched.length > 0" class="image-grid">
        <div
          v-for="img in result.matched"
          :key="img.id"
          class="image-item"
          :class="{ selected: selectedIds.has(img.id) }"
          @click="toggleSelect(img.id)"
        >
          <div class="image-check">
            <span v-if="selectedIds.has(img.id)" class="check-mark">✓</span>
          </div>
          <img :src="img.thumbnailUrl" :alt="img.filename" class="image-thumb" />
          <span class="image-name">{{ img.filename }}</span>
        </div>
      </div>

      <div v-else class="empty-result">
        <span>未找到匹配的图片</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { projectApi } from '@/api/projects'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'select', ids: string[]): void; (e: 'apply-suggestion', suggestion: any): void }>()

const query = ref('')
const loading = ref(false)
const result = ref<any>(null)
const selectedIds = ref(new Set<string>())
const jargonTemplates = ref<{ key: string; label: string; description: string }[]>([])

async function doFilter() {
  if (!query.value.trim()) return
  loading.value = true
  selectedIds.value = new Set()
  try {
    const res = await projectApi.filterImages(props.projectId, query.value.trim())
    result.value = res.data.data
  } catch (e) {
    console.error('[BatchFilter] filter failed', e)
  } finally {
    loading.value = false
  }
}

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function selectAllMatched() {
  if (result.value) {
    selectedIds.value = new Set(result.value.matched.map((m: any) => m.id))
    emit('select', Array.from(selectedIds.value))
  }
}

function applySuggestion() {
  if (result.value?.suggestion) {
    emit('apply-suggestion', result.value.suggestion)
  }
}

onMounted(async () => {
  try {
    const res = await projectApi.getJargonTemplates()
    jargonTemplates.value = res.data.data
  } catch { /* ignore */ }
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.batch-filter {
  padding: 16px 0;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-input-wrap {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder { color: $color-text-muted; }
  &:focus { border-color: $color-primary; }
}

.btn-filter {
  padding: 10px 20px;
  background: $color-primary;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  white-space: nowrap;
  transition: background 0.2s;

  &:hover:not(:disabled) { background: $color-primary-dark; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.jargon-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.jargon-label {
  font-size: 12px;
  color: $color-text-muted;
  margin-right: 4px;
}

.jargon-chip {
  padding: 4px 12px;
  font-size: 12px;
  color: $color-text-secondary;
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: 16px;
  transition: all 0.15s;

  &:hover { border-color: $color-primary; color: $color-primary; }
  &.active { background: rgba($color-primary, 0.1); border-color: $color-primary; color: $color-primary; }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-summary {
  font-size: 14px;
  color: $color-text-secondary;

  strong { color: $color-text; }
}

.btn-select-all {
  padding: 6px 14px;
  font-size: 12px;
  color: $color-primary;
  border: 1px solid $color-primary;
  border-radius: $radius-sm;
  transition: all 0.15s;

  &:hover { background: rgba($color-primary, 0.08); }
}

.suggestion-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba($color-primary, 0.06);
  border: 1px solid rgba($color-primary, 0.15);
  border-radius: $radius-md;
  margin-bottom: 14px;
}

.suggestion-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.suggestion-text {
  flex: 1;
  font-size: 13px;
  color: $color-text;
}

.btn-apply-suggestion {
  padding: 5px 14px;
  font-size: 12px;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-sm;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover { background: $color-primary-dark; }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.image-item {
  position: relative;
  border: 2px solid $color-border-light;
  border-radius: $radius-md;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;

  &.selected { border-color: $color-primary; }
  &:hover { border-color: $color-primary; }
}

.image-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: $color-surface;
  border: 2px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  font-size: 12px;
  color: $color-primary;

  .selected & {
    background: $color-primary;
    border-color: $color-primary;
    color: #fff;
  }
}

.image-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.image-name {
  display: block;
  padding: 4px 8px;
  font-size: 11px;
  color: $color-text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-result {
  padding: 40px 0;
  text-align: center;
  color: $color-text-muted;
  font-size: 14px;
}
</style>