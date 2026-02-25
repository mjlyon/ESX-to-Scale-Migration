import { create } from 'zustand'

interface UiStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (v: boolean) => void

  setupComplete: boolean | null
  setSetupComplete: (v: boolean) => void

  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void

  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

let toastId = 0

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  setupComplete: null,
  setSetupComplete: (v) => set({ setupComplete: v }),

  theme: 'light',
  setTheme: (t) => set({ theme: t }),

  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastId}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
