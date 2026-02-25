import { Monitor, Power, PowerOff, AlertTriangle } from 'lucide-react'
import type { VmInfo } from '../../types/vmware'

interface Props {
  vm: VmInfo
  selected: boolean
  onToggle: () => void
}

export function VmCard({ vm, selected, onToggle }: Props) {
  const stateIcon = vm.state === 'poweredOn' ? (
    <Power className="h-3 w-3 text-green-500" />
  ) : vm.state === 'poweredOff' ? (
    <PowerOff className="h-3 w-3 text-gray-400" />
  ) : (
    <AlertTriangle className="h-3 w-3 text-yellow-500" />
  )

  return (
    <label
      className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
        vm.can_migrate
          ? 'cursor-pointer hover:bg-gray-50'
          : 'cursor-not-allowed opacity-50'
      } ${selected ? 'border-blue-500 bg-blue-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!vm.can_migrate}
        onChange={onToggle}
        className="rounded"
      />
      <Monitor className="h-5 w-5 text-gray-400" />
      <div className="flex-1">
        <div className="font-medium text-gray-900">{vm.name}</div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {stateIcon}
          <span>{vm.state}</span>
          {!vm.can_migrate && (
            <span className="ml-2 text-orange-500">
              (must be powered off to migrate)
            </span>
          )}
        </div>
      </div>
    </label>
  )
}
