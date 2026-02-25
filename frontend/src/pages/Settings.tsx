import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save, RefreshCw, Info } from 'lucide-react'
import { getSetupStatus } from '../api/setup'

export function Settings() {
  const [maxConcurrent, setMaxConcurrent] = useState('2')
  const [autoCleanup, setAutoCleanup] = useState(true)
  const [cleanupAfterHours, setCleanupAfterHours] = useState('72')
  const [logLevel, setLogLevel] = useState('info')
  const [useVddk, setUseVddk] = useState(true)
  const [saved, setSaved] = useState(false)

  const { data: status } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
  })

  function handleSave() {
    // In a real app, this would POST to the backend
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Migration Settings */}
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Migration Settings</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Max Concurrent Migrations</label>
          <p className="mb-1 text-xs text-gray-500">
            Number of migrations that can run simultaneously. Higher values require more system resources.
          </p>
          <select
            value={maxConcurrent}
            onChange={(e) => setMaxConcurrent(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useVddk}
              onChange={(e) => setUseVddk(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Use VDDK for disk access</span>
          </label>
          <p className="ml-6 text-xs text-gray-500">
            When enabled, uses VMware VDDK library for faster disk transfers.
            {status && !status.vddk.installed && (
              <span className="text-orange-600"> (VDDK not installed &mdash; go to Setup)</span>
            )}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Log Level</label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Cleanup Settings */}
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Cleanup</h2>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoCleanup}
              onChange={(e) => setAutoCleanup(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Auto-cleanup temporary files</span>
          </label>
          <p className="ml-6 text-xs text-gray-500">
            Automatically remove converted disk images after successful migration.
          </p>
        </div>

        {autoCleanup && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Cleanup After (hours)</label>
            <input
              type="number"
              min="1"
              max="720"
              value={cleanupAfterHours}
              onChange={(e) => setCleanupAfterHours(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* System Info */}
      {status && (
        <div className="rounded-lg border bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold">System Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">virt-v2v Version</div>
            <div className="font-medium">{status.system.virt_v2v_version || 'N/A'}</div>
            <div className="text-gray-500">CPU Cores</div>
            <div className="font-medium">{status.system.cpu_count}</div>
            <div className="text-gray-500">Total Memory</div>
            <div className="font-medium">{(status.system.memory_total_bytes / 1024 / 1024 / 1024).toFixed(1)} GB</div>
            <div className="text-gray-500">KVM Available</div>
            <div className="font-medium">{status.system.kvm_available ? 'Yes' : 'No'}</div>
            <div className="text-gray-500">VDDK Installed</div>
            <div className="font-medium">{status.vddk.installed ? 'Yes' : 'No'}</div>
            <div className="text-gray-500">VirtIO Drivers</div>
            <div className="font-medium">{status.virtio.available ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600">Settings saved!</span>
        )}
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </div>

      {/* Version footer */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Info className="h-3 w-3" />
        ESX to Scale Migration v2.0.0 &middot; Containerized Edition
      </div>
    </div>
  )
}
