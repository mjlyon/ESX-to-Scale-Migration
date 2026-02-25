import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Upload, ChevronRight, RefreshCw } from 'lucide-react'
import { getSetupStatus, uploadVddk, deleteVddk } from '../api/setup'
import { FileUpload } from '../components/common/FileUpload'

type Tab = 'status' | 'vddk' | 'virtio'

export function SetupWizard() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('status')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVddk,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  async function handleVddkUpload(file: File) {
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    try {
      await uploadVddk(file)
      setUploadSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || e.message)
    }
    setUploading(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const ready = status?.ready ?? false

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Setup</h1>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Overall readiness */}
      <div className={`rounded-lg border p-4 ${ready ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
        <div className="flex items-center gap-3">
          {ready ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-yellow-600" />
          )}
          <div>
            <p className="font-medium">{ready ? 'System is ready for migrations' : 'Setup incomplete'}</p>
            <p className="text-sm text-gray-600">
              {ready ? 'All dependencies are configured.' : 'Complete the steps below to get started.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['status', 'vddk', 'virtio'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'status' ? 'System Status' : t === 'vddk' ? 'VMware VDDK' : 'VirtIO Drivers'}
          </button>
        ))}
      </div>

      {/* System Status */}
      {tab === 'status' && status && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">System Information</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div>
                <span className="text-gray-500">CPUs:</span>{' '}
                <span className="font-medium">{status.system.cpu_count}</span>
              </div>
              <div>
                <span className="text-gray-500">Memory:</span>{' '}
                <span className="font-medium">
                  {(status.system.memory_total_bytes / 1024 / 1024 / 1024).toFixed(1)} GB total,{' '}
                  {(status.system.memory_available_bytes / 1024 / 1024 / 1024).toFixed(1)} GB available
                </span>
              </div>
              <div>
                <span className="text-gray-500">virt-v2v:</span>{' '}
                <span className="font-medium">{status.system.virt_v2v_version || 'Not found'}</span>
              </div>
            </div>
            <div className="space-y-3">
              <StatusRow label="KVM" ok={status.system.kvm_available} />
              <StatusRow label="libguestfs" ok={status.system.libguestfs_ok} />
              <StatusRow label="VDDK" ok={status.vddk.installed} />
              <StatusRow label="VirtIO Drivers" ok={status.virtio.available} />
            </div>
          </div>
        </div>
      )}

      {/* VDDK */}
      {tab === 'vddk' && status && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">VMware VDDK (Virtual Disk Development Kit)</h2>
          <p className="text-sm text-gray-600">
            The VDDK library is required for efficient disk-level access to VMware VMs.
            Download it from the VMware developer portal and upload the tarball below.
          </p>

          {status.vddk.installed ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">VDDK is installed</span>
              </div>
              {status.vddk.lib_path && (
                <p className="mt-1 text-sm text-green-600">Library path: {status.vddk.lib_path}</p>
              )}
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="mt-3 rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove VDDK'}
              </button>
            </div>
          ) : (
            <>
              <FileUpload
                accept=".tar.gz,.tgz"
                onFile={handleVddkUpload}
                label="Drop VMware VDDK tarball here or click to browse (.tar.gz)"
                loading={uploading}
              />
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              {uploadSuccess && <p className="text-sm text-green-600">VDDK uploaded and installed successfully!</p>}
            </>
          )}
        </div>
      )}

      {/* VirtIO */}
      {tab === 'virtio' && status && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">VirtIO Drivers</h2>
          <p className="text-sm text-gray-600">
            VirtIO drivers are required for Windows VMs to work properly after migration.
            They are typically included in the container image.
          </p>

          {status.virtio.available ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">VirtIO drivers are available</span>
              </div>
              {status.virtio.path && (
                <p className="mt-1 text-sm text-green-600">Path: {status.virtio.path}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex items-center gap-2 text-yellow-700">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">VirtIO drivers not found</span>
              </div>
              <p className="mt-1 text-sm text-yellow-600">
                VirtIO drivers should be available in the container. If you built the container
                without them, rebuild with the VirtIO ISO included.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={ok ? 'text-green-700' : 'text-red-600'}>{label}</span>
    </div>
  )
}
