import { ProgressBar } from '../common/ProgressBar'

interface Props {
  percent: number
  message: string
  status: string
}

export function MigrationProgress({ percent, message, status }: Props) {
  const color =
    status === 'completed' ? 'bg-green-500' :
    status === 'failed' ? 'bg-red-500' :
    status === 'paused' ? 'bg-orange-500' :
    'bg-blue-500'

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Overall Progress</h3>
        <span className="text-lg font-bold text-gray-900">{percent.toFixed(1)}%</span>
      </div>
      <div className="mt-2">
        <ProgressBar percent={percent} color={color} size="lg" showLabel={false} />
      </div>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  )
}
