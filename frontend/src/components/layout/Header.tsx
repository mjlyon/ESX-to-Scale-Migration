import { useConnectionStore } from '../../store/connectionStore'

export function Header() {
  const wsConnected = useConnectionStore((s) => s.wsConnected)

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-xs text-gray-500">
          {wsConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </header>
  )
}
