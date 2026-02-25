import api from './client'

export interface SetupStatus {
  vddk: { installed: boolean; lib_path: string | null; base_dir: string | null }
  virtio: { available: boolean; path: string | null }
  system: {
    cpu_count: number; memory_total_bytes: number; memory_available_bytes: number;
    kvm_available: boolean; virt_v2v_version: string; libguestfs_ok: boolean
  }
  ready: boolean
}

export const getSetupStatus = () =>
  api.get<SetupStatus>('/setup/status').then(r => r.data)

export const uploadVddk = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/setup/vddk/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  }).then(r => r.data)
}

export const deleteVddk = () =>
  api.delete('/setup/vddk')
