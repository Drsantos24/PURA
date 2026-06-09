'use client'

import { useState } from 'react'

type BaaVendor = {
  id: string
  name: string
  requestedDate: string
  signedDate: string
}

const INITIAL_VENDORS: BaaVendor[] = [
  { id: 'anthropic', name: 'Anthropic',  requestedDate: '', signedDate: '' },
  { id: 'openai',    name: 'OpenAI',     requestedDate: '', signedDate: '' },
  { id: 'supabase',  name: 'Supabase',   requestedDate: '', signedDate: '' },
  { id: 'vercel',    name: 'Vercel',     requestedDate: '', signedDate: '' },
  { id: 'twilio',    name: 'Twilio',     requestedDate: '', signedDate: '' },
]

function statusBadge(requested: string, signed: string) {
  if (signed)    return <span className="text-[10px] font-sans font-medium text-signal-green border border-signal-green/30 bg-signal-green/10 px-2 py-0.5 rounded-full">SIGNED</span>
  if (requested) return <span className="text-[10px] font-sans font-medium text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-full">REQUESTED</span>
  return         <span className="text-[10px] font-sans font-medium text-text-muted border border-border px-2 py-0.5 rounded-full">PENDING</span>
}

export function BaaTracker({ initialData }: { initialData?: Record<string, { requested: string; signed: string }> }) {
  const [vendors, setVendors] = useState<BaaVendor[]>(() =>
    INITIAL_VENDORS.map(v => ({
      ...v,
      requestedDate: initialData?.[v.id]?.requested ?? '',
      signedDate:    initialData?.[v.id]?.signed    ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function updateVendor(id: string, field: 'requestedDate' | 'signedDate', value: string) {
    const next = vendors.map(v => v.id === id ? { ...v, [field]: value } : v)
    setVendors(next)
    setSaving(true)
    const payload = Object.fromEntries(next.map(v => [v.id, { requested: v.requestedDate, signed: v.signedDate }]))
    await fetch('/api/admin/launch-checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baa_tracker: payload }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const signedCount = vendors.filter(v => v.signedDate).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">BAA Status</p>
        <span className="text-[10px] font-sans text-text-muted">
          {signedCount}/{vendors.length} signed
          {saving ? ' · saving…' : saved ? ' · saved ✓' : ''}
        </span>
      </div>
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
        {vendors.map(v => (
          <div key={v.id} className="flex items-center gap-4 px-4 py-3">
            <span className="font-sans text-sm text-text-primary w-24 shrink-0">{v.name}</span>
            {statusBadge(v.requestedDate, v.signedDate)}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-[10px] font-sans text-text-muted">Requested</label>
              <input
                type="date"
                value={v.requestedDate}
                onChange={e => updateVendor(v.id, 'requestedDate', e.target.value)}
                className="text-xs font-sans bg-surface border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-magenta/50 w-36"
              />
              <label className="text-[10px] font-sans text-text-muted">Signed</label>
              <input
                type="date"
                value={v.signedDate}
                onChange={e => updateVendor(v.id, 'signedDate', e.target.value)}
                className="text-xs font-sans bg-surface border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-signal-green/50 w-36"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
