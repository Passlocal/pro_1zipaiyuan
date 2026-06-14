<template>
  <div class="upload-zone" :class="{ 'is-dragover': isDragover, 'is-disabled': disabled }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="triggerInput">
    <input ref="inputRef" type="file" :accept="accept" :multiple="multiple" class="upload-input"
      @change="onFileChange" />
    <div class="upload-content">
      <span class="upload-icon">📁</span>
      <p class="upload-hint"><slot>{{ hint }}</slot></p>
      <p class="upload-subhint" v-if="subHint">{{ subHint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  accept?: string
  multiple?: boolean
  disabled?: boolean
  hint?: string
  subHint?: string
}>(), {
  accept: 'image/jpeg,image/png,image/tiff,image/webp,video/mp4,video/quicktime',
  multiple: true,
  disabled: false,
  hint: '拖拽文件到此处，或点击上传',
  subHint: '支持 JPG / PNG / TIFF / WebP / MP4 / MOV，单次最多200张'
})

const emit = defineEmits<{
  files: [files: File[]]
}>()

const isDragover = ref(false)
const inputRef = ref<HTMLInputElement>()

function triggerInput() {
  if (!props.disabled) {
    inputRef.value?.click()
  }
}

function onDragOver() { isDragover.value = true }
function onDragLeave() { isDragover.value = false }

function onDrop(e: DragEvent) {
  isDragover.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) emit('files', files)
}

function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (files.length) emit('files', files)
  // Reset input so same file can be re-selected
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.upload-zone {
  border: 2px dashed $color-border;
  border-radius: $radius-lg;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  background: $color-bg;

  &:hover:not(.is-disabled) {
    border-color: $color-primary;
    background: rgba($color-primary, 0.03);
  }

  &.is-dragover {
    border-color: $color-primary;
    background: rgba($color-primary, 0.08);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 4px;
}

.upload-subhint {
  font-size: 12px;
  color: $color-text-muted;
}
</style>