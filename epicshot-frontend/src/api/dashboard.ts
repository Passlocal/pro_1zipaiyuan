import { http } from '@/utils/http'
import type { DashboardData, Notification, MyTask } from '@/types/models'

export const dashboardApi = {
  getDashboard() {
    return http.get<{ data: DashboardData }>('/v1/dashboard')
  },
  getNotifications(limit = 50, offset = 0) {
    return http.get<{ data: Notification[]; total: number; unread: number }>('/v1/notifications', { params: { limit, offset } })
  },
  markNotificationRead(id: string) {
    return http.put<{ data: { ok: boolean } }>(`/v1/notifications/${id}/read`)
  },
  markAllNotificationsRead() {
    return http.put<{ data: { ok: boolean } }>('/v1/notifications/read-all')
  },
  getMyTasks() {
    return http.get<{ data: MyTask[]; total: number }>('/v1/my-tasks')
  },
  assignCard(cardId: string, assigneeId: string | null) {
    return http.put<{ data: any }>(`/v1/comment-cards/${cardId}/assign`, { assigneeId })
  },
  disputeCard(cardId: string, action: 'resolve' | 'acknowledge') {
    return http.put<{ data: any }>(`/v1/comment-cards/${cardId}/dispute`, { action })
  },
  updateWarningSettings(projectId: string, warningHours: number) {
    return http.put<{ data: { warningHours: number } }>(`/v1/projects/${projectId}/warning-settings`, { warningHours })
  }
}