import { useState } from 'react'
import { useMigrations } from '../hooks/useMigrations'
import { MigrationCard } from '../components/migration/MigrationCard'

const filters = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Paused', value: 'paused' },
  { label: 'Pending', value: 'pending' },
]

export function MigrationList() {
  const [filter, setFilter] = useState('')
  const { data: jobs, isLoading } = useMigrations()

  const activeStatuses = ['validating', 'fetching_config', 'converting', 'uploading', 'creating_vm']

  const filtered = jobs?.filter((j) => {
    if (!filter) return true
    if (filter === 'active') return activeStatuses.includes(j.status)
    return j.status === filter
  }) || []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Migrations</h1>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          No migrations found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <MigrationCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
