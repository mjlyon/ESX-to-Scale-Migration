import { Link } from 'react-router-dom'
import type { MigrationJob } from '../../types/migration'
import { StatusBadge } from '../common/StatusBadge'
import { ProgressBar } from '../common/ProgressBar'
import { useMigrationStore } from '../../store/migrationStore'

export function MigrationCard({ job }: { job: MigrationJob }) {
  const wsState = useMigrationStore((s) => s.jobs[job.id])
  const status = wsState?.status || job.status
  const progress = wsState?.progress_percent ?? job.progress_percent
  const message = wsState?.progress_message || job.progress_message

  const isActive = ['validating', 'fetching_config', 'converting', 'uploading', 'creating_vm'].includes(status)

  return (
    <Link
      to={`/migrations/${job.id}`}
      className="block rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{job.vm_name}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {job.vmware_host} &rarr; {job.scale_host}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      {isActive && (
        <div className="mt-3">
          <ProgressBar percent={progress} size="sm" />
          <p className="mt-1 text-xs text-gray-500 truncate">{message}</p>
        </div>
      )}
      {status === 'failed' && job.error_message && (
        <p className="mt-2 text-xs text-red-600 truncate">{job.error_message}</p>
      )}
      <div className="mt-2 text-xs text-gray-400">
        {job.created_at && new Date(job.created_at).toLocaleString()}
      </div>
    </Link>
  )
}
