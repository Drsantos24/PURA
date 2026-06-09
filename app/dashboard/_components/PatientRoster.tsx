'use client'

import { useMemo, useState } from 'react'
import PatientDrawer from './PatientDrawer'

export type BriefingData = {
  summary_text:     string
  patient_callouts: Array<{ patient_id: string; reason: string; suggested_action: string }>
}

export type PatientSummary = {
  id: string
  first_name: string
  last_name: string
  chief_complaint: string | null
  last_checkin_date: string | null
  latestSignal: number | null
  sparkline: number[]
}

type FilterMode = 'all' | 'attention' | 'stable' | 'nodata'
type SortMode  = 'signal_asc' | 'signal_desc' | 'last_checkin' | 'name'

function getZone(s: number): 'green' | 'amber' | 'red' {
  if (s >= 80) return 'green'
  if (s >= 55) return 'amber'
  return 'red'
}

function signalTextColor(s: number) {
  if (s >= 80) return 'text-signal-green'
  if (s >= 55) return 'text-amber'
  return 'text-danger'
}

function ringColor(s: number) {
  if (s >= 80) return 'ring-signal-green/60'
  if (s >= 55) return 'ring-amber/60'
  return 'ring-danger/60'
}

function statusBadge(s: number | null): { label: string; className: string } {
  if (s === null) return { label: 'No data yet', className: 'text-text-muted border-border' }
  if (s >= 80)   return { label: 'Recovering',     className: 'text-signal-green border-signal-green/30 bg-signal-green/5' }
  if (s >= 55)   return { label: 'Stable',          className: 'text-amber border-amber/30 bg-amber/5' }
  if (s >= 30)   return { label: 'Watch',           className: 'text-danger border-danger/30 bg-danger/5' }
  return           { label: 'Action needed',         className: 'text-magenta border-magenta/30 bg-magenta/5' }
}

function Sparkline({ values, signal }: { values: number[]; signal: number | null }) {
  if (values.length < 2) return <div className="w-24 h-8" aria-hidden="true" />
  const W = 96, H = 32, PAD = 3
  const min = 0, max = 100
  const xOf = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2)
  const yOf = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)
  const pts  = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const zone = signal !== null ? getZone(signal) : 'red'
  const stroke = zone === 'green' ? '#22C55E' : zone === 'amber' ? '#F59E0B' : '#EF4444'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Initials({ first, last }: { first: string; last: string }) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ─── Morning Briefing card (rendered inside client component so callouts can open drawer) ───

