export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function timeAgo(date: string | Date): string {
  const now = Date.now()
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = now - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return formatDate(date)
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  review: '待客户确认',
  in_progress: '修改中',
  final_review: '待确稿',
  completed: '已完成'
}

export const ANNOTATION_TOOL_LABELS: Record<string, string> = {
  pen: '画笔',
  arrow: '箭头',
  rectangle: '矩形',
  ellipse: '椭圆',
  text: '文字',
  eraser: '橡皮擦'
}