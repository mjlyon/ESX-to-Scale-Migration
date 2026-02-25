import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'

interface LogLine {
  level: string
  line: string
  timestamp?: string
}

export function LogViewer({ lines }: { lines: LogLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines.length])

  return (
    <div
      ref={containerRef}
      className="h-80 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-xs"
    >
      {lines.length === 0 && (
        <span className="text-gray-500">No log output yet...</span>
      )}
      {lines.map((l, i) => (
        <div key={i} className={clsx(
          'whitespace-pre-wrap',
          l.level === 'error' ? 'text-red-400' :
          l.level === 'warn' ? 'text-yellow-400' :
          'text-gray-300',
        )}>
          {l.line}
        </div>
      ))}
    </div>
  )
}
