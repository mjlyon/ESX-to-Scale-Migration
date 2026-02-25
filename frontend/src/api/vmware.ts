import api from './client'
import type { VmwareConnection, VmInfo } from '../types/vmware'

export const getVmwareConnections = () =>
  api.get<VmwareConnection[]>('/vmware/connections').then(r => r.data)

export const createVmwareConnection = (data: Omit<VmwareConnection, 'id' | 'created_at'>) =>
  api.post<VmwareConnection>('/vmware/connections', data).then(r => r.data)

export const deleteVmwareConnection = (id: number) =>
  api.delete(`/vmware/connections/${id}`)

export const testVmwareConnection = (data: {
  host: string; username: string; password: string;
  connection_type?: string; insecure?: boolean; vcenter_hint?: string
}) =>
  api.post<{ success: boolean; message: string; uri: string }>('/vmware/test', data).then(r => r.data)

export const listVmwareVms = (data: {
  host: string; username: string; password: string;
  connection_type?: string; insecure?: boolean; vcenter_hint?: string
}) =>
  api.post<{ vms: VmInfo[]; connection_uri: string }>('/vmware/vms', data).then(r => r.data)
