import client from './client'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { Project, ProjectCreateParams, ImageMedia, ProductUnit, ShareExpiry, TimelineNode } from '@/types/models'

export const projectApi = {
  getList: (params?: { status?: string; search?: string; page?: number }) =>
    client.get<PaginatedResponse<Project>>('/projects', { params }),

  getDetail: (id: string) =>
    client.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: ProjectCreateParams, files?: File[]) => {
    const formData = new FormData()
    formData.append('data', JSON.stringify(data))
    if (files) {
      files.forEach((f) => formData.append('images', f))
    }
    return client.post<ApiResponse<Project>>('/projects', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  update: (id: string, data: Partial<Project>) =>
    client.put<ApiResponse<Project>>(`/projects/${id}`, data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/projects/${id}`),

  generateShare: (id: string, expiry: ShareExpiry) =>
    client.post<ApiResponse<{ token: string; url: string }>>(`/projects/${id}/share`, { expiry }),

  revokeShare: (id: string) =>
    client.delete<ApiResponse<void>>(`/projects/${id}/share`),

  getProductUnits: (projectId: string) =>
    client.get<ApiResponse<ProductUnit[]>>(`/projects/${projectId}/units`),

  createProductUnit: (projectId: string, name: string) =>
    client.post<ApiResponse<ProductUnit>>(`/projects/${projectId}/units`, { name }),

  reorderUnits: (projectId: string, ids: string[]) =>
    client.put<ApiResponse<void>>(`/projects/${projectId}/units/reorder`, { ids }),

  getImages: (productUnitId: string) =>
    client.get<ApiResponse<ImageMedia[]>>(`/units/${productUnitId}/images`),

  uploadImages: (productUnitId: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('images', f))
    return client.post<ApiResponse<{ taskId: string }>>(`/units/${productUnitId}/images/batch`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getImageDownloadUrl: (imageId: string) =>
    client.get<ApiResponse<{ url: string; expiresAt: string }>>(`/images/${imageId}/download`, {
      params: { size: 'original' }
    }),

  completeProject: (id: string) =>
    client.post<ApiResponse<void>>(`/projects/${id}/complete`),

  getTimeline: (projectId: string) =>
    client.get<ApiResponse<TimelineNode[]>>(`/projects/${projectId}/timeline`),

  getClientProjects: () =>
    client.get<PaginatedResponse<Project>>('/client/me/projects'),
}