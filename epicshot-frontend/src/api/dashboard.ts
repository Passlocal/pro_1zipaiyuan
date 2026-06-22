import client from './client'
import type { DashboardData, Notification, MyTask } from '@/types/models'

export const dashboardApi = {
  getDashboard() {
    return client.get<{ data: DashboardData }>('/v1/dashboard')
  },
  getNotifications(limit = 50, offset = 0) {
    return client.get<{ data: Notification[]; total: number; unread: number }>('/v1/notifications', { params: { limit, offset } })
  },
  markNotificationRead(id: string) {
    return client.put<{ data: { ok: boolean } }>(`/v1/notifications/${id}/read`)
  },
  markAllNotificationsRead() {
    return client.put<{ data: { ok: boolean } }>('/v1/notifications/read-all')
  },
  getMyTasks() {
    return client.get<{ data: MyTask[]; total: number }>('/v1/my-tasks')
  },
  assignCard(cardId: string, assigneeId: string | null) {
    return client.put<{ data: any }>(`/v1/comment-cards/${cardId}/assign`, { assigneeId })
  },
  disputeCard(cardId: string, action: 'resolve' | 'acknowledge') {
    return client.put<{ data: any }>(`/v1/comment-cards/${cardId}/dispute`, { action })
  },
  updateWarningSettings(projectId: string, warningHours: number) {
    return client.put<{ data: { warningHours: number } }>(`/v1/projects/${projectId}/warning-settings`, { warningHours })
  }
}