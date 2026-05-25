type ToastType = 'error' | 'success' | 'info'

export type ToastMessage = {
  id: number
  message: string
  type: ToastType
}

type ToastListener = (toast: ToastMessage) => void

const listeners = new Set<ToastListener>()
let nextToastId = 1

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notify(message: string, type: ToastType = 'info') {
  const toast = {
    id: nextToastId,
    message,
    type,
  }
  nextToastId += 1
  listeners.forEach((listener) => listener(toast))
}

export function notifyError(message: string) {
  notify(message, 'error')
}

export function notifySuccess(message: string) {
  notify(message, 'success')
}
