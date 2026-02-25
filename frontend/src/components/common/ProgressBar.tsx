import { clsx } from 'clsx'

interface Props {
  percent: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ProgressBar({ percent, color = 'bg-blue-500', size = 'md', showLabel = true }: Props) {
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-4' : 'h-2.5'
  return (
    <div className="w-full">
      <div className={clsx('w-full rounded-full bg-gray-200', h)}>
        <div
          className={clsx('rounded-full transition-all duration-300', h, color)}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {showLabel && (
        <span className="mt-1 text-xs text-gray-500">{percent.toFixed(1)}%</span>
      )}
    </div>
  )
}
