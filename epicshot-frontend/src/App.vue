<template>
  <Toast ref="globalToast" />
  <router-view />
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import Toast from '@/components/common/Toast.vue'

const auth = useAuthStore()
const route = useRoute()
const globalToast = ref<InstanceType<typeof Toast> | null>(null)

function toast() {
  return globalToast.value!
}
provide('globalToast', toast)

onMounted(async () => {
  if (route.meta.guest) return
  try {
    await auth.fetchUser()
  } catch {
    // Token expired or network error — router guard will redirect to /login
  }
})
</script>