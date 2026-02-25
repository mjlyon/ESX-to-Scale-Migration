import { useEffect, useState } from 'react'
import { useMigrationStore } from '../../store/migrationStore'
import { getMigrationLogs } from '../../api/migrations'
import { LogViewer } from '../common/LogViewer'

export function MigrationLogs({ jobId }: { jobId: number }) {
  const wsLogs = useMigrationStore((s) => s.logs[jobId] || [])
  const [historicLogs, setHistoricLogs] = useState<{ level: string; line: string }[]>([])

  useEffect(() => {
    getMigrationLogs(jobId).then((data) => {
      setHistoricLogs(
        data.lines.map((line) => {
          const level = line.startsWith('[ERROR]') ? 'error' :
                        line.startsWith('[WARN]') ? 'warn' : 'info'
          return { level, line }
        }),
      )
    }).catch(() => {})
  }, [jobId])

  const allLogs = [...historicLogs, ...wsLogs]

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-700">Logs</h3>
      <LogViewer lines={allLogs} />
    </div>
  )
}
