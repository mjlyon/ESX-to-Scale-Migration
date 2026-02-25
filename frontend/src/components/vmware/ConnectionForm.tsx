import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { testVmwareConnection } from '../../api/vmware'

interface Props {
  onConnect: (data: {
    host: string
    username: string
    password: string
    connection_type: string
  }) => void
  loading?: boolean
  submitLabel?: string
}

export function ConnectionForm({ onConnect, loading = false, submitLabel = 'Connect' }: Props) {
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connType, setConnType] = useState('vcenter')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testVmwareConnection({
        host, username, password,
        connection_type: connType,
        insecure: true,
      })
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ success: false, message: e.response?.data?.detail || e.message })
    }
    setTesting(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConnect({ host, username, password, connection_type: connType })
  }

  const canSubmit = host && username && password && !loading

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={connType === 'vcenter'} onChange={() => setConnType('vcenter')} />
          vCenter
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={connType === 'esxi'} onChange={() => setConnType('esxi')} />
          ESXi Direct
        </label>
      </div>

      <input
        placeholder={connType === 'vcenter' ? 'vCenter host / IP' : 'ESXi host / IP'}
        value={host}
        onChange={(e) => setHost(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />

      {testResult && (
        <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.message}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !host || !username || !password}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
