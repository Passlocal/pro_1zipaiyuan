import client from './client'
import type { ApiResponse } from '@/types/api'
import type { Annotation, AnnotationCreateParams, CommentCard, Revision } from '@/types/models'

export const annotationApi = {
  // 标注 CRUD
  create: (imageId: string, data: AnnotationCreateParams) =>
    client.post<ApiResponse<Annotation>>(`/images/${imageId}/annotations`, data),

  getByImage: (imageId: string) =>
    client.get<ApiResponse<Annotation[]>>(`/images/${imageId}/annotations`),

  update: (id: string, data: Partial<AnnotationCreateParams>) =>
    client.put<ApiResponse<Annotation>>(`/annotations/${id}`, data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/annotations/${id}`),

  // 意见卡片
  createCard: (annotationId: string, imageId: string, text?: string) =>
    client.post<ApiResponse<CommentCard>>('/comment-cards', { annotationId, imageId, text }),

  updateCardText: (id: string, text: string) =>
    client.put<ApiResponse<CommentCard>>(`/comment-cards/${id}`, { text }),

  updateCardStatus: (id: string, action: 'resolve' | 'reject') =>
    client.put<ApiResponse<CommentCard>>(`/comment-cards/${id}/status`, { action }),

  getCardsByImage: (imageId: string) =>
    client.get<ApiResponse<CommentCard[]>>(`/images/${imageId}/comment-cards`),

  updateSortOrder: (ids: string[]) =>
    client.put<ApiResponse<void>>('/comment-cards/sort', { ids }),

  // 成片上传
  uploadRevision: (imageId: string, file: File, commentCardId?: string) => {
    const formData = new FormData()
    formData.append('image', file)
    if (commentCardId) formData.append('commentCardId', commentCardId)
    return client.post<ApiResponse<Revision>>(`/images/${imageId}/revision`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // 导出意见
  exportComments: (projectId: string, format: 'pdf' | 'excel') =>
    client.get(`/projects/${projectId}/comments/export`, {
      params: { format },
      responseType: 'blob'
    })
}