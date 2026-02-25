import { ProgressBar } from '../common/ProgressBar'

interface DiskInfo {
  name: string
  size_bytes: number
  progress_percent: number
  status: 'pending' | 'converting' | 'uploading' | 'completed' | 'failed'
}

interface Props {
  disks: DiskInfo[]
}

export function DiskProgress({ disks }: Props) {
  if (disks.length === 0) return null

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Disk Progress</h3>
      {disks.map((disk) => {
        const color =
          disk.status === 'completed' ? 'bg-green-500' :
          disk.status === 'failed' ? 'bg-red-500' :
          disk.status === 'converting' ? 'bg-blue-500' :
          disk.status === 'uploading' ? 'bg-purple-500' :
          'bg-gray-300'

        const sizeLabel = disk.size_bytes > 0
          ? `${(disk.size_bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
          : 'Unknown size'

        return (
          <div key={disk.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">{disk.name}</span>
              <span className="text-gray-500">
                {sizeLabel} &middot;{' '}
                <span className={
                  disk.status === 'completed' ? 'text-green-600' :
                  disk.status === 'failed' ? 'text-red-600' :
                  disk.status === 'pending' ? 'text-gray-400' :
                  'text-blue-600'
                }>
                  {disk.status}
                </span>
              </span>
            </div>
            <ProgressBar
              percent={disk.progress_percent}
              color={color}
              size="sm"
              showLabel={false}
            />
          </div>
        )
      })}
    </div>
  )
}
