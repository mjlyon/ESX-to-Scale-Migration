export interface MigrationJob {
  id: number
  vm_name: string
  vmware_host: string
  vmware_user: string
  vmware_connection_type: string
  scale_host: string
  scale_user: string
  status: string
  current_stage: string
  progress_percent: number
  progress_message: string
  vm_cpu_count: number
  vm_memory_bytes: number
  disk_count: number
  total_disk_size_bytes: number
  output_dir: string
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  error_message: string
  v2v_completed: number
  upload_completed: number
  vm_created: number
  log_file: string
  scale_vm_uuid: string
}

export interface MigrationStats {
  total: number
  pending: number
  active: number
  completed: number
  failed: number
  cancelled: number
  paused: number
}

export type JobStatus =
  | 'pending'
  | 'validating'
  | 'fetching_config'
  | 'converting'
  | 'uploading'
  | 'creating_vm'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
