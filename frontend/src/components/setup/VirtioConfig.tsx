import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  available: boolean
  path: string | null
}

export function VirtioConfig({ available, path }: Props) {
  if (available) {
    return (
      <div className="rounded-md bg-green-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">VirtIO drivers are available</span>
        </div>
        {path && <p className="text-sm text-green-600">Path: {path}</p>}
        <p className="text-xs text-gray-500">
          These drivers are required for Windows VMs to function properly after migration.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md bg-yellow-50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-yellow-700">
        <XCircle className="h-5 w-5" />
        <span className="font-medium">VirtIO drivers not found</span>
      </div>
      <p className="text-sm text-yellow-600">
        VirtIO drivers should be included in the container image. If they are missing,
        rebuild the container with the VirtIO ISO. Linux VMs do not require VirtIO drivers.
      </p>
      <div className="mt-2 rounded-md bg-yellow-100 p-3 text-xs text-yellow-800">
        <strong>Note:</strong> Without VirtIO drivers, Windows VM migrations may fail or
        the resulting VMs may not boot correctly. Linux VMs will work without them.
      </div>
    </div>
  )
}
