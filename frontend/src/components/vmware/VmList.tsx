import { VmCard } from './VmCard'
import type { VmInfo } from '../../types/vmware'

interface Props {
  vms: VmInfo[]
  selectedVms: Set<string>
  onToggle: (name: string) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
}

export function VmList({ vms, selectedVms, onToggle, onSelectAll, onDeselectAll }: Props) {
  const migratableCount = vms.filter((v) => v.can_migrate).length
  const allSelected = migratableCount > 0 && migratableCount === selectedVms.size

  return (
    <div className="space-y-3">
      {/* Selection controls */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {selectedVms.size} of {migratableCount} eligible VM{migratableCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          {onSelectAll && (
            <button
              onClick={onSelectAll}
              disabled={allSelected}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              Select All
            </button>
          )}
          {onDeselectAll && selectedVms.size > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <button
                onClick={onDeselectAll}
                className="text-blue-600 hover:text-blue-800"
              >
                Deselect All
              </button>
            </>
          )}
        </div>
      </div>

      {/* VM list */}
      <div className="max-h-96 space-y-2 overflow-auto">
        {vms.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No VMs found.</p>
        ) : (
          vms.map((vm) => (
            <VmCard
              key={vm.name}
              vm={vm}
              selected={selectedVms.has(vm.name)}
              onToggle={() => onToggle(vm.name)}
            />
          ))
        )}
      </div>
    </div>
  )
}
