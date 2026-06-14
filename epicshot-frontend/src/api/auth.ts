import client from './client'
import type { ApiResponse } from '@/types/api'
import type { User, Workspace } from '@/types/models'

export const authApi = {
  loginWithWechat: (code: string) =>
    client.post<ApiResponse<{ token: string; user: User }>>('/auth/wechat', { code }),

  loginWithEmail: (email: string, password: string) =>
    client.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    client.post<ApiResponse<{ token: string; user: User }>>('/auth/register', { email, password, name }),

  getMe: () => client.get<ApiResponse<User>>('/users/me'),

  getWorkspace: () => client.get<ApiResponse<Workspace>>('/workspaces/mine'),

  updateWorkspace: (data: Partial<Workspace>) =>
    client.put<ApiResponse<Workspace>>('/workspaces/mine', data),

  inviteMember: (email: string, role: string) =>
    client.post<ApiResponse<void>>('/workspaces/invite', { email, role }),

  getMembers: () => client.get<ApiResponse<User[]>>('/workspaces/members'),

  removeMember: (userId: string) =>
    client.delete<ApiResponse<void>>(`/workspaces/members/${userId}`),

  generateApiKey: () => client.post<ApiResponse<{ key: string; secret: string }>>('/workspaces/api-keys'),

  revokeApiKey: () => client.delete<ApiResponse<void>>('/workspaces/api-keys')
}