import api from './client'

export interface StorageConfig {
  id: number; name: string; storage_type: string; path: string;
  nfs_server: string; nfs_export: string; nfs_options: string;
  smb_server: string; smb_share: string; smb_username: string; smb_domain: string;
  is_active: number; is_default: number; mount_point: string;
  total_bytes: number; free_bytes: number; created_at: string | null;
}

export const getStorageConfigs = () =>
  api.get<StorageConfig[]>('/storage/configs').then(r => r.data)

export const createStorageConfig = (data: Record<string, unknown>) =>
  api.post<StorageConfig>('/storage/configs', data).then(r => r.data)

export const deleteStorageConfig = (id: number) =>
  api.delete(`/storage/configs/${id}`)

export const mountStorage = (id: number) =>
  api.post(`/storage/configs/${id}/mount`).then(r => r.data)

export const unmountStorage = (id: number) =>
  api.post(`/storage/configs/${id}/unmount`)

export const testStorage = (id: number) =>
  api.post(`/storage/configs/${id}/test`).then(r => r.data)

export const getDiskUsage = () =>
  api.get('/storage/disk-usage').then(r => r.data)
