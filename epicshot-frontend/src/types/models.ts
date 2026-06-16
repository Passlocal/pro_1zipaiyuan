// ============ 用户与工作空间 ============
export type UserRole = 'owner' | 'editor'
export type ClientRole = 'client'
export type MemberStatus = 'active' | 'disabled'
export type PlanType = 'free' | 'pro' | 'enterprise'

export interface Workspace {
  id: string
  name: string
  logoUrl: string
  planType: PlanType
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  wechatOpenid?: string
  workspaceId: string
  role: UserRole
  avatarUrl: string
  status: MemberStatus
  createdAt: string
}

export interface ClientIdentity {
  openid?: string
  visitorId: string
}

// ============ 项目管理 ============
export type ProjectStatus = 'draft' | 'review' | 'in_progress' | 'final_review' | 'completed' | 'archived'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿',
  review: '待确认',
  in_progress: '修改中',
  final_review: '待确稿',
  completed: '已完成',
  archived: '已归档',
}

export interface Project {
  id: string
  name: string
  workspaceId: string
  clientName: string
  deadline?: string
  status: ProjectStatus
  shareToken?: string
  shareExpiry?: string
  thumbnailUrl?: string
  pendingCount: number
  recentActivity: string
  createdAt: string
  updatedAt: string
}

export interface ProjectCreateParams {
  name: string
  clientName?: string
  deadline?: string
  note?: string
}

export type ShareExpiry = 'permanent' | '7days' | '30days'

// ============ 产品单元 ============
export interface ProductUnit {
  id: string
  projectId: string
  name: string
  sortOrder: number
}

// ============ 图片与视频 ============
export type MediaType = 'image' | 'video'

export interface ImageMedia {
  id: string
  productUnitId: string
  originalUrl: string
  thumbnailUrls: string[] // [320px, 800px, original]
  mediaType: MediaType
  metadata: Record<string, unknown>
  uploaderId: string
  createdAt: string
}

// ============ 标注 (Canvas批注) ============
export type AnnotationToolType = 'pen' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'eraser'
export type AnnotationColor = '#FF0000' | '#FFCC00' | '#0066FF' | '#FFFFFF'
export type PenWidth = 3 | 5 | 10
export type ArrowWidth = 3 | 5
export type FontSize = 14 | 18 | 24

export interface AnnotationStyle {
  color: AnnotationColor
  width: number
  fontSize?: FontSize
}

// 相对坐标：左上角(0,0)，右下角(1,1)
export interface RelativeCoord {
  x: number
  y: number
  w?: number
  h?: number
}

export interface Annotation {
  id: string
  imageId: string
  userId: string
  toolType: AnnotationToolType
  coordinates: RelativeCoord
  style: AnnotationStyle
  strokeData?: number[][] // 画笔自由线条数据
  text?: string
  createdAt: string
}

export interface AnnotationCreateParams {
  toolType: AnnotationToolType
  coordinates: RelativeCoord
  style: AnnotationStyle
  strokeData?: number[][]
  text?: string
}

// ============ 意见卡片 ============
export type CardStatus = 'unresolved' | 'resolved'
export type CardStatusAction = 'resolve' | 'unresolve'

export interface CommentCard {
  id: string
  annotationId: string
  imageId: string
  text: string
  status: CardStatus
  sortOrder: number
  thumbnailUrl?: string
  resolvedBy?: string
  resolvedAt?: string
  assigneeId?: string
  disputeCount: number
  disputed: boolean
  createdAt: string
}

// ============ AI功能 ============
export type AIStyle = 'nordic' | 'bohemian' | 'cold_metal' | 'warm_natural' | 'advanced_grey' | 'enhance'

export const AI_STYLE_LABELS: Record<AIStyle, string> = {
  nordic: '北欧极简',
  bohemian: '波西米亚',
  cold_metal: '冷调金属',
  warm_natural: '自然光暖调',
  advanced_grey: '高级灰',
  enhance: '原片增强'
}

export interface AISample {
  id: string
  imageId: string
  style: AIStyle
  outputUrls: string[]
  likedIndexes: number[]
  params?: Record<string, unknown>
  createdAt: string
}

export interface AIStyleTask {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: AISample
  error?: string
}

export interface AIInstruction {
  id: string
  commentCardId: string
  originalText: string
  suggestionText: string
  suggestedParams: Record<string, number>
  editorConfirmedParams?: Record<string, number>
  helpful?: boolean
  createdAt: string
}

