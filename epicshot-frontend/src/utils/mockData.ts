import type { User, Workspace, Project, ProductUnit, ImageMedia, Annotation, CommentCard, TimelineNode, ColorCheckReport } from '@/types/models'

// Helper: encode a string to base64 with Unicode support
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary)
}

// A 800x600 SVG placeholder image as data URI
const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#e8eaed"/>
  <rect x="100" y="100" width="600" height="400" rx="12" fill="#667eea" opacity="0.15"/>
  <circle cx="400" cy="250" r="80" fill="#764ba2" opacity="0.3"/>
  <rect x="250" y="380" width="300" height="60" rx="8" fill="#667eea" opacity="0.4"/>
  <text x="400" y="260" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#5f6368">Sample Photo</text>
  <text x="400" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#9aa0a6">EpicShot Studio</text>
  <line x1="0" y1="0" x2="800" y2="600" stroke="#dadce0" stroke-width="0.5"/>
  <line x1="800" y1="0" x2="0" y2="600" stroke="#dadce0" stroke-width="0.5"/>
</svg>`
export const SAMPLE_IMAGE_SVG = 'data:image/svg+xml;base64,' + toBase64(svgStr)

export function mockUser(): User {
  return {
    id: 'mock-user-1',
    name: '张总监',
    email: 'zhang@epicshot.com',
    workspaceId: 'mock-workspace-1',
    role: 'owner',
    avatarUrl: '',
    status: 'active',
    createdAt: '2026-01-15T08:00:00Z'
  }
}

export function mockWorkspace(): Workspace {
  return {
    id: 'mock-workspace-1',
    name: '素影摄影工作室',
    logoUrl: '',
    planType: 'enterprise',
    createdAt: '2026-01-15T08:00:00Z'
  }
}

export function mockMembers(): User[] {
  return [
    mockUser(),
    {
      id: 'mock-user-2',
      name: '李修图',
      email: 'li@epicshot.com',
      workspaceId: 'mock-workspace-1',
      role: 'editor',
      avatarUrl: '',
      status: 'active',
      createdAt: '2026-02-10T10:00:00Z'
    },
    {
      id: 'mock-user-3',
      name: '王后期',
      email: 'wang@epicshot.com',
      workspaceId: 'mock-workspace-1',
      role: 'editor',
      avatarUrl: '',
      status: 'active',
      createdAt: '2026-03-05T09:00:00Z'
    },
    {
      id: 'mock-user-4',
      name: '赵助理',
      email: 'zhao@epicshot.com',
      workspaceId: 'mock-workspace-1',
      role: 'editor',
      avatarUrl: '',
      status: 'disabled',
      createdAt: '2026-04-20T14:00:00Z'
    }
  ]
}

export function mockProjects(): Project[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'mock-project-1',
      workspaceId: 'mock-workspace-1',
      clientName: '小米科技',
      name: '小米15系列官网主图',
      status: 'in_progress',
      shareToken: 'mock-share-1',
      pendingCount: 8,
      recentActivity: new Date(Date.now() - 3600000).toISOString(),
      createdAt: '2026-06-01T10:00:00Z',
      updatedAt: now
    },
    {
      id: 'mock-project-2',
      workspaceId: 'mock-workspace-1',
      clientName: '花西子',
      name: '花西子口红新品',
      status: 'final_review',
      shareToken: 'mock-share-2',
      pendingCount: 3,
      recentActivity: new Date(Date.now() - 7200000).toISOString(),
      createdAt: '2026-05-28T14:00:00Z',
      updatedAt: now
    },
    {
      id: 'mock-project-3',
      workspaceId: 'mock-workspace-1',
      clientName: '安踏体育',
      name: '2026春季跑鞋系列',
      status: 'completed',
      shareToken: 'mock-share-3',
      pendingCount: 0,
      recentActivity: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdAt: '2026-05-15T09:00:00Z',
      updatedAt: now
    },
    {
      id: 'mock-project-4',
      workspaceId: 'mock-workspace-1',
      clientName: '无印良品',
      name: '家居收纳系列',
      status: 'draft',
      shareToken: 'mock-share-4',
      pendingCount: 0,
      recentActivity: new Date(Date.now() - 86400000).toISOString(),
      createdAt: '2026-06-10T16:00:00Z',
      updatedAt: now
    },
    {
      id: 'mock-project-5',
      workspaceId: 'mock-workspace-1',
      clientName: '星巴克',
      name: '夏季冰饮菜单',
      status: 'review',
      shareToken: 'mock-share-5',
      pendingCount: 12,
      recentActivity: new Date(Date.now() - 1800000).toISOString(),
      createdAt: '2026-06-08T11:00:00Z',
      updatedAt: now
    }
  ]
}

export function mockProductUnits(projectId: string): ProductUnit[] {
  const baseId = projectId.split('-').pop() || 'x'
  return [
    { id: `mock-unit-${baseId}-1`, projectId, name: '主图', sortOrder: 1 },
    { id: `mock-unit-${baseId}-2`, projectId, name: '细节图', sortOrder: 2 },
    { id: `mock-unit-${baseId}-3`, projectId, name: '场景图', sortOrder: 3 }
  ]
}

export function mockImages(unitId: string): ImageMedia[] {
  const baseId = unitId.split('-').pop() || 'x'
  const imgUrl = SAMPLE_IMAGE_SVG
  return [
    { id: `mock-img-${baseId}-1`, productUnitId: unitId, originalUrl: imgUrl, thumbnailUrls: [imgUrl, imgUrl, imgUrl], mediaType: 'image', metadata: { width: 800, height: 600 }, uploaderId: 'mock-user-1', createdAt: '2026-06-01T10:00:00Z' },
    { id: `mock-img-${baseId}-2`, productUnitId: unitId, originalUrl: imgUrl, thumbnailUrls: [imgUrl, imgUrl, imgUrl], mediaType: 'image', metadata: { width: 800, height: 1200 }, uploaderId: 'mock-user-1', createdAt: '2026-06-01T10:30:00Z' },
    { id: `mock-img-${baseId}-3`, productUnitId: unitId, originalUrl: imgUrl, thumbnailUrls: [imgUrl, imgUrl, imgUrl], mediaType: 'image', metadata: { width: 800, height: 600 }, uploaderId: 'mock-user-2', createdAt: '2026-06-02T09:00:00Z' }
  ]
}

export function mockAnnotations(imageId: string): Annotation[] {
  const baseId = imageId.split('-').pop() || 'x'
  return [
    {
      id: `mock-ann-${baseId}-1`,
      imageId,
      userId: 'mock-user-1',
      toolType: 'rectangle',
      coordinates: { x: 0.15, y: 0.2, w: 0.3, h: 0.25 },
      style: { color: '#FF0000', width: 3 },
      createdAt: '2026-06-05T10:00:00Z'
    },
    {
      id: `mock-ann-${baseId}-2`,
      imageId,
      userId: 'mock-user-1',
      toolType: 'arrow',
      coordinates: { x: 0.5, y: 0.6, w: 0.15, h: -0.2 },
      style: { color: '#0066FF', width: 3 },
      createdAt: '2026-06-05T10:05:00Z'
    },
    {
      id: `mock-ann-${baseId}-3`,
      imageId,
      userId: 'mock-user-1',
      toolType: 'text',
      coordinates: { x: 0.55, y: 0.35 },
      style: { color: '#FF0000', width: 3, fontSize: 18 },
      text: '这里偏暗，需要提亮',
      createdAt: '2026-06-05T10:10:00Z'
    }
  ]
}

export function mockCommentCards(imageId: string, annotations: Annotation[]): CommentCard[] {
  if (annotations.length === 0) return []
  const baseId = imageId.split('-').pop() || 'x'
  return annotations.map((ann, i) => ({
    id: `mock-card-${baseId}-${i + 1}`,
    annotationId: ann.id,
    imageId,
    text: ann.text || (ann.toolType === 'rectangle' ? '这个区域需要重新构图' : ann.toolType === 'arrow' ? '箭头指向的元素请替换' : ''),
    status: i === 0 ? 'resolved' as const : 'unresolved' as const,
    sortOrder: i + 1,
    createdAt: ann.createdAt,
    resolvedBy: i === 0 ? 'mock-user-2' : undefined,
    resolvedAt: i === 0 ? '2026-06-06T14:00:00Z' : undefined,
    disputeCount: 0,
    disputed: false
  }))
}

export function mockTimeline(_projectId: string): TimelineNode[] {
  return [
    {
      id: 'mock-tl-1',
      type: 'annotation',
      userAvatar: '',
      userName: '客户 张经理',
      description: '提交了 5 条批注意见',
      timestamp: '2026-06-05T10:10:00Z'
    },
    {
      id: 'mock-tl-2',
      type: 'status_change',
      userAvatar: '',
      userName: '张总监',
      description: '项目状态变更：草稿 → 待客户确认',
      timestamp: '2026-06-05T10:30:00Z'
    },
    {
      id: 'mock-tl-3',
      type: 'revision',
      userAvatar: '',
      userName: '李修图',
      description: '上传了 3 张修改后成片，解决了批注 #1 #3 #5',
      timestamp: '2026-06-06T14:00:00Z',
      revision: {
        id: 'mock-rev-1',
        imageId: 'mock-img-1-1',
        uploadedImageUrl: SAMPLE_IMAGE_SVG,
        createdBy: 'mock-user-2',
        createdAt: '2026-06-06T14:00:00Z'
      }
    },
    {
      id: 'mock-tl-4',
      type: 'confirm',
      userAvatar: '',
      userName: '客户 张经理',
      description: '确认了 3 张图片，驳回了 2 张',
      timestamp: '2026-06-06T16:00:00Z'
    },
    {
      id: 'mock-tl-5',
      type: 'revision',
      userAvatar: '',
      userName: '王后期',
      description: '重新修改后上传了驳回的 2 张图片',
      timestamp: '2026-06-07T09:00:00Z',
      revision: {
        id: 'mock-rev-2',
        imageId: 'mock-img-1-2',
        uploadedImageUrl: SAMPLE_IMAGE_SVG,
        createdBy: 'mock-user-3',
        createdAt: '2026-06-07T09:00:00Z',
        paramChanges: [{ key: '阴影', value: 18 }, { key: '曝光', value: 0.3 }]
      }
    }
  ]
}

export function mockColorCheckReport(): ColorCheckReport {
  return {
    id: 'mock-cc-1',
    projectId: 'mock-project-1',
    totalImages: 12,
    abnormalCount: 3,
    items: [
      {
        imageId: 'mock-img-1-1',
        thumbnailUrl: SAMPLE_IMAGE_SVG,
        deviationType: 'color_temp',
        deviationValue: 350,
        suggestion: '白平衡 -200K'
      },
      {
        imageId: 'mock-img-1-2',
        thumbnailUrl: SAMPLE_IMAGE_SVG,
        deviationType: 'brightness',
        deviationValue: -15,
        suggestion: '曝光 +0.4'
      },
      {
        imageId: 'mock-img-1-3',
        thumbnailUrl: SAMPLE_IMAGE_SVG,
        deviationType: 'contrast',
        deviationValue: 22,
        suggestion: '对比度 -12'
      }
    ],
    createdAt: '2026-06-07T10:00:00Z'
  }
}