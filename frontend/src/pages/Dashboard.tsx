import { Link } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import { useMigrations, useMigrationStats } from '../hooks/useMigrations'
import { MigrationCard } from '../components/migration/MigrationCard'

export function Dashboard() {
  const { data: stats } = useMigrationStats()
  const { data: jobs } = useMigrations()

  const activeJobs = jobs?.filter((j) =>
    ['validating', 'fetching_config', 'converting', 'uploading', 'creating_vm'].includes(j.status),
  ) || []
  const recentJobs = jobs?.slice(0, 5) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/migrations/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Migration
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Active', value: stats.active, color: 'text-blue-600' },
            { label: 'Pending', value: stats.pending, color: 'text-gray-500' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
            { label: 'Failed', value: stats.failed, color: 'text-red-600' },
            { label: 'Paused', value: stats.paused, color: 'text-orange-600' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-yellow-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border bg-white p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Active Migrations */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Active Migrations</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeJobs.map((job) => (
              <MigrationCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Migrations</h2>
          <Link
            to="/migrations"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
            No migrations yet. Click "New Migration" to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentJobs.map((job) => (
              <MigrationCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
