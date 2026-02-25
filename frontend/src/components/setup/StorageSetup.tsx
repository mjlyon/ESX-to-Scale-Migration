import { useState } from 'react'
import { CheckCircle2, HardDrive, FolderOpen, Database } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createStorageConfig } from '../../api/storage'
import { useStorageConfigs } from '../../hooks/useStorage'

type StorageType = 'local' | 'nfs' | 'smb'

interface Props {
  onComplete?: () => void
}

export function StorageSetup({ onComplete }: Props) {
  const queryClient = useQueryClient()
  const { data: configs } = useStorageConfigs()
  const [storageType, setStorageType] = useState<StorageType>('local')
  const [path, setPath] = useState('/data/migrations')
  const [nfsServer, setNfsServer] = useState('')
  const [nfsExport, setNfsExport] = useState('')
  const [smbServer, setSmbServer] = useState('')
  const [smbShare, setSmbShare] = useState('')
  const [smbUser, setSmbUser] = useState('')
  const [smbPass, setSmbPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasStorage = configs && configs.length > 0

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const data: Record<string, unknown> = {
        name: `${storageType}-storage`,
        storage_type: storageType,
        path,
      }
      if (storageType === 'nfs') {
        data.nfs_server = nfsServer
        data.nfs_export = nfsExport
      } else if (storageType === 'smb') {
        data.smb_server = smbServer
        data.smb_share = smbShare
        data.smb_username = smbUser
        data.smb_password = smbPass
      }
      await createStorageConfig(data)
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
      onComplete?.()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message)
    }
    setSaving(false)
  }

  if (hasStorage) {
    return (
      <div className="rounded-md bg-green-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Storage is configured</span>
        </div>
        <div className="space-y-1">
          {configs!.map((cfg) => (
            <div key={cfg.id} className="flex items-center gap-2 text-sm text-green-600">
              {cfg.storage_type === 'local' ? (
                <FolderOpen className="h-3 w-3" />
              ) : cfg.storage_type === 'nfs' ? (
                <Database className="h-3 w-3" />
              ) : (
                <HardDrive className="h-3 w-3" />
              )}
              {cfg.name} ({cfg.storage_type}) &mdash; {cfg.path || cfg.mount_point}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Configure where converted disk images will be stored during migration.
      </p>

      {/* Storage type selector */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { type: 'local' as StorageType, label: 'Local Volume', icon: FolderOpen },
          { type: 'nfs' as StorageType, label: 'NFS Mount', icon: Database },
          { type: 'smb' as StorageType, label: 'SMB/CIFS', icon: HardDrive },
        ]).map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setStorageType(type)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
              storageType === type
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'hover:bg-gray-50'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      <input
        placeholder="Mount path (e.g. /data/migrations)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
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
            placeholder="NFS export (e.g. /exports/migrations)"
            value={nfsExport} onChange={(e) => setNfsExport(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </>
      )}

      {storageType === 'smb' && (
        <>
          <input
            placeholder="SMB server"
            value={smbServer} onChange={(e) => setSmbServer(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Share name"
            value={smbShare} onChange={(e) => setSmbShare(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Username"
            value={smbUser} onChange={(e) => setSmbUser(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="password" placeholder="Password"
            value={smbPass} onChange={(e) => setSmbPass(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || !path}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Configure Storage'}
      </button>
    </div>
  )
}
