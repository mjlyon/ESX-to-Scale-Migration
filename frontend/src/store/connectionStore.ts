import { create } from 'zustand'

interface ConnectionStore {
  wsConnected: boolean
  setWsConnected: (v: boolean) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
}))
