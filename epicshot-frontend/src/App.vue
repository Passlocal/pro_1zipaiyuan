<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  // Skip fetchUser on guest pages (login/register) to avoid 401 redirect loop
  console.log('[App] onMounted, path:', route.path, 'meta:', route.meta)
  if (route.meta.guest) {
    console.log('[App] guest page, skipping fetchUser')
    return
  }
  console.log('[App] calling fetchUser')
  await auth.fetchUser()
})
</script>