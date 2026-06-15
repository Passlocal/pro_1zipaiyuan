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
import type { User } from '@/types/models'

const authStore = useAuthStore()

const logoInputRef = ref<HTMLInputElement | null>(null)
const workspaceName = ref('')
const logoPreview = ref('')
const saving = ref(false)

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

function maskSecret(secret: string): string {
  return '********'
}

onMounted(() => {
  if (authStore.workspace) {
    workspaceName.value = authStore.workspace.name
    logoPreview.value = authStore.workspace.logoUrl || ''
  }
  loadMembers()
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
</style>