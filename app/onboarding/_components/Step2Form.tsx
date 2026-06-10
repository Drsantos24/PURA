'use client'
import { useState, useCallback } from 'react'
import { importPatients } from '../actions'

type Mode = 'csv' | 'manual'

interface ManualPatient {
  first_name: string
  last_name: string
  phone_number: string
  email: string
  chief_complaint: string
}

interface CSVPreview {
  headers: string[]
  rows: string[][]
  total: number
  skipped: number
}

const emptyPatient = (): ManualPatient => ({
  first_name: '', last_name: '', phone_number: '', email: '', chief_complaint: '',
})

// Client-side CSV parser — for preview display only.
// The server re-parses the actual file independently on import.
function previewCSV(text: string, maxRows = 5): CSVPreview {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [], total: 0, skipped: 0 }

  const splitLine = (line: string) => {
    const vals: string[] = []; let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue }
      cur += ch
    }
    vals.push(cur)
    return vals.map(v => v.trim())
  }

  const headers = splitLine(lines[0])
  const hLower  = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''))

  const idx = (aliases: string[]) => {
    for (const a of aliases) { const i = hLower.indexOf(a); if (i >= 0) return i }
    return -1
  }

  const fnIdx    = idx(['firstname', 'first_name', 'first'])
  const phoneIdx = idx(['phone', 'phonenumber', 'phone_number', 'mobile', 'cell'])
  const emailIdx = idx(['email', 'emailaddress', 'email_address'])

  const valid: string[][] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = splitLine(lines[i])
    const fn    = fnIdx    >= 0 ? vals[fnIdx]    : ''
    const phone = phoneIdx >= 0 ? vals[phoneIdx] : ''
    const email = emailIdx >= 0 ? vals[emailIdx] : ''
    if (!fn || (!phone && !email)) { skipped++; continue }
    valid.push(vals)
  }

  return { headers, rows: valid.slice(0, maxRows), total: valid.length, skipped }
}

export function Step2Form({
  clinicId,
  error,
  alreadyImported,
  alreadyCount,
}: {
  clinicId: string
  error?: string
  alreadyImported: boolean
  alreadyCount: number
}) {
  const [mode, setMode]           = useState<Mode>('csv')
  const [preview, setPreview]     = useState<CSVPreview | null>(null)
  const [manual, setManual]       = useState<ManualPatient[]>([emptyPatient()])
  const [fileSelected, setFileSelected] = useState(false)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setPreview(null); setFileSelected(false); return }
    setFileSelected(true)
    const reader = new FileReader()
    reader.onload = ev => {
      const p = previewCSV(ev.target?.result as string)
      setPreview(p)
    }
    reader.readAsText(file)
  }, [])

  const updateManual = (i: number, field: keyof ManualPatient, value: string) =>
    setManual(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  const removeManual = (i: number) =>
    setManual(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  if (alreadyImported) {
    return (
      <form action={importPatients} className="space-y-6">
        <input type="hidden" name="clinic_id" value={clinicId} />
        <input type="hidden" name="mode" value="skip" />
        <div className="rounded-md bg-signal-green/10 px-5 py-4 text-sm font-sans text-signal-green">
          ✓ {alreadyCount} patient{alreadyCount !== 1 ? 's' : ''} already imported.
        </div>
        <div className="flex items-center justify-between pt-2">
          <a href="/onboarding?step=1" className={secondaryBtn}>← Back</a>
          <a href="/onboarding?step=3" className={primaryBtn}>Next →</a>
        </div>
      </form>
    )
  }

  return (
    <form action={importPatients} className="space-y-6">
      <input type="hidden" name="clinic_id" value={clinicId} />
      <input type="hidden" name="mode" value={mode} />

      <p className="text-sm font-sans text-text-muted leading-relaxed">
        PURA will send each patient a 60-second daily check-in via SMS. Import your active roster here — first name, last name, and mobile number are all you need to get started.
      </p>

      {error && (
        <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-sans text-danger">{error}</p>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-md border border-border overflow-hidden">
        {(['csv', 'manual'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 text-sm font-sans transition-colors ${
              mode === m
                ? 'bg-magenta text-background font-medium'
                : 'bg-surface text-text-muted hover:text-text-primary'
            }`}
          >
            {m === 'csv' ? 'CSV Upload' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {/* ── CSV mode ── */}
      {mode === 'csv' && (
        <div className="space-y-4">
          <p className="text-xs font-sans text-text-muted">
            Required columns: <code className="font-mono text-text-primary">first_name</code>,{' '}
            <code className="font-mono text-text-primary">phone_number</code> or{' '}
            <code className="font-mono text-text-primary">email</code>. Optional:{' '}
            <code className="font-mono text-text-primary">last_name</code>,{' '}
            <code className="font-mono text-text-primary">chief_complaint</code>.
          </p>

          <label className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-8 cursor-pointer hover:border-magenta/50 transition-colors">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-sans text-text-muted">
              {fileSelected ? 'File selected — see preview below' : 'Click to choose a .csv file'}
            </span>
            <input
              name="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="sr-only"
            />
          </label>

          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-sans">
                <span className="text-signal-green font-medium">{preview.total} patients ready to import</span>
                {preview.skipped > 0 && (
                  <span className="text-text-muted">, {preview.skipped} skipped (missing contact)</span>
                )}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      {preview.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-text-muted font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/50 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-text-primary">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.total > 5 && (
                  <p className="px-3 py-2 text-xs font-sans text-text-muted border-t border-border">
                    Showing first 5 of {preview.total} rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual mode ── */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <input type="hidden" name="patients_json" value={JSON.stringify(manual)} />
          {manual.map((patient, i) => (
            <div key={i} className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-muted">Patient {i + 1}</span>
                {manual.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeManual(i)}
                    className="text-xs font-sans text-text-muted hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" placeholder="First name *" required
                  value={patient.first_name}
                  onChange={e => updateManual(i, 'first_name', e.target.value)}
                  className={input}
                />
                <input
                  type="text" placeholder="Last name"
                  value={patient.last_name}
                  onChange={e => updateManual(i, 'last_name', e.target.value)}
                  className={input}
                />
                <input
                  type="tel" placeholder="Phone"
                  value={patient.phone_number}
                  onChange={e => updateManual(i, 'phone_number', e.target.value)}
                  className={input}
                />
                <input
                  type="email" placeholder="Email"
                  value={patient.email}
                  onChange={e => updateManual(i, 'email', e.target.value)}
                  className={input}
                />
              </div>
              <input
                type="text" placeholder="Chief complaint (optional)"
                value={patient.chief_complaint}
                onChange={e => updateManual(i, 'chief_complaint', e.target.value)}
                className={`${input} col-span-2`}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setManual(prev => [...prev, emptyPatient()])}
            className="text-sm font-sans text-magenta hover:opacity-80 transition-opacity"
          >
            + Add another patient
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <a href="/onboarding?step=1" className={secondaryBtn}>← Back</a>
        <button
          type="submit"
          disabled={mode === 'csv' && !fileSelected}
          className={`${primaryBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {mode === 'csv'
            ? preview ? `Import ${preview.total} Patient${preview.total !== 1 ? 's' : ''}` : 'Import Patients'
            : `Import ${manual.filter(p => p.first_name).length} Patient${manual.filter(p => p.first_name).length !== 1 ? 's' : ''}`
          }
        </button>
      </div>
    </form>
  )
}

const input       = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
const primaryBtn  = 'rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90'
const secondaryBtn= 'rounded-md border border-border px-6 py-2.5 text-sm font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors'
