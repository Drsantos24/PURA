'use client'

import { useState, useRef, useCallback } from 'react'

type DocType = 'care_plan_template' | 'intake_packet' | 'patient_letter_template' | 'sop' | 'training_material' | 'other'

type Doc = {
  id: string
  document_type: DocType
  file_name: string
  summary: string | null
  char_count: number | null
  uploaded_at: string
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  care_plan_template:      'Care Plan Template',
  intake_packet:           'Intake Packet',
  patient_letter_template: 'Patient Letter',
  sop:                     'SOP',
  training_material:       'Training Material',
  other:                   'Other',
}

const primaryBtn  = 'rounded-md bg-magenta px-5 py-2 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'
const dangerBtn   = 'rounded-md border border-danger/30 px-3 py-1 text-xs font-sans text-danger hover:bg-danger/10 transition-colors'
const selectCls   = 'rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-primary focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'

export function DocumentsManager({ initialDocs }: { initialDocs: Doc[] }) {
  const [docs, setDocs]         = useState<Doc[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [docType, setDocType]     = useState<DocType>('other')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<{ fileName: string; chunks: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', docType)
      const res  = await fetch('/api/documents', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setUploadError(json.error ?? 'Upload failed'); return }
      setDocs(prev => [json.document, ...prev])
      setUploadResult({ fileName: json.document.file_name, chunks: json.chunks_stored })
    } finally {
      setUploading(false)
    }
  }, [docType])

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? This also removes its embeddings.')) return
    const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== id))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-sans font-medium text-text-muted uppercase tracking-widest">Document type</label>
          <select value={docType} onChange={e => setDocType(e.target.value as DocType)} className={selectCls}>
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
            dragOver ? 'border-magenta bg-magenta/5' : 'border-border hover:border-magenta/40',
            uploading ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} />
          <div className="text-center space-y-1">
            <p className="text-sm font-sans text-text-primary">
              {uploading ? 'Processing…' : 'Drop a file here or click to upload'}
            </p>
            <p className="text-xs font-sans text-text-muted">PDF, DOCX, TXT, MD — max 10 MB</p>
          </div>
          {!uploading && (
            <button type="button" className={primaryBtn} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
              Choose file
            </button>
          )}
          {uploading && (
            <div className="w-8 h-8 rounded-full border-2 border-magenta/30 border-t-magenta animate-spin" />
          )}
        </div>

        {uploadError && (
          <p className="rounded-md bg-danger/10 px-4 py-2 text-sm font-sans text-danger">{uploadError}</p>
        )}
        {uploadResult && (
          <p className="rounded-md bg-signal-green/10 px-4 py-2 text-sm font-sans text-signal-green">
            ✓ &ldquo;{uploadResult.fileName}&rdquo; uploaded — {uploadResult.chunks} chunks indexed for RAG
          </p>
        )}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="text-sm font-sans text-text-muted/60 text-center py-8">
          No documents yet. Upload your care plan template or clinic philosophy doc to start.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">
            {docs.length} document{docs.length !== 1 ? 's' : ''} uploaded
          </p>
          {docs.map(doc => (
            <div key={doc.id} className="rounded-md border border-border bg-surface/30 p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-sans font-medium text-text-primary truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-magenta/70 bg-magenta/10 px-1.5 py-0.5 rounded">
                      {DOC_TYPE_LABELS[doc.document_type]}
                    </span>
                    {doc.char_count && (
                      <span className="text-xs font-sans text-text-muted">
                        {(doc.char_count / 1000).toFixed(1)}k chars
                      </span>
                    )}
                    <span className="text-xs font-sans text-text-muted">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(doc.id)} className={dangerBtn}>Delete</button>
              </div>
              {doc.summary && (
                <p className="text-xs font-sans text-text-muted leading-relaxed border-t border-border/50 pt-2">
                  {doc.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
