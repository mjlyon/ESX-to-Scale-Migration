import { clsx } from 'clsx'

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  validating: 'bg-blue-100 text-blue-700',
  fetching_config: 'bg-blue-100 text-blue-700',
  converting: 'bg-indigo-100 text-indigo-700',
  uploading: 'bg-purple-100 text-purple-700',
  creating_vm: 'bg-violet-100 text-violet-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-yellow-100 text-yellow-700',
  paused: 'bg-orange-100 text-orange-700',
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  validating: 'Validating',
  fetching_config: 'Fetching Config',
  converting: 'Converting',
  uploading: 'Uploading',
  creating_vm: 'Creating VM',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paused: 'Paused',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status] || 'bg-gray-100 text-gray-700',
      )}
    >
      {statusLabels[status] || status}
    </span>
  )
}
