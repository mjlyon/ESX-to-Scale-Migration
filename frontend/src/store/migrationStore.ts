import { create } from 'zustand'

interface LogLine {
  level: string
  line: string
  timestamp: string
}

interface JobState {
  status?: string
  current_stage?: string
  progress_percent?: number
  progress_message?: string
  error_message?: string
}

interface MigrationStore {
  jobs: Record<number, JobState>
  logs: Record<number, LogLine[]>
  updateJob: (id: number, update: JobState) => void
  appendLog: (id: number, log: LogLine) => void
  clearLogs: (id: number) => void
}

export const useMigrationStore = create<MigrationStore>((set) => ({
  jobs: {},
  logs: {},
  updateJob: (id, update) =>
    set((state) => ({
      jobs: { ...state.jobs, [id]: { ...state.jobs[id], ...update } },
    })),
  appendLog: (id, log) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [id]: [...(state.logs[id] || []).slice(-500), log],
      },
    })),
  clearLogs: (id) =>
    set((state) => ({
      logs: { ...state.logs, [id]: [] },
    })),
}))
