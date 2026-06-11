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

function signalPillStyle(s: number) {
  if (s >= 80) return 'bg-signal-green/10 border-signal-green/30'
  if (s >= 55) return 'bg-amber/10 border-amber/30'
  return 'bg-danger/10 border-danger/30'
}

function statusBadge(s: number | null): { label: string; className: string } {
  if (s === null) return { label: 'No data yet', className: 'text-text-muted border-border' }
  if (s >= 80)   return { label: 'Recovering',    className: 'text-signal-green border-signal-green/30 bg-signal-green/5' }
  if (s >= 55)   return { label: 'Stable',         className: 'text-amber border-amber/30 bg-amber/5' }
  if (s >= 30)   return { label: 'Watch',          className: 'text-danger border-danger/30 bg-danger/5' }
  return           { label: 'Action needed',        className: 'text-magenta border-magenta/30 bg-magenta/5' }
}

function Sparkline({ values, signal }: { values: number[]; signal: number | null }) {
  if (values.length < 2) return <div className="w-24 h-8" aria-hidden="true" />
  const W = 96, H = 32, PAD = 3
  const min = 0, max = 100
  const xOf = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2)
  const yOf = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)
  const pts  = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const zone = signal !== null ? getZone(signal) : 'red'
  // Softened zone palette matching tailwind tokens
  const stroke = zone === 'green' ? '#4ADE80' : zone === 'amber' ? '#FBBF24' : '#F87171'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function PatientInitials({ first, last }: { first: string; last: string }) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ─── Morning Briefing ────────────────────────────────────────────────────────
// Carbon Health reference: summary reads like a doctor's note — calm, confident.
// Inverted hierarchy: editorial serif headline dominates, callout cards are quiet.

