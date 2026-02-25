import api from './client'
import type { MigrationJob, MigrationStats } from '../types/migration'

export const getMigrations = (status?: string) =>
  api.get<MigrationJob[]>('/migrations', { params: status ? { status } : {} }).then(r => r.data)

export const getMigration = (id: number) =>
  api.get<MigrationJob>(`/migrations/${id}`).then(r => r.data)

export const getMigrationStats = () =>
  api.get<MigrationStats>('/migrations/stats').then(r => r.data)

export const createMigrations = (data: {
  vmware_host: string; vmware_user: string; vmware_password: string;
  vmware_connection_type?: string; vmware_insecure?: boolean; vmware_vcenter_hint?: string;
  scale_host: string; scale_user: string; scale_password: string; scale_verify_tls?: boolean;
  vms: { name: string }[];
  use_vddk?: boolean; auto_start?: boolean; create_vm?: boolean;
}) =>
  api.post<MigrationJob[]>('/migrations', data).then(r => r.data)

export const startMigration = (id: number, passwords: { vmware_password: string; scale_password: string }) =>
  api.post(`/migrations/${id}/start`, passwords)

export const pauseMigration = (id: number) =>
  api.post(`/migrations/${id}/pause`)

export const cancelMigration = (id: number) =>
  api.post(`/migrations/${id}/cancel`)

export const retryMigration = (id: number, passwords: { vmware_password: string; scale_password: string }) =>
  api.post(`/migrations/${id}/retry`, passwords)

export const deleteMigration = (id: number) =>
  api.delete(`/migrations/${id}`)

export const getMigrationLogs = (id: number) =>
  api.get<{ lines: string[] }>(`/migrations/${id}/logs`).then(r => r.data)