// ============ 修改溯源 ============
export interface Revision {
  id: string
  imageId: string
  commentCardId?: string
  uploadedImageUrl: string
  diffSummary?: Record<string, unknown>
  paramChanges?: { key: string; value: number }[]
  createdBy: string
  createdAt: string
}

export interface TimelineNode {
  id: string
  type: 'annotation' | 'revision' | 'confirm' | 'status_change'
  userAvatar: string
  userName: string
  description: string
  timestamp: string
  revision?: Revision
  commentCard?: CommentCard
  annotation?: Annotation
}

// ============ 色差巡检 ============
export interface ColorCheckItem {
  imageId: string
  thumbnailUrl: string
  deviationType: 'color_temp' | 'brightness' | 'contrast'
  deviationValue: number
  suggestion: string
}

export interface ColorCheckReport {
  id: string
  projectId: string
  totalImages: number
  abnormalCount: number
  items: ColorCheckItem[]
  createdAt: string
}

// ============ F-26: AI全图一致性巡检 ============
export interface ConsistencyAnomaly {
  id: string
  type: 'light_direction' | 'highlight_position' | 'shadow_angle' | 'color_temperature' | 'exposure' | 'reflection'
  description: string
  severity: 'high' | 'medium' | 'low'
  affectedImageIds: string[]
  normalImageIds: string[]
  suggestion: string
}

export interface SceneGroup {
  sceneId: string
  sceneName: string
  imageCount: number
  dominantLightDirection: string
  consistency: 'consistent' | 'inconsistent'
}

export interface ConsistencyReport {
  id: string
  projectId: string
  totalImages: number
  totalSceneGroups: number
  consistentSceneGroups: number
  inconsistentSceneGroups: number
  sceneGroups: SceneGroup[]
  anomalies: ConsistencyAnomaly[]
  overallScore: number
  createdAt: string
}

// ============ 作品集 ============
export interface Portfolio {
  id: string
  projectId: string
  name: string
  description: string
  coverUrl: string
  images: PortfolioImage[]
  clientName: string
  workspaceLogo: string
  contactInfo: string
  qrCode: string
  views: number
  avgDuration: number
  isPublished: boolean
  createdAt: string
}

export interface PortfolioImage {
  url: string
  description: string
}

// ============ WebSocket消息 ============
export type WSMessageType = 'annotation_update' | 'cursor_move' | 'annotation_delete' | 'user_join' | 'user_leave'

export interface WSMessage {
  type: WSMessageType
  data: unknown
  userId: string
  timestamp: number
}

export interface CursorData {
  x: number
  y: number
  color: string
}

// ============ 在线用户 ============
export interface OnlineUser {
  id: string
  name: string
  avatarUrl: string
  cursorColor: string
}

// ============ V1.1 战情室 ============
export type HealthStatus = 'green' | 'yellow' | 'red'

export interface ProjectHealth {
  id: string
  name: string
  clientName: string
  status: string
  deadline?: string
  health: HealthStatus
  healthReasons: string[]
  unresolvedCount: number
  disputedCount: number
  updatedAt: string
}

export interface MemberLoad {
  id: string
  name: string
  avatarUrl: string
  role: string
  taskCount: number
}

export interface DashboardStats {
  total: number
  active: number
  red: number
  yellow: number
  totalUnresolved: number
}

export interface DashboardData {
  stats: DashboardStats
  projects: ProjectHealth[]
  memberLoads: MemberLoad[]
  updatedAt: string
}

// ============ V1.1 通知 ============
export type NotificationType = 'annotation' | 'dispute' | 'deadline' | 'status_change' | 'mention' | 'assign' | 'confirm_request'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  annotation: '新批注',
  dispute: '争议预警',
  deadline: '截止提醒',
  status_change: '状态变更',
  mention: '提及',
  assign: '任务指派',
  confirm_request: '确稿请求'
}

export interface Notification {
  id: string
  workspaceId: string
  userId: string
  type: NotificationType
  title: string
  content: string
  link: string
  isRead: boolean
  projectId?: string
  commentCardId?: string
  createdAt: string
}

// ============ V1.1 修图师待办 ============
export type TaskPriority = 'dispute' | 'urgent' | 'normal'

export interface MyTask {
  id: string
  annotationId: string
  imageId: string
  text: string
  status: string
  sortOrder: number
  assigneeId?: string
  disputeCount: number
  disputed: boolean
  projectName: string
  projectId: string
  thumbnailUrl: string
  priority: TaskPriority
  createdAt: string
}