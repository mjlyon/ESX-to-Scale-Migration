import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  accept?: string
  onFile: (file: File) => void
  label?: string
  loading?: boolean
}

export function FileUpload({ accept, onFile, label = 'Drop file here or click to browse', loading }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      } ${loading ? 'pointer-events-none opacity-50' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="mb-2 h-8 w-8 text-gray-400" />
      <span className="text-sm text-gray-600">{loading ? 'Uploading...' : label}</span>
      <input type="file" className="hidden" accept={accept} onChange={handleChange} />
    </label>
  )
}
