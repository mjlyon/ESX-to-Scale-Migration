import { useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadVddk, deleteVddk } from '../../api/setup'
import { FileUpload } from '../common/FileUpload'

interface Props {
  installed: boolean
  libPath: string | null
}

export function VddkUpload({ installed, libPath }: Props) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteVddk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      setSuccess(false)
    },
  })

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')
    setSuccess(false)
    try {
      await uploadVddk(file)
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message)
    }
    setUploading(false)
  }

  if (installed) {
    return (
      <div className="rounded-md bg-green-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">VDDK is installed</span>
        </div>
        {libPath && <p className="text-sm text-green-600">Library path: {libPath}</p>}
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          {deleteMutation.isPending ? 'Removing...' : 'Remove VDDK'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Upload the VMware VDDK tarball (.tar.gz). Download it from the VMware developer portal.
      </p>
      <FileUpload
        accept=".tar.gz,.tgz"
        onFile={handleUpload}
        label="Drop VMware VDDK tarball here (.tar.gz)"
        loading={uploading}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">VDDK uploaded and installed!</p>}
    </div>
  )
}
