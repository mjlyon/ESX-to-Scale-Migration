import api from './client'
import type { ScaleConnection } from '../types/scale'

export const getScaleConnections = () =>
  api.get<ScaleConnection[]>('/scale/connections').then(r => r.data)

export const createScaleConnection = (data: Omit<ScaleConnection, 'id' | 'created_at'>) =>
  api.post<ScaleConnection>('/scale/connections', data).then(r => r.data)

export const deleteScaleConnection = (id: number) =>
  api.delete(`/scale/connections/${id}`)

export const testScaleConnection = (data: {
  host: string; username: string; password: string; verify_tls?: boolean
}) =>
  api.post<{ success: boolean; message: string }>('/scale/test', data).then(r => r.data)
