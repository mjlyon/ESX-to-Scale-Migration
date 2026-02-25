import { useEffect, useRef } from 'react'
import { useMigrationStore } from '../store/migrationStore'
import { useConnectionStore } from '../store/connectionStore'

export function useWebSocket() {
  const updateJob = useMigrationStore((s) => s.updateJob)
  const appendLog = useMigrationStore((s) => s.appendLog)
  const setWsConnected = useConnectionStore((s) => s.setWsConnected)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        ws.send(JSON.stringify({ type: 'subscribe_all' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'job_update') {
            updateJob(msg.job_id, msg)
          } else if (msg.type === 'job_log') {
            appendLog(msg.job_id, {
              level: msg.level,
              line: msg.line,
              timestamp: msg.timestamp,
            })
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [updateJob, appendLog, setWsConnected])
}
