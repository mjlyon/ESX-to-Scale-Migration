export interface WsJobUpdate {
  type: 'job_update'
  job_id: number
  status?: string
  current_stage?: string
  progress_percent?: number
  progress_message?: string
  error_message?: string
  timestamp: string
}

export interface WsJobLog {
  type: 'job_log'
  job_id: number
  level: string
  line: string
  timestamp: string
}

export interface WsSystemStatus {
  type: 'system_status'
  active_jobs: number
  queued_jobs: number
  disk_free_bytes: number
  disk_total_bytes: number
  timestamp: string
}

export type WsMessage = WsJobUpdate | WsJobLog | WsSystemStatus
