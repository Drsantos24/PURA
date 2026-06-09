'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { parseRows, normalizePhone, type ParsedRow } from '@/lib/import/parse'

const primaryBtn = 'rounded-md bg-magenta px-5 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'
const ghostBtn   = 'rounded-md border border-border px-4 py-2 text-sm font-sans text-text-muted hover:border-text-muted transition-colors'

type Stage = 'upload' | 'preview' | 'committing' | 'done'

const STATUS_BG: Record<ParsedRow['status'], string> = {
  valid:   'bg-signal-green/5 border-signal-green/20',
  warning: 'bg-amber-400/5 border-amber-400/20',
  error:   'bg-danger/5 border-danger/20',
}
const STATUS_DOT: Record<ParsedRow['status'], string> = {
  valid:   'bg-signal-green',
  warning: 'bg-amber-400',
  error:   'bg-danger',
}

async function parseFile(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv' || file.type === 'text/csv') {
    const { default: Papa } = await import('papaparse')
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: r => resolve(r.data as Record<string, string>[]),
        error: reject,
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const ab   = await file.arrayBuffer()
    const wb   = XLSX.read(ab, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[]
  }

  throw new Error('Unsupported file type — use CSV or XLSX')
}

export function ImportWizard({ redirectTo }: { redirectTo: string }) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage,     setStage]     = useState<Stage>('upload')
  const [dragOver,  setDragOver]  = useState(false)
  const [rows,      setRows]      = useState<ParsedRow[]>([])
  const [filename,  setFilename]  = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [imported,  setImported]  = useState(0)
  const [editIdx,   setEditIdx]   = useState<number | null>(null)
  const [editVals,  setEditVals]  = useState<Partial<ParsedRow>>({})

  const process = useCallback(async (file: File) => {
    setError(null)
    setFilename(file.name)
    try {
      const raw = await parseFile(file)
      if (raw.length === 0) { setError('File appears empty or has no data rows'); return }
      if (raw.length > 2000) { setError('Max 2000 rows per import'); return }

      // Fetch existing phones/emails for dupe detection
      const dupRes  = await fetch('/api/patients/import')
      const dupData = dupRes.ok ? await dupRes.json() : { phones: [], emails: [] }
      const existingPhones = new Set<string>(dupData.phones ?? [])
      const existingEmails = new Set<string>(dupData.emails ?? [])

      const parsed = parseRows(raw, existingPhones, existingEmails)
      setRows(parsed)
      setStage('preview')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) process(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) process(file)
    e.target.value = ''
  }

  function saveEdit(idx: number) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, ...editVals }
      // Re-validate phone
      const issues: string[] = []
      if (!updated.first_name) issues.push('Missing first name')
      if (updated.phone_number) {
        const norm = normalizePhone(updated.phone_number)
        updated.phone_number = norm
        if (!/^\+1\d{10}$/.test(norm)) issues.push(`Phone "${updated.phone_number}" could not be normalized`)
      }
      if (!updated.phone_number && !updated.email) issues.push('Must have phone or email')
      const hasBlocker = issues.some(i => i.startsWith('Missing') || i.startsWith('Must'))
      updated.status = hasBlocker ? 'error' : issues.length > 0 ? 'warning' : 'valid'
      updated.issues = issues
      return updated
    }))
    setEditIdx(null)
    setEditVals({})
  }

  async function commit() {
    const toSend = rows.filter(r => r.status !== 'error')
    if (toSend.length === 0) { setError('No valid rows to import'); return }
    setStage('committing')
    const res = await fetch('/api/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: toSend, filename }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Import failed'); setStage('preview'); return }
    setImported(data.imported)
    setStage('done')
  }

  const valid    = rows.filter(r => r.status === 'valid').length
  const warnings = rows.filter(r => r.status === 'warning').length
  const errors   = rows.filter(r => r.status === 'error').length

  // ── Upload stage ─────────────────────────────────────────────
  if (stage === 'upload') return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 cursor-pointer transition-colors',
          dragOver ? 'border-magenta bg-magenta/5' : 'border-border hover:border-magenta/40',
        ].join(' ')}
      >
        <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
        <div className="text-center space-y-1">
          <p className="text-sm font-sans text-text-primary">Drop your patient list here or click to upload</p>
          <p className="text-xs font-sans text-text-muted">CSV or Excel — up to 2,000 patients</p>
          <p className="text-xs font-sans text-text-muted/60">
            Any column order. Handles messy phone formats, extra spaces, missing fields.
          </p>
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click() }} className={primaryBtn}>
          Choose file
        </button>
      </div>
      {error && <p className="rounded-md bg-danger/10 px-4 py-2 text-sm font-sans text-danger">{error}</p>}
    </div>
  )

  // ── Preview stage ─────────────────────────────────────────────
  if (stage === 'preview') return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-md border border-border bg-surface/30 px-4 py-3">
        <p className="text-xs font-sans text-text-muted flex-1">
          <span className="font-medium text-text-primary">{rows.length} rows</span> in <span className="font-mono">{filename}</span>
        </p>
        <div className="flex gap-3 text-xs font-sans">
          {valid > 0    && <span className="text-signal-green">{valid} valid</span>}
          {warnings > 0 && <span className="text-amber-400">{warnings} warnings</span>}
          {errors > 0   && <span className="text-danger">{errors} errors</span>}
        </div>
      </div>

      {error && <p className="rounded-md bg-danger/10 px-4 py-2 text-sm font-sans text-danger">{error}</p>}

      {/* Row table */}
      <div className="rounded-md border border-border overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-xs font-sans">
          <thead className="bg-surface sticky top-0">
            <tr className="border-b border-border">
              {['', 'Name', 'Phone', 'Email', 'Complaint', 'Issues'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-text-muted font-medium uppercase tracking-wide text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={`border-b border-border/40 ${STATUS_BG[row.status]}`}>
                <td className="px-3 py-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[row.status]}`} />
                </td>
                <td className="px-3 py-2 text-text-primary">
                  {editIdx === idx ? (
                    <div className="flex gap-1">
                      <input value={editVals.first_name ?? row.first_name} onChange={e => setEditVals(v => ({...v, first_name: e.target.value}))}
                        className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs" placeholder="First" />
                      <input value={editVals.last_name ?? row.last_name} onChange={e => setEditVals(v => ({...v, last_name: e.target.value}))}
                        className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs" placeholder="Last" />
                    </div>
                  ) : (
                    <span>{row.first_name} {row.last_name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-text-muted font-mono">
                  {editIdx === idx ? (
                    <input value={editVals.phone_number ?? row.phone_number} onChange={e => setEditVals(v => ({...v, phone_number: e.target.value}))}
                      className="w-28 rounded border border-border bg-background px-1 py-0.5 text-xs font-mono" />
                  ) : row.phone_number}
                </td>
                <td className="px-3 py-2 text-text-muted max-w-[140px] truncate">{row.email ?? '—'}</td>
                <td className="px-3 py-2 text-text-muted max-w-[120px] truncate">{row.chief_complaint ?? '—'}</td>
                <td className="px-3 py-2">
                  {row.issues.length > 0 ? (
                    <div className="space-y-0.5">
                      {row.issues.map((issue, i) => (
                        <p key={i} className={`text-[10px] ${row.status === 'error' ? 'text-danger' : 'text-amber-400'}`}>{issue}</p>
                      ))}
                    </div>
                  ) : null}
                  {editIdx === idx ? (
                    <button type="button" onClick={() => saveEdit(idx)} className="text-[10px] text-signal-green underline">Save</button>
                  ) : row.status !== 'valid' ? (
                    <button type="button" onClick={() => { setEditIdx(idx); setEditVals({}) }} className="text-[10px] text-magenta underline">Fix</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { setStage('upload'); setRows([]) }} className={ghostBtn}>
          ← Choose different file
        </button>
        <div className="flex items-center gap-3">
          <p className="text-xs font-sans text-text-muted">
            Will import {valid + warnings} patient{valid + warnings !== 1 ? 's' : ''}
            {errors > 0 ? `, skip ${errors} error row${errors !== 1 ? 's' : ''}` : ''}
          </p>
          <button type="button" onClick={commit} disabled={valid + warnings === 0} className={primaryBtn}>
            Import {valid + warnings} patients
          </button>
        </div>
      </div>
    </div>
  )

  // ── Committing stage ──────────────────────────────────────────
  if (stage === 'committing') return (
    <div className="flex flex-col items-center justify-center h-48 gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-magenta/30 border-t-magenta animate-spin" />
      <p className="text-sm font-sans text-text-muted">Importing patients…</p>
    </div>
  )

  // ── Done stage ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
      <p className="text-signal-green text-2xl">✓</p>
      <p className="font-sans text-sm text-text-primary font-medium">
        {imported} patient{imported !== 1 ? 's' : ''} imported successfully
      </p>
      <button type="button" onClick={() => router.push(redirectTo)} className={primaryBtn}>
        Continue →
      </button>
    </div>
  )
}
