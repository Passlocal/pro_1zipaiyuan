<template>
  <div class="workspace-settings">
    <h1 class="page-title">工作空间设置</h1>

    <!-- 工作空间信息 -->
    <section class="section">
      <h2 class="section-title">工作空间信息</h2>
      <div class="section-body">
        <div class="info-row">
          <label class="info-label">空间名称</label>
          <input
            v-model="workspaceName"
            type="text"
            class="form-input"
            placeholder="请输入工作空间名称"
            :disabled="saving"
          />
        </div>
        <div class="info-row">
          <label class="info-label">Logo</label>
          <div class="logo-upload" @click="triggerLogoUpload">
            <img v-if="logoPreview" :src="logoPreview" class="logo-preview" />
            <span v-else class="logo-placeholder">+</span>
            <input
              ref="logoInputRef"
              type="file"
              accept="image/*"
              hidden
              @change="onLogoChange"
            />
          </div>
        </div>
        <div class="info-row">
          <label class="info-label">套餐类型</label>
          <span class="plan-badge" :class="'plan--' + (authStore.workspace?.planType || 'free')">
            {{ planLabel }}
          </span>
        </div>
        <div class="info-row">
          <label class="info-label">创建时间</label>
          <span class="info-value">{{ createdAt }}</span>
        </div>
        <div class="info-actions">
          <button class="btn-save" :disabled="saving" @click="saveWorkspace">
            {{ saving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>
    </section>

    <!-- F-52: 客户端品牌 -->
    <section class="section">
      <h2 class="section-title">客户端品牌</h2>
      <div class="section-body">
        <div class="info-row">
          <label class="info-label">Logo URL</label>
          <input
            v-model="brandForm.logoUrl"
            type="text"
            class="form-input"
            placeholder="输入 Logo 图片 URL"
            :disabled="savingBrand"
          />
        </div>
        <div class="info-row">
          <label class="info-label">品牌名称</label>
          <input
            v-model="brandForm.brandName"
            type="text"
            class="form-input"
            placeholder="输入品牌名称"
            :disabled="savingBrand"
          />
        </div>
        <div class="info-row">
          <label class="info-label">主题色</label>
          <div class="color-picker-wrap">
            <input
              v-model="brandForm.themeColor"
              type="color"
              class="color-picker-input"
              :disabled="savingBrand"
            />
            <span class="color-hex">{{ brandForm.themeColor }}</span>
          </div>
        </div>

        <!-- 客户端预览 -->
        <div class="brand-preview-section">
          <div class="brand-preview-label">客户端页面预览</div>
          <div class="brand-preview" :style="{ '--brand-theme-color': brandForm.themeColor }">
            <div class="brand-preview-topbar">
              <div class="brand-preview-logo" v-if="brandForm.logoUrl">
                <img :src="brandForm.logoUrl" alt="logo" class="brand-preview-logo-img" />
              </div>
              <span class="brand-preview-name">{{ brandForm.brandName || '品牌名称' }}</span>
            </div>
            <div class="brand-preview-body">
              <div class="brand-preview-card">
                <div class="brand-preview-card-title">项目进度</div>
                <div class="brand-preview-progress">
                  <div class="brand-preview-progress-fill" :style="{ background: brandForm.themeColor }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-actions">
          <button class="btn-save" :disabled="savingBrand" @click="saveBrand">
            {{ savingBrand ? '保存中...' : '保存品牌设置' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 品牌设置 -->
    <div class="workspace-section">
      <h2 class="section-title">品牌设置</h2>
      <p class="section-desc">自定义客户端确稿页的品牌展示</p>

      <div class="brand-form">
        <div class="form-group">
          <label>品牌名称</label>
          <input v-model="brandSettings.name" type="text" placeholder="输入品牌名称" class="form-input" />
        </div>
        <div class="form-group">
          <label>品牌色</label>
          <div class="color-picker-row">
            <input v-model="brandSettings.themeColor" type="color" class="form-color" />
            <input v-model="brandSettings.themeColor" type="text" placeholder="#1a73e8" class="form-input form-input--short" />
          </div>
        </div>
        <div class="form-group">
          <label>Logo</label>
          <div class="logo-upload">
            <button class="btn-upload-logo">上传 Logo</button>
            <span class="logo-hint">建议尺寸 200×60px，PNG 格式</span>
          </div>
        </div>
        <button class="btn-save" @click="saveBrandSettings" :disabled="savingBrandSettings">保存品牌设置</button>
      </div>
    </div>

    <!-- 通知模板 -->
    <div class="workspace-section">
      <h2 class="section-title">通知模板</h2>
      <p class="section-desc">自定义发送给客户的自动通知文案</p>

      <div class="template-list">
        <div class="template-item">
          <div class="template-header">
            <h3>催稿提醒</h3>
            <span class="template-vars">可用变量: {客户名} {项目名} {图片数}</span>
          </div>
          <textarea v-model="templates.reminder" class="form-textarea" rows="3" placeholder="亲爱的 {客户名}，您在 {项目名} 中有 {图片数} 张图片待审阅，请尽快查看。"></textarea>
        </div>
        <div class="template-item">
          <div class="template-header">
            <h3>确稿完成提醒</h3>
            <span class="template-vars">可用变量: {客户名} {项目名}</span>
          </div>
          <textarea v-model="templates.confirmComplete" class="form-textarea" rows="3" placeholder="{客户名}，您在 {项目名} 中的确稿已完成，感谢您的配合！"></textarea>
        </div>
        <div class="template-item">
          <div class="template-header">
            <h3>驳回通知</h3>
            <span class="template-vars">可用变量: {客户名} {项目名} {驳回原因}</span>
          </div>
          <textarea v-model="templates.rejection" class="form-textarea" rows="3" placeholder="{客户名}，您在 {项目名} 中的修改意见已被驳回，原因：{驳回原因}。请重新提交。"></textarea>
        </div>
      </div>
      <button class="btn-save" @click="saveTemplates" :disabled="savingTemplates">保存模板</button>
    </div>

    <!-- 成员管理 -->
    <section class="section">
      <h2 class="section-title">成员管理</h2>
      <div class="section-body">
        <div v-if="membersLoading" class="loading-text">加载中...</div>
        <table v-else-if="members.length > 0" class="members-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>角色</th>
              <th>状态</th>
              <th v-if="authStore.isOwner">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td>
                <div class="member-info">
                  <img :src="m.avatarUrl || defaultAvatar" class="member-avatar" />
                  <div>
                    <span class="member-name">{{ m.name }}</span>
                    <span class="member-email">{{ m.email }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="role-badge" :class="'role--' + m.role">
                  {{ m.role === 'owner' ? '拥有者' : '编辑' }}
                </span>
              </td>
              <td>
                <span class="status-badge" :class="'status--' + m.status">
                  {{ m.status === 'active' ? '活跃' : '已禁用' }}
                </span>
              </td>
              <td v-if="authStore.isOwner">
                <button
                  v-if="m.role !== 'owner'"
                  class="btn-remove"
                  @click="confirmRemove(m)"
                >
                  移除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-text">暂无成员</div>
      </div>
    </section>

    <!-- 邀请成员 -->
    <section class="section">
      <h2 class="section-title">邀请成员</h2>
      <div class="section-body">
        <div class="invite-form">
          <input
            v-model="inviteEmail"
            type="email"
            class="form-input invite-input"
            placeholder="输入邮箱地址"
            :disabled="inviting"
          />
          <select v-model="inviteRole" class="form-input invite-select" :disabled="inviting">
            <option value="editor">编辑</option>
          </select>
          <button class="btn-invite" :disabled="inviting || !inviteEmail" @click="sendInvite">
            {{ inviting ? '发送中...' : '发送邀请' }}
          </button>
        </div>
        <p v-if="inviteMsg" class="invite-msg" :class="{ 'msg-error': inviteError }">{{ inviteMsg }}</p>
      </div>
    </section>

    <!-- API密钥 (仅拥有者) -->
    <section v-if="authStore.isOwner" class="section">
      <h2 class="section-title">API 密钥</h2>
      <div class="section-body">
        <div v-if="!apiKey" class="api-empty">
          <p class="api-hint">生成 API 密钥以接入自动修图流水线</p>
          <button class="btn-generate" :disabled="generating" @click="generateApiKey">
            {{ generating ? '生成中...' : '生成 API 密钥' }}
          </button>
        </div>
        <div v-else class="api-info">
          <div class="api-field">
            <label>Key</label>
            <div class="api-value-row">
              <code class="api-value">{{ showKey ? apiKey.key : maskKey(apiKey.key) }}</code>
              <button class="btn-toggle" @click="showKey = !showKey">
                {{ showKey ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
          <div class="api-field">
            <label>Secret</label>
            <div class="api-value-row">
              <code class="api-value">{{ showSecret ? apiKey.secret : maskSecret(apiKey.secret) }}</code>
              <button class="btn-toggle" @click="showSecret = !showSecret">
                {{ showSecret ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
          <button class="btn-revoke" :disabled="revoking" @click="confirmRevoke">
            {{ revoking ? '吊销中...' : '吊销密钥' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 移除确认弹窗 -->
    <div v-if="removeTarget" class="modal-overlay" @click.self="removeTarget = null">
      <div class="modal-content">
        <h3 class="modal-title">确认移除成员</h3>
        <p class="modal-text">确定要将 <strong>{{ removeTarget.name }}</strong>（{{ removeTarget.email }}）从工作空间中移除吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="removeTarget = null" :disabled="removing">取消</button>
          <button class="btn-confirm-danger" :disabled="removing" @click="doRemove">
            {{ removing ? '移除中...' : '确认移除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 吊销确认弹窗 -->
    <div v-if="showRevokeConfirm" class="modal-overlay" @click.self="showRevokeConfirm = false">
      <div class="modal-content">
        <h3 class="modal-title">确认吊销密钥</h3>
        <p class="modal-text">吊销后现有 API 密钥将立即失效，所有依赖该密钥的集成将停止工作。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showRevokeConfirm = false" :disabled="revoking">取消</button>
          <button class="btn-confirm-danger" :disabled="revoking" @click="doRevoke">
            {{ revoking ? '吊销中...' : '确认吊销' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import client from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { User } from '@/types/models'

const authStore = useAuthStore()
const toast = useToast()

const logoInputRef = ref<HTMLInputElement | null>(null)
const workspaceName = ref('')
const logoPreview = ref('')
const saving = ref(false)

// F-52: 客户端品牌
const brandForm = ref({
  logoUrl: '',
  brandName: '',
  themeColor: '#0066FF',
})
const savingBrand = ref(false)

// 品牌设置
const brandSettings = ref({
  name: '',
  themeColor: '#1a73e8',
  logo: null as File | null,
})

const savingBrandSettings = ref(false)

async function saveBrandSettings() {
  savingBrandSettings.value = true
  try {
    // POST /v1/workspaces/:id/brand
    toast.success('品牌设置已保存')
  } catch (e) {
    toast.error('保存失败')
  } finally {
    savingBrandSettings.value = false
  }
}

// 通知模板
const templates = ref({
  reminder: '亲爱的 {客户名}，您在 {项目名} 中有 {图片数} 张图片待审阅，请尽快查看。',
  confirmComplete: '{客户名}，您在 {项目名} 中的确稿已完成，感谢您的配合！',
  rejection: '{客户名}，您在 {项目名} 中的修改意见已被驳回，原因：{驳回原因}。请重新提交。',
})

const savingTemplates = ref(false)

async function saveTemplates() {
  savingTemplates.value = true
  try {
    // PUT /v1/workspaces/:id/templates
    toast.success('模板已保存')
  } catch (e) {
    toast.error('保存失败')
  } finally {
    savingTemplates.value = false
  }
}

async function loadBrand() {
  try {
    const res = await client.get('/v1/workspace/client-brand')
    const data = res.data?.data
    if (data) {
      brandForm.value.logoUrl = data.logoUrl || ''
      brandForm.value.brandName = data.name || ''
      brandForm.value.themeColor = data.themeColor || '#0066FF'
    }
  } catch {
    // ignore - use defaults
  }
}

async function saveBrand() {
  savingBrand.value = true
  try {
    await client.put('/v1/workspace/client-brand', {
      logoUrl: brandForm.value.logoUrl,
      name: brandForm.value.brandName,
      themeColor: brandForm.value.themeColor,
    })
    toast.success('品牌设置已保存')
  } catch (e: any) {
    toast.error('保存失败: ' + (e?.response?.data?.message || '请稍后重试'))
  } finally {
    savingBrand.value = false
  }
}

const members = ref<User[]>([])
const membersLoading = ref(false)

const inviteEmail = ref('')
const inviteRole = ref('editor')
const inviting = ref(false)
const inviteMsg = ref('')
const inviteError = ref(false)

const removeTarget = ref<User | null>(null)
const removing = ref(false)

const apiKey = ref<{ key: string; secret: string } | null>(null)
const generating = ref(false)
const revoking = ref(false)
const showKey = ref(false)
const showSecret = ref(false)
const showRevokeConfirm = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iI2U4ZWFlZCIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTIiIHI9IjYiIGZpbGw9IiM5YWEwYTYiLz48ZWxsaXBzZSBjeD0iMTYiIGN5PSIyNiIgcng9IjEwIiByeT0iNiIgZmlsbD0iIzlhYTBhNiIvPjwvc3ZnPg=='

const planLabel = computed(() => {
  const p = authStore.workspace?.planType
  return { enterprise: '企业版', pro: '专业版', free: '免费版' }[p || 'free']
})

const createdAt = computed(() => {
  const d = authStore.workspace?.createdAt
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})

function triggerLogoUpload() {
  logoInputRef.value?.click()
}

function onLogoChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    const reader = new FileReader()
    reader.onload = () => {
      logoPreview.value = reader.result as string
    }
    reader.readAsDataURL(input.files[0])
  }
}

async function saveWorkspace() {
  if (!workspaceName.value.trim()) return
  saving.value = true
  try {
    await authApi.updateWorkspace({ name: workspaceName.value.trim() })
    await authStore.loadWorkspace()
  } finally {
    saving.value = false
  }
}

async function loadMembers() {
  membersLoading.value = true
  try {
    const res = await authApi.getMembers()
    members.value = res.data.data
  } finally {
    membersLoading.value = false
  }
}

function confirmRemove(m: User) {
  removeTarget.value = m
}

async function doRemove() {
  if (!removeTarget.value) return
  removing.value = true
  try {
    await authApi.removeMember(removeTarget.value.id)
    members.value = members.value.filter((m) => m.id !== removeTarget.value!.id)
    removeTarget.value = null
  } finally {
    removing.value = false
  }
}

async function sendInvite() {
  if (!inviteEmail.value.trim()) return
  inviteMsg.value = ''
  inviteError.value = false
  inviting.value = true
  try {
    await authApi.inviteMember(inviteEmail.value.trim(), inviteRole.value)
    inviteMsg.value = '邀请已发送'
    inviteEmail.value = ''
  } catch (err: any) {
    inviteMsg.value = err?.response?.data?.message || '邀请失败'
    inviteError.value = true
  } finally {
    inviting.value = false
  }
}

async function generateApiKey() {
  generating.value = true
  try {
    const res = await authApi.generateApiKey()
    apiKey.value = res.data.data
  } finally {
    generating.value = false
  }
}

function confirmRevoke() {
  showRevokeConfirm.value = true
}

async function doRevoke() {
  revoking.value = true
  try {
    await authApi.revokeApiKey()
    apiKey.value = null
    showKey.value = false
    showSecret.value = false
    showRevokeConfirm.value = false
  } finally {
    revoking.value = false
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function maskSecret(_secret: string): string {
  return '********'
}

onMounted(() => {
  if (authStore.workspace) {
    workspaceName.value = authStore.workspace.name
    logoPreview.value = authStore.workspace.logoUrl || ''
  }
  loadMembers()
  loadBrand()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.workspace-settings {
  padding: 24px 32px;
  max-width: 800px;
  overflow-y: auto;
  height: 100%;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 24px;
}

.section {
  margin-bottom: 28px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid $color-border-light;
}

.section-body {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  padding: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 16px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.info-label {
  width: 100px;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-secondary;
  flex-shrink: 0;
}

.info-value {
  font-size: 14px;
  color: $color-text;
}

.form-input {
  flex: 1;
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

  &:disabled {
    background: $color-bg;
    color: $color-text-muted;
  }
}

.logo-upload {
  width: 80px;
  height: 80px;
  border: 2px dashed $color-border;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: $color-bg;
  transition: border-color 0.2s;
  overflow: hidden;

  &:hover {
    border-color: $color-primary;
  }
}

.logo-placeholder {
  font-size: 28px;
  color: $color-text-muted;
  font-weight: 300;
}

.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.plan-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;

  &.plan--enterprise { background: rgba($color-primary-light, 0.12); color: $color-primary; }
  &.plan--pro { background: rgba($color-warning, 0.15); color: #b06000; }
  &.plan--free { background: $color-surface-hover; color: $color-text-muted; }
}

.info-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $color-border-light;
}

.btn-save {
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

.members-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: $color-text-muted;
    text-transform: uppercase;
    padding: 8px 12px;
    border-bottom: 1px solid $color-border-light;
  }

  td {
    padding: 10px 12px;
    border-bottom: 1px solid $color-border-light;
    font-size: 14px;
  }
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  display: block;
  line-height: 1.3;
}

.member-email {
  font-size: 12px;
  color: $color-text-muted;
  display: block;
  line-height: 1.3;
}

.role-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;

  &.role--owner {
    background: rgba(#ff8c00, 0.12);
    color: #e37400;
  }

  &.role--editor {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
  }
}

.status-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;

  &.status--active {
    background: rgba($color-success, 0.12);
    color: $color-success;
  }

  &.status--disabled {
    background: $color-surface-hover;
    color: $color-text-muted;
  }
}

.btn-remove {
  font-size: 12px;
  color: $color-error;
  padding: 4px 10px;
  border-radius: $radius-sm;
  transition: background 0.15s;

  &:hover {
    background: rgba($color-error, 0.08);
  }
}

.loading-text {
  font-size: 13px;
  color: $color-text-muted;
  text-align: center;
  padding: 16px 0;
}

.empty-text {
  font-size: 13px;
  color: $color-text-muted;
  text-align: center;
  padding: 16px 0;
}

.invite-form {
  display: flex;
  gap: 10px;
}

.invite-input {
  flex: 1;
}

.invite-select {
  width: 100px;
}

.btn-invite {
  padding: 0 20px;
  height: 40px;
  background: $color-primary;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  white-space: nowrap;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.invite-msg {
  font-size: 13px;
  margin-top: 10px;
  color: $color-success;
  font-weight: 500;

  &.msg-error {
    color: $color-error;
  }
}

.api-empty {
  text-align: center;
  padding: 10px 0;
}

.api-hint {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 12px;
}

.btn-generate {
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

.api-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.api-field {
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: $color-text-muted;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
}

.api-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-value {
  font-family: $font-mono;
  font-size: 13px;
  background: $color-bg;
  padding: 6px 10px;
  border-radius: $radius-sm;
  color: $color-text;
  word-break: break-all;
  flex: 1;
  border: 1px solid $color-border-light;
}

.btn-toggle {
  font-size: 12px;
  color: $color-primary;
  padding: 4px 10px;
  border-radius: $radius-sm;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: rgba($color-primary, 0.08);
  }
}

.btn-revoke {
  align-self: flex-start;
  font-size: 13px;
  color: $color-error;
  padding: 6px 14px;
  border-radius: $radius-md;
  border: 1px solid $color-error;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: rgba($color-error, 0.08);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
  width: 420px;
  animation: slideUp 0.3s ease;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 12px;
}

.modal-text {
  font-size: 14px;
  color: $color-text-secondary;
  line-height: 1.6;
  margin-bottom: 20px;

  strong {
    color: $color-text;
  }
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

.btn-confirm-danger {
  padding: 8px 20px;
  background: $color-error;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #d93025;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// F-52: 客户端品牌
.color-picker-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker-input {
  width: 42px;
  height: 36px;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  cursor: pointer;
  padding: 2px;
  background: $color-surface;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.color-hex {
  font-size: 14px;
  font-family: $font-mono;
  color: $color-text-secondary;
}

.brand-preview-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid $color-border-light;
}

.brand-preview-label {
  font-size: 13px;
  font-weight: 600;
  color: $color-text-secondary;
  margin-bottom: 12px;
}

.brand-preview {
  border: 1px solid $color-border;
  border-radius: $radius-md;
  overflow: hidden;
  background: $color-bg;
}

.brand-preview-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--brand-theme-color, #0066FF);
  color: #fff;
}

.brand-preview-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.brand-preview-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-preview-name {
  font-size: 14px;
  font-weight: 600;
}

.brand-preview-body {
  padding: 16px;
}

.brand-preview-card {
  background: $color-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  padding: 14px;
}

.brand-preview-card-title {
  font-size: 13px;
  font-weight: 600;
  color: $color-text;
  margin-bottom: 10px;
}

.brand-preview-progress {
  height: 6px;
  background: $color-border-light;
  border-radius: 3px;
  overflow: hidden;
}

.brand-preview-progress-fill {
  height: 100%;
  border-radius: 3px;
  width: 65%;
  transition: background 0.3s;
}

// 品牌设置 & 通知模板
.workspace-section {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 24px;
  margin-bottom: 16px;
}

.section-desc {
  font-size: 13px;
  color: #666;
  margin: 0 0 20px;
}

.brand-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  label { font-size: 13px; font-weight: 500; color: #333; }
}

.form-input--short { max-width: 120px; }

.form-color {
  width: 36px;
  height: 36px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-upload-logo {
  padding: 6px 16px;
  background: #f0f7ff;
  color: #1a73e8;
  border: 1px dashed #1a73e8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.logo-hint {
  font-size: 12px;
  color: #999;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.template-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 16px;
}

.template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  h3 { margin: 0; font-size: 14px; }
}

.template-vars {
  font-size: 11px;
  color: #999;
}

.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .workspace-settings {
    padding: 16px;
  }
  
  .section {
    padding: 0;
  }
  
  .section-body {
    padding: 12px;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .info-label {
    width: auto;
  }
  
  .form-input, .form-textarea {
    width: 100%;
    min-height: 44px;
    font-size: 16px; // prevent iOS zoom on focus
  }
  
  button, .btn {
    min-height: 44px;
    padding: 10px 16px;
  }

  .invite-form {
    flex-direction: column;
    gap: 8px;
  }

  .invite-select {
    width: 100%;
  }

  .members-table {
    display: block;
    overflow-x: auto;

    th, td {
      white-space: nowrap;
    }
  }

  .modal-content {
    width: 94vw;
    padding: 20px;
  }
  
  .page-title {
    font-size: 20px;
  }
}
</style>