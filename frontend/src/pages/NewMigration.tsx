import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { getVmwareConnections, listVmwareVms, testVmwareConnection } from '../api/vmware'
import { getScaleConnections, testScaleConnection } from '../api/scale'
import { createMigrations } from '../api/migrations'
import type { VmInfo } from '../types/vmware'

type Step = 'vmware' | 'vms' | 'scale' | 'review'

export function NewMigration() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('vmware')

  // VMware state
  const [vmwareHost, setVmwareHost] = useState('')
  const [vmwareUser, setVmwareUser] = useState('')
  const [vmwarePass, setVmwarePass] = useState('')
  const [connType, setConnType] = useState('vcenter')
  const [vmwareTesting, setVmwareTesting] = useState(false)
  const [vmwareOk, setVmwareOk] = useState(false)
  const [vmwareError, setVmwareError] = useState('')

  // VM selection
  const [vms, setVms] = useState<VmInfo[]>([])
  const [selectedVms, setSelectedVms] = useState<Set<string>>(new Set())
  const [loadingVms, setLoadingVms] = useState(false)

  // Scale state
  const [scaleHost, setScaleHost] = useState('')
  const [scaleUser, setScaleUser] = useState('admin')
  const [scalePass, setScalePass] = useState('')
  const [scaleTesting, setScaleTesting] = useState(false)
  const [scaleOk, setScaleOk] = useState(false)
  const [scaleError, setScaleError] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const { data: savedVmware } = useQuery({ queryKey: ['vmware-conns'], queryFn: getVmwareConnections })
  const { data: savedScale } = useQuery({ queryKey: ['scale-conns'], queryFn: getScaleConnections })

  async function handleTestVmware() {
    setVmwareTesting(true)
    setVmwareError('')
    try {
      const result = await testVmwareConnection({
        host: vmwareHost, username: vmwareUser, password: vmwarePass,
        connection_type: connType, insecure: true,
      })
      setVmwareOk(result.success)
      if (!result.success) setVmwareError(result.message)
    } catch (e: any) {
      setVmwareError(e.response?.data?.detail || e.message)
    }
    setVmwareTesting(false)
  }

  async function handleLoadVms() {
    setLoadingVms(true)
    try {
      const result = await listVmwareVms({
        host: vmwareHost, username: vmwareUser, password: vmwarePass,
        connection_type: connType, insecure: true,
      })
      setVms(result.vms)
      setStep('vms')
    } catch (e: any) {
      setVmwareError(e.response?.data?.detail || e.message)
    }
    setLoadingVms(false)
  }

  async function handleTestScale() {
    setScaleTesting(true)
    setScaleError('')
    try {
      const result = await testScaleConnection({
        host: scaleHost, username: scaleUser, password: scalePass,
      })
      setScaleOk(result.success)
      if (!result.success) setScaleError(result.message)
    } catch (e: any) {
      setScaleError(e.response?.data?.detail || e.message)
    }
    setScaleTesting(false)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const jobs = await createMigrations({
        vmware_host: vmwareHost,
        vmware_user: vmwareUser,
        vmware_password: vmwarePass,
        vmware_connection_type: connType,
        scale_host: scaleHost,
        scale_user: scaleUser,
        scale_password: scalePass,
        vms: Array.from(selectedVms).map((name) => ({ name })),
        auto_start: true,
      })
      if (jobs.length === 1) {
        navigate(`/migrations/${jobs[0].id}`)
      } else {
        navigate('/migrations')
      }
    } catch (e: any) {
      setScaleError(e.response?.data?.detail || e.message)
    }
    setSubmitting(false)
  }

  function toggleVm(name: string) {
    setSelectedVms((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Migration</h1>

      {/* Step indicators */}
      <div className="flex gap-2 text-sm">
        {(['vmware', 'vms', 'scale', 'review'] as Step[]).map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1 ${
              step === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i + 1}. {s === 'vmware' ? 'VMware' : s === 'vms' ? 'Select VMs' : s === 'scale' ? 'SC// Platform' : 'Review'}
          </span>
        ))}
      </div>

      {/* Step 1: VMware */}
      {step === 'vmware' && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">VMware Connection</h2>

          {savedVmware && savedVmware.length > 0 && (
            <div>
              <label className="text-sm text-gray-600">Use saved connection:</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                onChange={(e) => {
                  const c = savedVmware.find((x) => x.id === Number(e.target.value))
                  if (c) {
                    setVmwareHost(c.host)
                    setVmwareUser(c.username)
                    setConnType(c.connection_type)
                  }
                }}
              >
                <option value="">-- Select --</option>
                {savedVmware.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
                ))}
              </select>
            </div>
          )}

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
            placeholder={connType === 'vcenter' ? 'vCenter host/IP' : 'ESXi host/IP'}
            value={vmwareHost} onChange={(e) => setVmwareHost(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Username"
            value={vmwareUser} onChange={(e) => setVmwareUser(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="password" placeholder="Password"
            value={vmwarePass} onChange={(e) => setVmwarePass(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          {vmwareError && <p className="text-sm text-red-600">{vmwareError}</p>}
          {vmwareOk && <p className="text-sm text-green-600">Connection successful</p>}

          <div className="flex justify-between">
            <button
              onClick={handleTestVmware}
              disabled={vmwareTesting || !vmwareHost || !vmwareUser || !vmwarePass}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {vmwareTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleLoadVms}
              disabled={loadingVms || !vmwareHost || !vmwareUser || !vmwarePass}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingVms ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Load VMs
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select VMs */}
      {step === 'vms' && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Select VMs to Migrate</h2>
          <p className="text-sm text-gray-500">Select one or more VMs. Only powered-off VMs can be migrated.</p>

          <div className="max-h-96 space-y-2 overflow-auto">
            {vms.map((vm) => (
              <label
                key={vm.name}
                className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                  vm.can_migrate ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
                } ${selectedVms.has(vm.name) ? 'border-blue-500 bg-blue-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedVms.has(vm.name)}
                  disabled={!vm.can_migrate}
                  onChange={() => toggleVm(vm.name)}
                />
                <div>
                  <div className="font-medium">{vm.name}</div>
                  <div className="text-xs text-gray-500">State: {vm.state}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('vmware')} className="inline-flex items-center gap-1 text-sm text-gray-600">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep('scale')}
              disabled={selectedVms.size === 0}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Scale */}
      {step === 'scale' && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">SC// Platform Target</h2>

          {savedScale && savedScale.length > 0 && (
            <div>
              <label className="text-sm text-gray-600">Use saved connection:</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                onChange={(e) => {
                  const c = savedScale.find((x) => x.id === Number(e.target.value))
                  if (c) {
                    setScaleHost(c.host)
                    setScaleUser(c.username)
                  }
                }}
              >
                <option value="">-- Select --</option>
                {savedScale.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
                ))}
              </select>
            </div>
          )}

          <input
            placeholder="Scale cluster IP/hostname"
            value={scaleHost} onChange={(e) => setScaleHost(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Username"
            value={scaleUser} onChange={(e) => setScaleUser(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="password" placeholder="Password"
            value={scalePass} onChange={(e) => setScalePass(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          {scaleError && <p className="text-sm text-red-600">{scaleError}</p>}
          {scaleOk && <p className="text-sm text-green-600">Connection successful</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep('vms')} className="inline-flex items-center gap-1 text-sm text-gray-600">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleTestScale}
                disabled={scaleTesting || !scaleHost || !scaleUser || !scalePass}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {scaleTesting ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!scaleHost || !scaleUser || !scalePass}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Review <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 'review' && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Review & Start</h2>

          <div className="rounded-md bg-gray-50 p-4 text-sm space-y-2">
            <div><span className="font-medium">Source:</span> {vmwareHost} ({connType})</div>
            <div><span className="font-medium">Target:</span> {scaleHost}</div>
            <div><span className="font-medium">VMs ({selectedVms.size}):</span></div>
            <ul className="ml-4 list-disc">
              {Array.from(selectedVms).map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>

          {scaleError && <p className="text-sm text-red-600">{scaleError}</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep('scale')} className="inline-flex items-center gap-1 text-sm text-gray-600">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start Migration{selectedVms.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
