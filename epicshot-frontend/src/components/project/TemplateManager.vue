<template>
  <div class="template-manager">
    <h3>项目模板</h3>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="templates.length === 0" class="empty">暂无模板</div>
    <div v-else class="template-grid">
      <div v-for="t in templates" :key="t.id" class="template-card">
        <div class="template-name">{{ t.name }}</div>
        <div class="template-meta">{{ t.units?.length || 0 }} 个产品单元</div>
        <div class="template-actions">
          <button class="btn-preview" @click="previewTemplate(t)">预览</button>
          <button class="btn-copy" @click="copyTemplate(t)">复制</button>
          <button class="btn-use" @click="$emit('use', t)">使用</button>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewTarget" class="modal-overlay" @click.self="previewTarget = null">
      <div class="modal-content">
        <h3>模板预览: {{ previewTarget.name }}</h3>
        <div class="preview-detail">
          <p><strong>产品单元结构:</strong></p>
          <ul v-if="previewTarget.units?.length">
            <li v-for="(u, i) in previewTarget.units" :key="i">{{ unitLabel(u, i) }}</li>
          </ul>
          <p v-else>无预设单元</p>
          <p v-if="previewTarget.structure"><strong>配置:</strong> {{ JSON.stringify(previewTarget.structure) }}</p>
        </div>
        <button class="btn-close" @click="previewTarget = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import client from '@/api/client'

defineEmits<{ (e: 'use', template: any): void }>()

const templates = ref<any[]>([])
const loading = ref(true)
const previewTarget = ref<any>(null)

function unitLabel(u: any, i: number | string): string {
  return u.name || `单元 ${Number(i) + 1}`
}

async function previewTemplate(t: any) {
  try {
    const res = await client.get('/templates/' + t.id + '/preview')
    previewTarget.value = res.data.data
  } catch {
    previewTarget.value = t
  }
}

async function copyTemplate(t: any) {
  try {
    await client.post('/templates/' + t.id + '/copy')
    await loadTemplates()
  } catch (e) {
    console.error('copy template failed', e)
  }
}

async function loadTemplates() {
  try {
    const res = await client.get('/templates')
    templates.value = res.data.data || []
  } catch {
    templates.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTemplates)
</script>

<style scoped>
.template-manager { padding: 16px; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.template-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; }
.template-name { font-weight: 600; margin-bottom: 4px; }
.template-meta { font-size: 12px; color: #888; margin-bottom: 8px; }
.template-actions { display: flex; gap: 6px; }
.template-actions button { padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-preview:hover { background: #f0f0f0; }
.btn-copy:hover { background: #e8f0fe; }
.btn-use { background: #4a90d9 !important; color: #fff !important; border-color: #4a90d9 !important; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
.preview-detail { margin: 16px 0; }
.preview-detail ul { padding-left: 20px; }
.btn-close { padding: 8px 20px; border-radius: 6px; background: #f0f0f0; border: none; cursor: pointer; }
</style>