function MorningBriefing({
  briefing,
  patients,
  onOpenPatient,
}: {
  briefing:      BriefingData
  patients:      PatientSummary[]
  onOpenPatient: (id: string) => void
}) {
  const nameOf = (id: string) => patients.find(x => x.id === id)
  const callouts = briefing.patient_callouts.slice(0, 3).filter(c => nameOf(c.patient_id))

  const gridClass =
    callouts.length === 1 ? 'grid-cols-1' :
    callouts.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    'grid-cols-1 sm:grid-cols-3'

  return (
    <div className="pb-8 border-b border-border">
      {/* Section label */}
      <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted mb-4">
        Morning Briefing
      </p>

      {/* Editorial headline — the AI's voice, set in serif, generous size */}
      {/* This is the "doctor's note" moment. It leads, the callouts follow. */}
      <p className="font-serif text-2xl sm:text-3xl text-text-primary leading-snug">
        {briefing.summary_text}
      </p>

      {/* Callout cards — quiet note surfaces, not system alerts */}
      {callouts.length > 0 && (
        <div className={`grid gap-3 mt-6 ${gridClass}`}>
          {callouts.map((c, i) => {
            const p = nameOf(c.patient_id)!
            return (
              <button
                key={i}
                onClick={() => onOpenPatient(c.patient_id)}
                className="text-left rounded-2xl bg-surface-elevated border border-border/40 px-6 py-5
                  hover:border-border transition-colors
                  focus:outline-none focus:ring-2 focus:ring-magenta/40 group"
              >
                {/* Name: label-weight — the reason text is the note body */}
                <p className="font-sans text-xs uppercase tracking-widest text-text-muted truncate">
                  {p.first_name} {p.last_name}
                </p>
                {/* Reason: the actual finding — primary text, reading weight */}
                <p className="font-sans text-sm text-text-primary mt-2 leading-relaxed line-clamp-3">
                  {c.reason}
                </p>
                {/* Suggested action: softer, italic — the recommendation */}
                <p className="font-sans text-xs text-text-muted mt-2 italic leading-relaxed line-clamp-2">
                  {c.suggested_action}
                </p>
                {/* Implicit CTA — appears on hover only, no button noise */}
                <p className="font-sans text-xs text-text-muted/30 group-hover:text-magenta mt-3 transition-colors">
                  Open chart →
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Patient Roster ───────────────────────────────────────────────────────────

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
      <div className="space-y-6">
        {briefing && (
          <MorningBriefing briefing={briefing} patients={patients} onOpenPatient={setOpenId} />
        )}
        <div className="rounded-2xl border border-border bg-surface/50 px-6 py-12 text-center">
          <p className="font-sans text-sm text-text-muted">
            No patients enrolled yet. Add patients in Settings → Patients.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Zone 2: Morning Briefing */}
      {briefing && (
        <MorningBriefing briefing={briefing} patients={patients} onOpenPatient={setOpenId} />
      )}

      {/* Zone 3: Roster controls */}
      <div className="pt-2 space-y-5">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <input
            type="search"
            placeholder="Search patients…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-magenta/40 w-52"
            aria-label="Search patients"
          />

          {/* Filter — elegant text toggles */}
          <div className="flex items-center gap-5" role="group" aria-label="Filter patients">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`font-sans text-sm transition-colors focus:outline-none whitespace-nowrap pb-0.5 ${
                  filter === opt.value
                    ? 'text-text-primary border-b border-text-primary/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="ml-auto">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-sans text-text-muted focus:outline-none focus:ring-2 focus:ring-magenta/40"
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
          <div className="rounded-2xl border border-border bg-surface/50 px-6 py-10 text-center">
            <p className="font-sans text-sm text-text-muted">No patients match this filter.</p>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Patient roster">
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
                  className={`w-full text-left rounded-2xl border px-5 py-5 sm:py-6
                    transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-magenta/40
                    ${needsAttn
                      ? 'border-magenta/25 bg-magenta/[0.03] hover:bg-magenta/[0.06]'
                      : 'border-border bg-surface hover:bg-surface-elevated'
                    }`}
                  aria-label={`Open detail for ${p.first_name} ${p.last_name}`}
                >
                  {/* ── Mobile layout (< sm) ─────────────────── */}
                  <div className="flex items-center gap-4 sm:hidden">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #2A2724 0%, #1C1917 100%)' }}
                    >
                      <span className="font-sans text-sm font-medium text-text-secondary">
                        <PatientInitials first={p.first_name} last={p.last_name} />
                      </span>
                    </div>

                    {/* Name + complaint + date */}
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-base text-text-primary truncate">
                        {p.first_name} {p.last_name}
                      </p>
                      {p.chief_complaint && (
                        <p className="font-sans text-xs text-text-muted truncate mt-0.5">
                          {p.chief_complaint}
                        </p>
                      )}
                      {lastDate && (
                        <p className="font-sans text-[11px] text-text-muted/70 mt-0.5">
                          Last: {lastDate}
                        </p>
                      )}
                    </div>

                    {/* Signal pill */}
                    {p.latestSignal !== null ? (
                      <div className={`shrink-0 inline-flex flex-col items-center rounded-xl border px-3 py-2 ${signalPillStyle(p.latestSignal)}`}>
                        <span className={`font-serif text-2xl leading-none ${signalTextColor(p.latestSignal)}`}>
                          {p.latestSignal}
                        </span>
                        <span className="font-sans text-[9px] uppercase tracking-widest text-text-muted mt-0.5">
                          Signal
                        </span>
                      </div>
                    ) : (
                      <div className="shrink-0 inline-flex flex-col items-center rounded-xl border border-border/40 px-3 py-2">
                        <span className="font-sans text-xl text-text-muted leading-none">—</span>
                        <span className="font-sans text-[9px] uppercase tracking-widest text-text-muted mt-0.5">
                          Signal
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Desktop layout (>= sm) ────────────────── */}
                  <div className="hidden sm:flex items-center gap-5">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #2A2724 0%, #1C1917 100%)' }}
                    >
                      <span className="font-sans text-sm font-medium text-text-secondary">
                        <PatientInitials first={p.first_name} last={p.last_name} />
                      </span>
                    </div>

                    {/* Name + complaint */}
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-lg text-text-primary truncate">
                        {p.first_name} {p.last_name}
                      </p>
                      {p.chief_complaint && (
                        <p className="font-sans text-sm text-text-muted truncate mt-0.5">
                          {p.chief_complaint}
                        </p>
                      )}
                    </div>

                    {/* Sparkline */}
                    <div className="shrink-0">
                      <Sparkline values={p.sparkline} signal={p.latestSignal} />
                    </div>

                    {/* Last check-in */}
                    <div className="shrink-0 text-right w-20">
                      <p className="font-sans text-xs text-text-muted">
                        {lastDate ?? 'never'}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0 w-28 text-right">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-sans ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Signal pill */}
                    {p.latestSignal !== null ? (
                      <div className={`shrink-0 inline-flex flex-col items-center rounded-xl border px-3 py-2 ${signalPillStyle(p.latestSignal)}`}>
                        <span className={`font-serif text-2xl leading-none ${signalTextColor(p.latestSignal)}`}>
                          {p.latestSignal}
                        </span>
                        <span className="font-sans text-[9px] uppercase tracking-widest text-text-muted mt-0.5">
                          Signal
                        </span>
                      </div>
                    ) : (
                      <div className="shrink-0 inline-flex flex-col items-center rounded-xl border border-border/40 px-3 py-2">
                        <span className="font-sans text-xl text-text-muted leading-none">—</span>
                        <span className="font-sans text-[9px] uppercase tracking-widest text-text-muted mt-0.5">
                          Signal
                        </span>
                      </div>
                    )}
                  </div>

                </button>
              )
            })}
          </div>
        )}
      </div>

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
