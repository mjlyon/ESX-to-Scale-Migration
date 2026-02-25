import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Plus, Trash2, HardDrive, CheckCircle2,
  XCircle, FolderOpen, Database, RefreshCw,
} from 'lucide-react'
import { useStorageConfigs, useDiskUsage } from '../hooks/useStorage'
import {
  createStorageConfig,
  deleteStorageConfig,
  mountStorage,
  unmountStorage,
  testStorage,
} from '../api/storage'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ProgressBar } from '../components/common/ProgressBar'
import type { StorageConfig } from '../api/storage'

type StorageType = 'local' | 'nfs' | 'smb'

export function StorageSettings() {
  const queryClient = useQueryClient()
  const { data: configs, isLoading } = useStorageConfigs()
  const { data: diskUsage } = useDiskUsage()
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StorageConfig | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; msg: string }>>({})

  // Form state
  const [storageType, setStorageType] = useState<StorageType>('local')
  const [name, setName] = useState('')
  const [path, setPath] = useState('/data/migrations')
  const [nfsServer, setNfsServer] = useState('')
  const [nfsExport, setNfsExport] = useState('')
  const [nfsOptions, setNfsOptions] = useState('')
  const [smbServer, setSmbServer] = useState('')
  const [smbShare, setSmbShare] = useState('')
  const [smbUser, setSmbUser] = useState('')
  const [smbDomain, setSmbDomain] = useState('')
  const [smbPass, setSmbPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const deleteMut = useMutation({
    mutationFn: deleteStorageConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-configs'] }),
  })

  const mountMut = useMutation({
    mutationFn: mountStorage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-configs'] }),
  })

  const unmountMut = useMutation({
    mutationFn: unmountStorage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-configs'] }),
  })

  function resetForm() {
    setName(''); setPath('/data/migrations'); setStorageType('local')
    setNfsServer(''); setNfsExport(''); setNfsOptions('')
    setSmbServer(''); setSmbShare(''); setSmbUser(''); setSmbDomain(''); setSmbPass('')
    setFormError(''); setShowForm(false)
  }

  async function handleSave() {
    setSaving(true)
    setFormError('')
    try {
      const data: Record<string, unknown> = {
        name: name || `${storageType}-storage`,
        storage_type: storageType,
        path,
      }
      if (storageType === 'nfs') {
        data.nfs_server = nfsServer
        data.nfs_export = nfsExport
        data.nfs_options = nfsOptions
      } else if (storageType === 'smb') {
        data.smb_server = smbServer
        data.smb_share = smbShare
        data.smb_username = smbUser
        data.smb_domain = smbDomain
        data.smb_password = smbPass
      }
      await createStorageConfig(data)
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
      resetForm()
    } catch (e: any) {
      setFormError(e.response?.data?.detail || e.message)
    }
    setSaving(false)
  }

  async function handleTest(id: number) {
    try {
      const result = await testStorage(id)
      setTestResults((prev) => ({ ...prev, [id]: { ok: result.success, msg: result.message } }))
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, msg: e.response?.data?.detail || e.message } }))
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteMut.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Storage</h1>

      {/* Disk usage overview */}
      {diskUsage && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Disk Usage</h2>
          <div className="space-y-2">
            {Object.entries(diskUsage).map(([mount, info]: [string, any]) => {
              const usedPct = info.total > 0 ? ((info.total - info.free) / info.total) * 100 : 0
              return (
                <div key={mount}>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{mount}</span>
                    <span>
                      {(info.free / 1024 / 1024 / 1024).toFixed(1)} GB free of{' '}
                      {(info.total / 1024 / 1024 / 1024).toFixed(1)} GB
                    </span>
                  </div>
                  <ProgressBar
                    percent={usedPct}
                    color={usedPct > 90 ? 'bg-red-500' : usedPct > 75 ? 'bg-yellow-500' : 'bg-blue-500'}
                    size="sm"
                    showLabel={false}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Storage
        </button>
      </div>

      {/* New storage form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="font-semibold">New Storage Configuration</h3>

          <div className="flex gap-4">
            {(['local', 'nfs', 'smb'] as StorageType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={storageType === t}
                  onChange={() => setStorageType(t)}
                />
                {t === 'local' ? 'Local Volume' : t === 'nfs' ? 'NFS' : 'SMB/CIFS'}
              </label>
            ))}
          </div>

          <input
            placeholder="Name (optional)"
            value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Mount path"
            value={path} onChange={(e) => setPath(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          {storageType === 'nfs' && (
            <>
              <input
                placeholder="NFS server (e.g. 192.168.1.100)"
                value={nfsServer} onChange={(e) => setNfsServer(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="NFS export path (e.g. /exports/migrations)"
                value={nfsExport} onChange={(e) => setNfsExport(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Mount options (optional, e.g. vers=3)"
                value={nfsOptions} onChange={(e) => setNfsOptions(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </>
          )}

          {storageType === 'smb' && (
            <>
              <input
                placeholder="SMB server (e.g. 192.168.1.100)"
                value={smbServer} onChange={(e) => setSmbServer(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Share name (e.g. migrations)"
                value={smbShare} onChange={(e) => setSmbShare(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Username"
                value={smbUser} onChange={(e) => setSmbUser(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Domain (optional)"
                value={smbDomain} onChange={(e) => setSmbDomain(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="password" placeholder="Password"
                value={smbPass} onChange={(e) => setSmbPass(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !path}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Storage list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : configs && configs.length > 0 ? (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {cfg.storage_type === 'local' ? (
                    <FolderOpen className="h-5 w-5 text-gray-400" />
                  ) : cfg.storage_type === 'nfs' ? (
                    <Database className="h-5 w-5 text-blue-400" />
                  ) : (
                    <HardDrive className="h-5 w-5 text-purple-400" />
                  )}
                  <div>
                    <div className="font-medium">{cfg.name}</div>
                    <div className="text-sm text-gray-500">
                      {cfg.storage_type.toUpperCase()} &middot; {cfg.path || cfg.mount_point}
                      {cfg.nfs_server && ` &middot; ${cfg.nfs_server}:${cfg.nfs_export}`}
                      {cfg.smb_server && ` &middot; //${cfg.smb_server}/${cfg.smb_share}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {cfg.is_active ? (
                    <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(cfg.id)}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    title="Test storage"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {cfg.is_active ? (
                    <button
                      onClick={() => unmountMut.mutate(cfg.id)}
                      className="rounded-md border px-2 py-1 text-xs text-orange-600 hover:bg-orange-50"
                    >
                      Unmount
                    </button>
                  ) : (
                    <button
                      onClick={() => mountMut.mutate(cfg.id)}
                      className="rounded-md border px-2 py-1 text-xs text-green-600 hover:bg-green-50"
                    >
                      Mount
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(cfg)}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Capacity bar */}
              {cfg.total_bytes > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      {((cfg.total_bytes - cfg.free_bytes) / 1024 / 1024 / 1024).toFixed(1)} GB used
                    </span>
                    <span>{(cfg.total_bytes / 1024 / 1024 / 1024).toFixed(1)} GB total</span>
                  </div>
                  <ProgressBar
                    percent={((cfg.total_bytes - cfg.free_bytes) / cfg.total_bytes) * 100}
                    size="sm"
                    showLabel={false}
                  />
                </div>
              )}

              {/* Test result */}
              {testResults[cfg.id] && (
                <p className={`text-sm ${testResults[cfg.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults[cfg.id].msg}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          No storage configurations. Add one to get started.
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Storage"
        message={deleteTarget ? `Delete storage "${deleteTarget.name}"? Any active mounts will be unmounted.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
