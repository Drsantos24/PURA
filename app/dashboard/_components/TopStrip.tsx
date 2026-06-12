'use client'

import { useState } from 'react'
import { signOut } from '@/app/login/actions'

type Props = {
  clinicName: string
  dateLabel: string
  practiceSignal: number | null
  practiceSignalDelta: number | null
  checkinsToday: number
  totalActive: number
  needsAttentionCount: number
  userEmail: string
  userRole: 'owner' | 'clinician' | 'assistant'
}

// ─── Whoop-style arc gauge ────────────────────────────────────────────────────
// Circular progress arc: track ring + filled arc from top, clockwise.
// Number and zone label centered inside.

function SignalGauge({ value }: { value: number | null }) {
  const r  = 52   // radius
  const cx = 64, cy = 64
  const circ = 2 * Math.PI * r   // ≈ 326.7

  // Zone colors — match tailwind tokens
  let arcColor   = '#F87171'   // danger
  let zoneLabel  = 'Watch'
  if (value !== null) {
    if (value >= 80) { arcColor = '#4ADE80'; zoneLabel = 'Strong' }
    else if (value >= 55) { arcColor = '#FBBF24'; zoneLabel = 'Stable' }
    else { arcColor = '#F87171'; zoneLabel = 'Watch' }
  }

  const pct    = value !== null ? Math.min(1, Math.max(0, value / 100)) : 0
  const offset = circ * (1 - pct)

  return (
    <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
      <svg
        width="128"
        height="128"
        viewBox="0 0 128 128"
        aria-hidden="true"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#2A2724"
          strokeWidth="7"
        />
        {/* Arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>

      {/* Centered number + zone label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-serif leading-none"
          style={{
            fontSize: value !== null ? '2.25rem' : '1.75rem',
            color: value !== null ? arcColor : '#6B655F',
          }}
        >
          {value !== null ? value : '—'}
        </span>
        <span className="font-sans text-[9px] uppercase tracking-widest mt-1" style={{ color: '#6B655F' }}>
          {value !== null ? zoneLabel : 'no data'}
        </span>
      </div>
    </div>
  )
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

function deltaColor(d: number) {
  return d >= 0 ? 'text-signal-green' : 'text-danger'
}

export default function TopStrip({
  clinicName, dateLabel,
  practiceSignal, practiceSignalDelta,
  checkinsToday, totalActive, needsAttentionCount,
  userEmail, userRole,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const delta     = practiceSignalDelta
  const deltaSign = (delta ?? 0) >= 0 ? '+' : ''
  const deltaArr  = (delta ?? 0) >= 0 ? '↑' : '↓'
  const pending   = Math.max(0, totalActive - checkinsToday)

  return (
    <div className="space-y-4 pb-8 border-b border-border">

      {/* ── Row 1: Clinic masthead + account icon ─────────────── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          {/* Aman reference: restrained, confident, tracked — not a poster */}
          <h1 className="font-serif text-2xl sm:text-3xl text-text-primary leading-tight tracking-wide">
            {clinicName}
          </h1>
          <p className="mt-1.5 font-sans text-xs text-text-muted">{dateLabel}</p>
          <p className="mt-0.5 font-sans text-xs text-text-muted/50 hidden sm:block">
            {userEmail} · <span className="capitalize">{userRole}</span>
          </p>
        </div>

        {/* Single icon — always a circle, no floating buttons */}
        <div className="relative shrink-0 mt-0.5">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-magenta/40"
            aria-label="Account menu"
          >
            <span className="text-[12px] leading-none tracking-tight">•••</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 min-w-[180px] rounded-xl border border-border bg-surface shadow-xl z-50 py-1 overflow-hidden">
              <p className="px-4 py-2.5 text-[10px] font-sans text-text-muted uppercase tracking-widest border-b border-border">
                {userEmail}
              </p>
              {userRole === 'owner' && (
                <a
                  href="/team"
                  className="block px-4 py-3 text-sm font-sans text-text-muted hover:text-text-primary hover:bg-border/20 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Team
                </a>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full text-left px-4 py-3 text-sm font-sans text-text-muted hover:text-text-primary hover:bg-border/20 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Practice Signal — Whoop-style arc gauge ────── */}
      {/* The number lives inside a circular progress arc.         */}
      {/* Context: delta + patient count flank the gauge.         */}
      <div className="rounded-2xl border border-border bg-surface px-6 py-5 sm:px-7 sm:py-6">
        <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted mb-4">
          Practice Signal
        </p>

        <div className="flex items-center gap-5">
          {/* Arc gauge */}
          <SignalGauge value={practiceSignal} />

          {/* Context column */}
          <div className="flex-1 min-w-0">
            {delta !== null ? (
              <div className="space-y-0.5">
                <p className={`font-sans text-2xl font-semibold leading-none ${deltaColor(delta)}`}>
                  {deltaArr} {deltaSign}{delta}
                </p>
                <p className="font-sans text-xs text-text-muted">from yesterday</p>
              </div>
            ) : (
              <p className="font-sans text-sm text-text-muted">No prior day to compare</p>
            )}

            {totalActive > 0 && (
              <p className="font-sans text-xs text-text-muted mt-4">
                avg · {totalActive} patient{totalActive === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Secondary metrics — Carbon Health card hierarchy ── */}
      {/* Label tiny + uppercase. Number dominant serif.              */}
      {/* Supporting text as a sentence, not just metadata.           */}
      <div className="grid grid-cols-2 gap-3">

        {/* Check-ins Today */}
        <div className="rounded-2xl border border-border bg-surface px-5 py-5">
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Check-ins
          </p>
          <p className="font-serif text-3xl leading-none mt-3 text-text-primary">
            {checkinsToday}
            <span className="font-sans text-sm text-text-muted ml-1">/{totalActive}</span>
          </p>
          <p className="font-sans text-xs text-text-muted mt-3 leading-relaxed">
            {pending > 0
              ? `${pending} yet to respond`
              : 'Everyone checked in'}
          </p>
        </div>

        {/* Needs Attention */}
        <div className={`rounded-2xl border px-5 py-5 ${
          needsAttentionCount > 0
            ? 'border-magenta/30 bg-magenta/[0.04]'
            : 'border-border bg-surface'
        }`}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Attention
          </p>
          <p className={`font-serif text-3xl leading-none mt-3 ${
            needsAttentionCount > 0 ? 'text-magenta' : 'text-text-muted'
          }`}>
            {needsAttentionCount}
          </p>
          <p className="font-sans text-xs mt-3 leading-relaxed">
            {needsAttentionCount > 0 ? (
              <a href="?filter=attention" className="text-magenta hover:underline">
                Review now →
              </a>
            ) : (
              <span className="text-text-muted">All patients stable</span>
            )}
          </p>
        </div>

      </div>
    </div>
  )
}
