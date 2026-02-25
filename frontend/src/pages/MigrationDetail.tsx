import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pause, Play, X, RotateCw } from 'lucide-react'
import { useMigration } from '../hooks/useMigrations'
import { useMigrationStore } from '../store/migrationStore'
import { pauseMigration, cancelMigration, retryMigration, startMigration } from '../api/migrations'
import { StatusBadge } from '../components/common/StatusBadge'
import { StageIndicator } from '../components/migration/StageIndicator'
import { MigrationProgress } from '../components/migration/MigrationProgress'
import { MigrationLogs } from '../components/migration/MigrationLogs'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

export function MigrationDetail() {
  const { id } = useParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job } = useMigration(jobId)
  const wsState = useMigrationStore((s) => s.jobs[jobId])
  const [showCancel, setShowCancel] = useState(false)
  const [passwordModal, setPasswordModal] = useState<'retry' | 'resume' | null>(null)
  const [vmwarePass, setVmwarePass] = useState('')
  const [scalePass, setScalePass] = useState('')

  if (!job) return <div className="text-gray-500">Loading...</div>

  const status = wsState?.status || job.status
  const progress = wsState?.progress_percent ?? job.progress_percent
  const message = wsState?.progress_message || job.progress_message
  const currentStage = wsState?.current_stage || job.current_stage

  const isActive = ['validating', 'fetching_config', 'converting', 'uploading', 'creating_vm'].includes(status)

  async function handlePasswordSubmit() {
    if (passwordModal === 'retry') {
      await retryMigration(jobId, { vmware_password: vmwarePass, scale_password: scalePass })
    } else if (passwordModal === 'resume') {
      await startMigration(jobId, { vmware_password: vmwarePass, scale_password: scalePass })
    }
    setPasswordModal(null)
    setVmwarePass('')
    setScalePass('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.vm_name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {job.vmware_host} &rarr; {job.scale_host}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {isActive && (
            <>
              <button
                onClick={() => pauseMigration(jobId)}
                className="rounded-md border p-2 text-orange-600 hover:bg-orange-50"
                title="Pause"
              >
                <Pause className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowCancel(true)}
                className="rounded-md border p-2 text-red-600 hover:bg-red-50"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          {status === 'paused' && (
            <button
              onClick={() => setPasswordModal('resume')}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
          )}
          {(status === 'failed' || status === 'cancelled') && (
            <button
              onClick={() => setPasswordModal('retry')}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </button>
          )}
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="rounded-lg border bg-white p-4">
        <StageIndicator currentStage={currentStage} status={status} />
      </div>

      {/* Progress */}
      <MigrationProgress percent={progress} message={message} status={status} />

      {/* VM Info */}
      {job.vm_cpu_count > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700">VM Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><span className="text-gray-500">CPU:</span> {job.vm_cpu_count} vCPU</div>
            <div><span className="text-gray-500">Memory:</span> {Math.round(job.vm_memory_bytes / 1024 / 1024)} MB</div>
            <div><span className="text-gray-500">Disks:</span> {job.disk_count}</div>
            <div><span className="text-gray-500">Status:</span> {status}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'failed' && job.error_message && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-700">{job.error_message}</p>
        </div>
      )}

      {/* Scale VM UUID */}
      {job.scale_vm_uuid && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-medium text-green-800">VM Created on SC// Platform</h3>
          <p className="mt-1 text-sm text-green-700">UUID: {job.scale_vm_uuid}</p>
        </div>
      )}

      {/* Logs */}
      <MigrationLogs jobId={jobId} />

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={showCancel}
        title="Cancel Migration"
        message={`Are you sure you want to cancel the migration of "${job.vm_name}"? This will terminate the current operation.`}
        confirmLabel="Cancel Migration"
        variant="danger"
        onConfirm={() => { cancelMigration(jobId); setShowCancel(false) }}
        onCancel={() => setShowCancel(false)}
      />

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {passwordModal === 'retry' ? 'Retry Migration' : 'Resume Migration'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">Enter credentials to continue.</p>
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="VMware Password"
                value={vmwarePass}
                onChange={(e) => setVmwarePass(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="Scale Password"
                value={scalePass}
                onChange={(e) => setScalePass(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setPasswordModal(null); setVmwarePass(''); setScalePass('') }}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!vmwarePass || !scalePass}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {passwordModal === 'retry' ? 'Retry' : 'Resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
