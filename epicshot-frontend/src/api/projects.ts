import client from './client'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { Project, ProjectCreateParams, ImageMedia, ProductUnit, ShareExpiry, TimelineNode, CommentCard } from '@/types/models'

export const projectApi = {
  getList: (params?: { status?: string; search?: string; page?: number }) =>
    client.get<PaginatedResponse<Project>>('/projects', { params }),

  batchThumbnails: (projectIds: string[]) =>
    client.post<ApiResponse<Record<string, string>>>('/projects/batch-thumbnails', { projectIds }),

  getDetail: (id: string) =>
    client.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: ProjectCreateParams) =>
    client.post<ApiResponse<Project>>('/projects', data),

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
    files.forEach((f) => formData.append('files', f))
    return client.post<ApiResponse<ImageMedia[]>>(`/units/${productUnitId}/images`, formData, {
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

  getByShareToken: (token: string) =>
    client.get<ApiResponse<{ project: Project; cards: CommentCard[] }>>(`/share/${token}`),

  submitCardReply: (cardId: string, reply: string) =>
    client.put<ApiResponse<void>>(`/comment-cards/${cardId}`, { text: reply }),

  // V1.1: 保护型确稿
  requestModification: (projectId: string, reason: string) =>
    client.post<ApiResponse<void>>(`/projects/${projectId}/modify-request`, { reason }),

  // V1.1: 智能批量筛选
  filterImages: (projectId: string, query: string) =>
    client.post<ApiResponse<any>>(`/projects/${projectId}/images/filter`, { query }),

  getJargonTemplates: () =>
    client.get<ApiResponse<any[]>>('/jargon-templates'),

  // V1.2.0: ZIP/PDF 导出
  exportZip: (projectId: string) =>
    client.get(`/projects/${projectId}/export-zip`, { responseType: 'blob' }),

  exportPdf: (projectId: string) =>
    client.get(`/projects/${projectId}/export-pdf`, { responseType: 'blob' }),
}