function BriefingCard({
  briefing,
  patients,
  onOpenPatient,
}: {
  briefing:      BriefingData
  patients:      PatientSummary[]
  onOpenPatient: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const nameOf = (id: string) => {
    const p = patients.find(x => x.id === id)
    return p ? `${p.first_name} ${p.last_name}` : null
  }
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-border/20 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-magenta/40"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-sans text-[10px] uppercase tracking-widest text-text-muted shrink-0">Morning Briefing</span>
          <span className="font-sans text-sm text-text-primary truncate">{briefing.summary_text}</span>
        </div>
        <span className={`text-text-muted text-xs transition-transform shrink-0 ml-3 ${collapsed ? '' : 'rotate-180'}`}>▼</span>
      </button>

      {!collapsed && briefing.patient_callouts.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {briefing.patient_callouts.map((c, i) => {
            const name = nameOf(c.patient_id)
            if (!name) return null
            return (
              <button
                key={i}
                onClick={() => onOpenPatient(c.patient_id)}
                className="w-full text-left px-5 py-3 flex items-start gap-4 hover:bg-border/20 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-magenta/40 group"
              >
                <span className="w-2 h-2 rounded-full bg-magenta mt-1.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-text-primary group-hover:text-magenta transition-colors truncate">{name}</p>
                  <p className="font-sans text-xs text-text-muted mt-0.5">{c.reason}</p>
                  <p className="font-sans text-xs text-text-muted/70 mt-0.5 italic">{c.suggested_action}</p>
                </div>
                <span className="text-text-muted/40 group-hover:text-text-muted text-xs mt-1 shrink-0">→</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PatientRoster({
  patients,
  briefing,
  initialFilter = 'all',
  userRole = 'owner',
}: {
  patients:       PatientSummary[]
  briefing?:      BriefingData | null
  initialFilter?: string
  userRole?:      'owner' | 'clinician' | 'assistant'
}) {
  const [query,    setQuery]    = useState('')
  const [filter,   setFilter]   = useState<FilterMode>(
    (['all','attention','stable','nodata'].includes(initialFilter) ? initialFilter : 'all') as FilterMode
  )
  const [sort,     setSort]     = useState<SortMode>('signal_asc')
  const [openId,   setOpenId]   = useState<string | null>(null)

  const openPatient = patients.find(p => p.id === openId) ?? null

  const filtered = useMemo(() => {
    let list = patients

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      )
    }

    if (filter === 'attention') list = list.filter(p => p.latestSignal !== null && p.latestSignal < 55)
    if (filter === 'stable')    list = list.filter(p => p.latestSignal !== null && p.latestSignal >= 55)
    if (filter === 'nodata')    list = list.filter(p => p.latestSignal === null)

    return [...list].sort((a, b) => {
      if (sort === 'name')        return `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
      if (sort === 'signal_desc') return (b.latestSignal ?? -1) - (a.latestSignal ?? -1)
      if (sort === 'last_checkin') {
        const da = a.last_checkin_date ?? '0000-00-00'
        const db = b.last_checkin_date ?? '0000-00-00'
        return db.localeCompare(da)
      }
      // signal_asc — nulls last, then lowest first
      if (a.latestSignal === null && b.latestSignal === null) return 0
      if (a.latestSignal === null) return 1
      if (b.latestSignal === null) return -1
      return a.latestSignal - b.latestSignal
    })
  }, [patients, query, filter, sort])

  const filterOptions: { value: FilterMode; label: string }[] = [
    { value: 'all',       label: 'All' },
    { value: 'attention', label: 'Needs attention' },
    { value: 'stable',    label: 'Stable' },
    { value: 'nodata',    label: 'No data yet' },
  ]

  if (patients.length === 0) {
    return (
      <div className="space-y-4">
        {briefing && (
          <BriefingCard briefing={briefing} patients={patients} onOpenPatient={setOpenId} />
        )}
        <div className="rounded-lg border border-border bg-surface/50 px-6 py-12 text-center">
          <p className="font-sans text-sm text-text-muted">
            No patients enrolled yet. Add patients in Settings → Patients.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Morning Briefing */}
      {briefing && (
        <BriefingCard briefing={briefing} patients={patients} onOpenPatient={setOpenId} />
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search patients…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-magenta/40 w-56"
          aria-label="Search patients"
        />

        <div className="flex items-center gap-1.5" role="group" aria-label="Filter patients">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-sans transition-colors focus:outline-none focus:ring-2 focus:ring-magenta/40 ${
                filter === opt.value
                  ? 'bg-text-primary text-background font-medium'
                  : 'border border-border text-text-muted hover:border-text-muted hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-muted focus:outline-none focus:ring-2 focus:ring-magenta/40"
            aria-label="Sort patients"
          >
            <option value="signal_asc">Signal: lowest first</option>
            <option value="signal_desc">Signal: highest first</option>
            <option value="last_checkin">Last check-in</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Roster */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/50 px-6 py-10 text-center">
          <p className="font-sans text-sm text-text-muted">No patients match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Patient roster">
          {filtered.map(p => {
            const badge    = statusBadge(p.latestSignal)
            const needsAttn = p.latestSignal !== null && p.latestSignal < 55
            const lastDate  = p.last_checkin_date
              ? new Date(p.last_checkin_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null

            return (
              <button
                key={p.id}
                role="listitem"
                onClick={() => setOpenId(p.id)}
                className={`w-full text-left rounded-lg border px-5 py-4 flex items-center gap-5
                  transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-magenta/40
                  ${needsAttn
                    ? 'border-magenta/25 bg-magenta/[0.03] hover:bg-magenta/[0.06]'
                    : 'border-border bg-surface/50 hover:bg-surface'
                  }`}
                aria-label={`Open detail for ${p.first_name} ${p.last_name}`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-border flex items-center justify-center ring-2 shrink-0 ${
                  p.latestSignal !== null ? ringColor(p.latestSignal) : 'ring-border'
                }`}>
                  <span className="font-sans text-sm font-medium text-text-muted">
                    <Initials first={p.first_name} last={p.last_name} />
                  </span>
                </div>

                {/* Name + complaint */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-semibold text-text-primary truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  {p.chief_complaint && (
                    <p className="font-sans text-xs text-text-muted truncate mt-0.5">{p.chief_complaint}</p>
                  )}
                </div>

                {/* Sparkline */}
                <div className="shrink-0">
                  <Sparkline values={p.sparkline} signal={p.latestSignal} />
                </div>

                {/* Last check-in */}
                <div className="shrink-0 text-right w-20">
                  <p className="font-mono text-[11px] text-text-muted">
                    {lastDate ?? 'never'}
                  </p>
                </div>

                {/* Status badge */}
                <div className="shrink-0 w-28 text-right">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-sans ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Signal number */}
                <div className="shrink-0 w-12 text-right">
                  {p.latestSignal !== null ? (
                    <span className={`font-serif text-3xl leading-none ${signalTextColor(p.latestSignal)}`}>
                      {p.latestSignal}
                    </span>
                  ) : (
                    <span className="font-mono text-lg text-text-muted">—</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      <PatientDrawer
        patientId={openId}
        patientName={openPatient ? `${openPatient.first_name} ${openPatient.last_name}` : ''}
        chiefComplaint={openPatient?.chief_complaint ?? null}
        onClose={() => setOpenId(null)}
        userRole={userRole}
      />
    </>
  )
}
