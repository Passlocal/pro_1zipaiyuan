import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectApi } from '@/api/projects'
import type { Project, ProjectStatus, ProductUnit, ImageMedia, TimelineNode, ShareExpiry } from '@/types/models'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const productUnits = ref<ProductUnit[]>([])
  const currentImages = ref<ImageMedia[]>([])
  const currentImage = ref<ImageMedia | null>(null)
  const timeline = ref<TimelineNode[]>([])
  const loading = ref(false)

  async function fetchProjects(params?: { status?: string; search?: string }) {
    loading.value = true
    try {
      const res = await projectApi.getList(params)
      projects.value = res.data.data
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id: string) {
    loading.value = true
    try {
      const res = await projectApi.getDetail(id)
      currentProject.value = res.data.data
    } finally {
      loading.value = false
    }
  }

  async function createProject(data: { name: string; clientName?: string }, files?: File[]) {
    const res = await projectApi.create(data, files)
    projects.value.unshift(res.data.data)
    return res.data.data
  }

  async function updateProjectStatus(id: string, status: ProjectStatus) {
    const res = await projectApi.update(id, { status })
    if (currentProject.value && currentProject.value.id === id) {
      currentProject.value.status = status
    }
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value[idx] = { ...projects.value[idx], status }
    return res
  }

  async function fetchProductUnits(projectId: string) {
    const res = await projectApi.getProductUnits(projectId)
    productUnits.value = res.data.data
  }

  async function createProductUnit(projectId: string, name: string) {
    const res = await projectApi.createProductUnit(projectId, name)
    // Refresh units list
    await fetchProductUnits(projectId)
    return res.data.data
  }

  async function fetchImages(unitId: string) {
    const res = await projectApi.getImages(unitId)
    currentImages.value = res.data.data
  }

  async function generateShare(projectId: string, expiry: ShareExpiry) {
    return projectApi.generateShare(projectId, expiry)
  }

  async function fetchTimeline(projectId: string) {
    const res = await projectApi.getTimeline(projectId)
    timeline.value = res.data.data
  }

  function setCurrentImage(image: ImageMedia | null) {
    currentImage.value = image
  }

  const projectName = computed(() => (currentProject.value as any)?.name || currentProject.value?.clientName || '')

  return {
    projects,
    currentProject,
    productUnits,
    currentImages,
    currentImage,
    timeline,
    loading,
    projectName,
    fetchProjects,
    fetchProject,
    createProject,
    updateProjectStatus,
    fetchProductUnits,
    createProductUnit,
    fetchImages,
    generateShare,
    fetchTimeline,
    setCurrentImage
  }
})