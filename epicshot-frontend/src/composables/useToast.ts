import { inject } from 'vue'
import type ToastComponent from '@/components/common/Toast.vue'

type ToastFn = () => InstanceType<typeof ToastComponent>

export function useToast() {
  const toastFn = inject<ToastFn>('globalToast')
  if (!toastFn) {
    // Fallback: return a no-op toast for components used outside App
    const noop = () => {}
    return {
      success: noop,
      error: noop,
      warning: noop,
      info: noop,
      show: noop,
    } as unknown as ReturnType<ToastFn>
  }
  return toastFn()
}