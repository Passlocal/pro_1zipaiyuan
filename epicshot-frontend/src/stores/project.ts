import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectApi } from '@/api/projects'
import type { Project, ProjectStatus, ProductUnit, ImageMedia, TimelineNode, ShareExpiry } from '@/types/models'
import { mockProjects, mockProductUnits, mockImages, mockTimeline, mockColorCheckReport } from '@/utils/mockData'

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
    } catch {
      // Fall back to mock data when no backend
      if (!(import.meta.env.VITE_API_URL as string)) {
        projects.value = mockProjects()
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id: string) {
    loading.value = true
    try {
      const res = await projectApi.getDetail(id)
      currentProject.value = res.data.data
    } catch {
      if (!(import.meta.env.VITE_API_URL as string)) {
        const all = mockProjects()
        currentProject.value = all.find(p => p.id === id) || all[0]
      }
    } finally {
      loading.value = false
    }
  }

  async function createProject(data: { name: string; clientName?: string }, files?: File[]) {
    const res = await projectApi.create(data, files)
    projects.value.unshift(res.data.data)
    return res.data.data
  }

  function updateProjectStatus(id: string, status: ProjectStatus) {
    return projectApi.update(id, { status })
  }

  async function fetchProductUnits(projectId: string) {
    try {
      const res = await projectApi.getProductUnits(projectId)
      productUnits.value = res.data.data
    } catch {
      if (!(import.meta.env.VITE_API_URL as string)) {
        productUnits.value = mockProductUnits(projectId)
      }
    }
  }

  async function fetchImages(unitId: string) {
    try {
      const res = await projectApi.getImages(unitId)
      currentImages.value = res.data.data
    } catch {
      if (!(import.meta.env.VITE_API_URL as string)) {
        currentImages.value = mockImages(unitId)
      }
    }
  }

  async function generateShare(projectId: string, expiry: ShareExpiry) {
    return projectApi.generateShare(projectId, expiry)
  }

  async function fetchTimeline(projectId: string) {
    try {
      const res = await projectApi.getTimeline(projectId)
      timeline.value = res.data.data
    } catch {
      if (!(import.meta.env.VITE_API_URL as string)) {
        timeline.value = mockTimeline(projectId)
      }
    }
  }

  function setCurrentImage(image: ImageMedia | null) {
    currentImage.value = image
  }

  function getMockColorCheckReport() {
    return mockColorCheckReport()
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
    fetchImages,
    generateShare,
    fetchTimeline,
    setCurrentImage,
    getMockColorCheckReport
  }
})