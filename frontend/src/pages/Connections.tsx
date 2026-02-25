import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Server, Cpu } from 'lucide-react'
import {
  getVmwareConnections,
  createVmwareConnection,
  deleteVmwareConnection,
  testVmwareConnection,
} from '../api/vmware'
import {
  getScaleConnections,
  createScaleConnection,
  deleteScaleConnection,
  testScaleConnection,
} from '../api/scale'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import type { VmwareConnection } from '../types/vmware'
import type { ScaleConnection } from '../types/scale'

type Tab = 'vmware' | 'scale'

export function Connections() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('vmware')
  const [showVmwareForm, setShowVmwareForm] = useState(false)
  const [showScaleForm, setShowScaleForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: Tab; id: number; name: string } | null>(null)

  // VMware form
  const [vmName, setVmName] = useState('')
  const [vmHost, setVmHost] = useState('')
  const [vmUser, setVmUser] = useState('')
  const [vmPass, setVmPass] = useState('')
  const [vmConnType, setVmConnType] = useState('vcenter')
  const [vmTestResult, setVmTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [vmSaving, setVmSaving] = useState(false)

  // Scale form
  const [scName, setScName] = useState('')
  const [scHost, setScHost] = useState('')
  const [scUser, setScUser] = useState('admin')
  const [scPass, setScPass] = useState('')
  const [scTestResult, setScTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [scSaving, setScSaving] = useState(false)

  const { data: vmwareConns, isLoading: loadingVmware } = useQuery({
    queryKey: ['vmware-conns'],
    queryFn: getVmwareConnections,
  })

  const { data: scaleConns, isLoading: loadingScale } = useQuery({
    queryKey: ['scale-conns'],
    queryFn: getScaleConnections,
  })

  const deleteVmwareMut = useMutation({
    mutationFn: deleteVmwareConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vmware-conns'] }),
  })

  const deleteScaleMut = useMutation({
    mutationFn: deleteScaleConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scale-conns'] }),
  })

  function resetVmwareForm() {
    setVmName(''); setVmHost(''); setVmUser(''); setVmPass(''); setVmConnType('vcenter')
    setVmTestResult(null); setShowVmwareForm(false)
  }

  function resetScaleForm() {
    setScName(''); setScHost(''); setScUser('admin'); setScPass('')
    setScTestResult(null); setShowScaleForm(false)
  }

  async function handleTestVmware() {
    try {
      const result = await testVmwareConnection({
        host: vmHost, username: vmUser, password: vmPass,
        connection_type: vmConnType, insecure: true,
      })
      setVmTestResult(result)
    } catch (e: any) {
      setVmTestResult({ success: false, message: e.response?.data?.detail || e.message })
    }
  }

  async function handleSaveVmware() {
    setVmSaving(true)
    try {
      await createVmwareConnection({
        name: vmName || vmHost, host: vmHost, username: vmUser,
        connection_type: vmConnType, insecure: 'true', vcenter_hint: '',
      })
      queryClient.invalidateQueries({ queryKey: ['vmware-conns'] })
      resetVmwareForm()
    } catch (e: any) {
      setVmTestResult({ success: false, message: e.response?.data?.detail || e.message })
    }
    setVmSaving(false)
  }

  async function handleTestScale() {
    try {
      const result = await testScaleConnection({
        host: scHost, username: scUser, password: scPass,
      })
      setScTestResult(result)
    } catch (e: any) {
      setScTestResult({ success: false, message: e.response?.data?.detail || e.message })
    }
  }

  async function handleSaveScale() {
    setScSaving(true)
    try {
      await createScaleConnection({
        name: scName || scHost, host: scHost, username: scUser,
        verify_tls: 'false',
      })
      queryClient.invalidateQueries({ queryKey: ['scale-conns'] })
      resetScaleForm()
    } catch (e: any) {
      setScTestResult({ success: false, message: e.response?.data?.detail || e.message })
    }
    setScSaving(false)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'vmware') {
      deleteVmwareMut.mutate(deleteTarget.id)
    } else {
      deleteScaleMut.mutate(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Connections</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('vmware')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'vmware' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Server className="h-4 w-4" /> VMware
        </button>
        <button
          onClick={() => setTab('scale')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'scale' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cpu className="h-4 w-4" /> SC// Platform
        </button>
      </div>

      {/* VMware Tab */}
      {tab === 'vmware' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowVmwareForm(!showVmwareForm)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add VMware Connection
            </button>
          </div>

          {showVmwareForm && (
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <h3 className="font-semibold">New VMware Connection</h3>
              <input
                placeholder="Connection name (optional)"
                value={vmName} onChange={(e) => setVmName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={vmConnType === 'vcenter'} onChange={() => setVmConnType('vcenter')} /> vCenter
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={vmConnType === 'esxi'} onChange={() => setVmConnType('esxi')} /> ESXi Direct
                </label>
              </div>
              <input
                placeholder="Host / IP"
                value={vmHost} onChange={(e) => setVmHost(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Username"
                value={vmUser} onChange={(e) => setVmUser(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="password" placeholder="Password (for testing only, not saved)"
                value={vmPass} onChange={(e) => setVmPass(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />

              {vmTestResult && (
                <p className={`text-sm ${vmTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {vmTestResult.message}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={resetVmwareForm} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleTestVmware}
                  disabled={!vmHost || !vmUser || !vmPass}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  onClick={handleSaveVmware}
                  disabled={vmSaving || !vmHost || !vmUser}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {vmSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {loadingVmware ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : vmwareConns && vmwareConns.length > 0 ? (
            <div className="space-y-2">
              {vmwareConns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-gray-500">
                      {c.host} &middot; {c.connection_type} &middot; {c.username}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: 'vmware', id: c.id, name: c.name })}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
              No VMware connections saved yet.
            </div>
          )}
        </div>
      )}

      {/* Scale Tab */}
      {tab === 'scale' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowScaleForm(!showScaleForm)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Scale Connection
            </button>
          </div>

          {showScaleForm && (
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <h3 className="font-semibold">New SC// Platform Connection</h3>
              <input
                placeholder="Connection name (optional)"
                value={scName} onChange={(e) => setScName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Cluster IP / hostname"
                value={scHost} onChange={(e) => setScHost(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                placeholder="Username"
                value={scUser} onChange={(e) => setScUser(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="password" placeholder="Password (for testing only, not saved)"
                value={scPass} onChange={(e) => setScPass(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />

              {scTestResult && (
                <p className={`text-sm ${scTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {scTestResult.message}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={resetScaleForm} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleTestScale}
                  disabled={!scHost || !scUser || !scPass}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  onClick={handleSaveScale}
                  disabled={scSaving || !scHost || !scUser}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {scSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {loadingScale ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : scaleConns && scaleConns.length > 0 ? (
            <div className="space-y-2">
              {scaleConns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-gray-500">{c.host} &middot; {c.username}</div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: 'scale', id: c.id, name: c.name })}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
              No Scale connections saved yet.
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Connection"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
