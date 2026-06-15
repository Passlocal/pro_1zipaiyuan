import { defineStore } from 'pinia'
import { ref } from 'vue'
import { annotationApi } from '@/api/annotations'
import { useAuthStore } from '@/stores/auth'
import type { Annotation, AnnotationCreateParams, AnnotationToolType, AnnotationColor, PenWidth, ArrowWidth, FontSize, RelativeCoord, CommentCard, CardStatusAction } from '@/types/models'
import { generateId } from '@/utils/id'

export const useAnnotationStore = defineStore('annotation', () => {
  const annotations = ref<Annotation[]>([])
  const commentCards = ref<CommentCard[]>([])
  const currentImageId = ref<string>('')
  const activeTool = ref<AnnotationToolType>('pen')
  const activeColor = ref<AnnotationColor>('#FF0000')
  const activeWidth = ref<PenWidth | ArrowWidth>(3)
  const activeFontSize = ref<FontSize>(14)
  const undoStack = ref<Annotation[][]>([])
  const redoStack = ref<Annotation[][]>([])
  const maxHistory = 50

  function setTool(tool: AnnotationToolType) { activeTool.value = tool }
  function setColor(color: AnnotationColor) { activeColor.value = color }
  function setWidth(width: PenWidth | ArrowWidth) { activeWidth.value = width }
  function setFontSize(size: FontSize) { activeFontSize.value = size }
  function setCurrentImageId(id: string) { currentImageId.value = id }

  function pushUndo() {
    undoStack.value.push([...annotations.value.map(a => ({ ...a }))])
    if (undoStack.value.length > maxHistory) undoStack.value.shift()
    redoStack.value = []
  }

  function undo() {
    const snapshot = undoStack.value.pop()
    if (snapshot) {
      redoStack.value.push([...annotations.value.map(a => ({ ...a }))])
      annotations.value = snapshot
    }
  }

  function redo() {
    const snapshot = redoStack.value.pop()
    if (snapshot) {
      undoStack.value.push([...annotations.value.map(a => ({ ...a }))])
      annotations.value = snapshot
    }
  }

  function addAnnotation(params: AnnotationCreateParams): Annotation {
    pushUndo()
    const annotation: Annotation = {
      id: generateId(),
      imageId: currentImageId.value,
      userId: useAuthStore().user?.id || '',
      toolType: params.toolType,
      coordinates: params.coordinates,
      style: params.style,
      strokeData: params.strokeData,
      text: params.text,
      createdAt: new Date().toISOString()
    }
    annotations.value.push(annotation)
    // Persist to backend
    if (currentImageId.value) {
      annotationApi.create(currentImageId.value, params).then(res => {
        const idx = annotations.value.findIndex(a => a.id === annotation.id)
        if (idx !== -1) annotations.value[idx] = { ...annotations.value[idx], ...res.data.data, id: res.data.data.id || annotation.id }
      }).catch(err => console.error('[annotation] persist failed:', err))
    }
    return annotation
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      pushUndo()
      annotations.value[idx] = { ...annotations.value[idx], ...updates }
      annotationApi.update(id, updates).catch(() => {})
    }
  }

  function removeAnnotation(id: string) {
    pushUndo()
    annotations.value = annotations.value.filter(a => a.id !== id)
    commentCards.value = commentCards.value.filter(c => c.annotationId !== id)
    annotationApi.delete(id).catch(() => {})
  }

  function getAnnotationById(id: string) {
    return annotations.value.find(a => a.id === id) || null
  }

  async function loadAnnotations(imageId: string) {
    const res = await annotationApi.getByImage(imageId)
    annotations.value = res.data.data
  }

  async function loadCommentCards(imageId: string) {
    const res = await annotationApi.getCardsByImage(imageId)
    commentCards.value = res.data.data
  }

  function addCommentCard(card: CommentCard) { commentCards.value.push(card) }
  function removeCommentCard(id: string) { commentCards.value = commentCards.value.filter(c => c.id !== id) }

  async function updateCardStatus(cardId: string, action: CardStatusAction) {
    await annotationApi.updateCardStatus(cardId, action)
    const card = commentCards.value.find(c => c.id === cardId)
    if (card) card.status = action === 'resolve' ? 'resolved' : 'unresolved'
  }

  function updateCardsOrder(ids: string[]) {
    const ordered = ids.map((id, i) => {
      const card = commentCards.value.find(c => c.id === id)
      if (card) card.sortOrder = i
      return card
    }).filter(Boolean) as CommentCard[]
    commentCards.value = ordered
  }

  function toScreenCoord(rel: RelativeCoord, imgWidth: number, imgHeight: number) {
    return {
      x: rel.x * imgWidth,
      y: rel.y * imgHeight,
      w: (rel.w || 0) * imgWidth,
      h: (rel.h || 0) * imgHeight
    }
  }

  function toRelativeCoord(screenX: number, screenY: number, imgWidth: number, imgHeight: number, screenW = 0, screenH = 0): RelativeCoord {
    return {
      x: screenX / imgWidth,
      y: screenY / imgHeight,
      w: imgWidth > 0 ? screenW / imgWidth : 0,
      h: imgHeight > 0 ? screenH / imgHeight : 0
    }
  }

  return {
    annotations, commentCards, currentImageId, activeTool, activeColor, activeWidth, activeFontSize,
    undoStack, redoStack,
    setTool, setColor, setWidth, setFontSize, setCurrentImageId,
    undo, redo, addAnnotation, updateAnnotation, removeAnnotation, getAnnotationById,
    loadAnnotations, loadCommentCards, addCommentCard, removeCommentCard,
    updateCardStatus, updateCardsOrder, toScreenCoord, toRelativeCoord
  }
})