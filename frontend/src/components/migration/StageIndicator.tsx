import { clsx } from 'clsx'
import { Check } from 'lucide-react'

const stages = [
  { key: 'validating', label: 'Validate' },
  { key: 'fetching_config', label: 'Config' },
  { key: 'converting', label: 'Convert' },
  { key: 'uploading', label: 'Upload' },
  { key: 'creating_vm', label: 'Create VM' },
]

const stageOrder = stages.map((s) => s.key)

export function StageIndicator({ currentStage, status }: { currentStage: string; status: string }) {
  const currentIdx = stageOrder.indexOf(currentStage)
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  return (
    <div className="flex items-center justify-between">
      {stages.map((stage, i) => {
        const isDone = isCompleted || (currentIdx > i)
        const isActive = currentStage === stage.key && !isCompleted
        const isCurrent = isActive && !isFailed

        return (
          <div key={stage.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                  isDone ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                  isActive && isFailed ? 'bg-red-500 text-white' :
                  'bg-gray-200 text-gray-500',
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={clsx(
                'mt-1 text-xs',
                isDone ? 'text-green-600 font-medium' :
                isActive ? 'text-blue-600 font-medium' :
                'text-gray-400',
              )}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={clsx(
                'mx-2 h-0.5 flex-1',
                isDone ? 'bg-green-500' : 'bg-gray-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
