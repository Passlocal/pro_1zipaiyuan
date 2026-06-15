import client from './client'
import type { ApiResponse } from '@/types/api'
import type { AIStyle, AIStyleTask, AIInstruction, ColorCheckReport, Portfolio, PortfolioImage } from '@/types/models'

export const aiApi = {
  generateSamples: (imageId: string, style: AIStyle, seedCount = 4) =>
    client.post<ApiResponse<{ taskId: string }>>('/ai/style-samples', { imageId, style, seedCount }),

  getSampleTask: (taskId: string) =>
    client.get<ApiResponse<AIStyleTask>>(`/ai/style-samples/${taskId}`),

  likeSample: (sampleId: string, index: number, liked: boolean) =>
    client.post<ApiResponse<void>>(`/ai/style-samples/${sampleId}/like`, { index, liked }),

  parseInstruction: (commentCardId: string) =>
    client.post<ApiResponse<AIInstruction>>('/ai/parse-instruction', { commentCardId }),

  feedbackInstruction: (instructionId: string, helpful: boolean) =>
    client.post<ApiResponse<void>>(`/ai/instructions/${instructionId}/feedback`, { helpful }),

  confirmParams: (instructionId: string, params: Record<string, number>) =>
    client.put<ApiResponse<AIInstruction>>(`/ai/instructions/${instructionId}/params`, { params }),

  runColorCheck: (projectId: string) =>
    client.post<ApiResponse<{ taskId: string }>>('/ai/color-check', { projectId }),

  getColorCheckResult: (taskId: string) =>
    client.get<ApiResponse<ColorCheckReport>>(`/ai/color-check/${taskId}`),
}

export const importApi = {
  parseCloudDrive: (provider?: string, path?: string) =>
    client.post<ApiResponse<{ files: { name: string; path: string; size: number; type: string }[] }>>('/import/cloud-drive', { provider: provider || 'local', path: path || '/' }),

  applyImport: (projectId: string, paths: string[]) =>
    client.post<ApiResponse<{ taskId: string }>>('/import/apply', { projectId, paths }),

  uploadScreenshot: (file: File, originalImageId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (originalImageId) formData.append('originalImageId', originalImageId)
    return client.post<ApiResponse<{
      annotations: { coordinates: { x: number; y: number; w: number; h: number }; text: string; confidence: number }[]
    }>>('/import/wechat-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export const portfolioApi = {
  generate: (projectId: string) =>
    client.post<ApiResponse<{ taskId: string }>>(`/projects/${projectId}/portfolio`),

  get: (id: string) =>
    client.get<ApiResponse<Portfolio>>(`/portfolios/${id}`),

  update: (id: string, data: { name?: string; description?: string; coverUrl?: string; images?: PortfolioImage[]; contactInfo?: string; clientName?: string }) =>
    client.put<ApiResponse<Portfolio>>(`/portfolios/${id}`, data),

  getStats: (id: string) =>
    client.get<ApiResponse<{ views: number; avgDuration: number }>>(`/portfolios/${id}/stats`),

  uploadCover: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post<ApiResponse<{ url: string }>>(`/portfolios/${id}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}