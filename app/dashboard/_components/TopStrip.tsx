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

function signalTextColor(s: number) {
  if (s >= 80) return 'text-signal-green'
  if (s >= 55) return 'text-amber'
  return 'text-danger'
}

function StatCard({
  label, children, highlight,
}: {
  label: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border px-5 py-3 text-center ${highlight ? 'border-magenta/30 bg-magenta/5' : 'border-border bg-surface'}`}>
      <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      {children}
    </div>
  )
}

export default function TopStrip({
  clinicName, dateLabel,
  practiceSignal, practiceSignalDelta,
  checkinsToday, totalActive, needsAttentionCount,
  userEmail, userRole,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const deltaSign  = (practiceSignalDelta ?? 0) >= 0 ? '+' : ''
  const deltaArrow = (practiceSignalDelta ?? 0) >= 0 ? '↑' : '↓'
  const deltaColor = (practiceSignalDelta ?? 0) >= 0 ? 'text-signal-green' : 'text-danger'

  const statCards = (
    <>
      <StatCard label="Practice Signal">
        <p className={`font-serif text-4xl leading-none mt-1 ${practiceSignal !== null ? signalTextColor(practiceSignal) : 'text-text-muted'}`}>
          {practiceSignal !== null ? practiceSignal : '—'}
        </p>
        {practiceSignalDelta !== null ? (
          <p className={`font-mono text-[11px] mt-1 ${deltaColor}`}>
            {deltaArrow} {deltaSign}{practiceSignalDelta} vs yesterday
          </p>
        ) : (
          <p className="font-mono text-[11px] mt-1 text-text-muted">no baseline yet</p>
        )}
      </StatCard>

      <StatCard label="Check-ins Today">
        <p className="font-serif text-4xl leading-none mt-1 text-text-primary">
          {checkinsToday}
          <span className="font-sans text-lg text-text-muted">/{totalActive}</span>
        </p>
        <p className="font-mono text-[11px] mt-1 text-text-muted">
          {checkinsToday} submitted · {Math.max(0, totalActive - checkinsToday)} pending
        </p>
      </StatCard>

      <StatCard label="Needs Attention" highlight={needsAttentionCount > 0}>
        <p className={`font-serif text-4xl leading-none mt-1 ${needsAttentionCount > 0 ? 'text-magenta' : 'text-text-muted'}`}>
          {needsAttentionCount}
        </p>
        {needsAttentionCount > 0 ? (
          <a href="?filter=attention" className="font-sans text-[11px] mt-1 text-magenta hover:underline inline-block">
            Review now →
          </a>
        ) : (
          <p className="font-mono text-[11px] mt-1 text-text-muted">all clear</p>
        )}
      </StatCard>
    </>
  )

  return (
    <>
      {/* ── Mobile layout (< 640px) ───────────────────────────── */}
      <div className="sm:hidden border-b border-border pb-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl text-text-primary truncate">{clinicName}</h1>
            <p className="mt-0.5 font-sans text-xs text-text-muted">{dateLabel}</p>
          </div>

          {/* ••• account menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="rounded-md border border-border px-3 py-2 text-sm font-sans text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Account menu"
            >
              •••
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded-md border border-border bg-surface shadow-lg z-50 py-1">
                <p className="px-4 py-2 text-[10px] font-sans text-text-muted uppercase tracking-widest border-b border-border">
                  {userEmail}
                </p>
                {userRole === 'owner' && (
                  <a
                    href="/team"
                    className="block px-4 py-2.5 text-sm font-sans text-text-muted hover:text-text-primary hover:bg-border/20 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Team
                  </a>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2.5 text-sm font-sans text-text-muted hover:text-text-primary hover:bg-border/20 transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Stat cards — full-width stacked */}
        <div className="space-y-2">
          {statCards}
        </div>
      </div>

      {/* ── Desktop layout (>= 640px) ─────────────────────────── */}
      <div className="hidden sm:flex items-center justify-between gap-6 border-b border-border pb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl text-text-primary truncate">{clinicName}</h1>
          <p className="mt-1 font-sans text-sm text-text-muted">{dateLabel}</p>
          <p className="mt-0.5 font-sans text-xs text-text-muted/60">
            {userEmail} · <span className="capitalize">{userRole}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-lg border border-border bg-surface px-5 py-3 text-center min-w-[130px]">
            <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Practice Signal</p>
            <p className={`font-serif text-4xl leading-none mt-1 ${practiceSignal !== null ? signalTextColor(practiceSignal) : 'text-text-muted'}`}>
              {practiceSignal !== null ? practiceSignal : '—'}
            </p>
            {practiceSignalDelta !== null ? (
              <p className={`font-mono text-[11px] mt-1 ${deltaColor}`}>
                {deltaArrow} {deltaSign}{practiceSignalDelta} vs yesterday
              </p>
            ) : (
              <p className="font-mono text-[11px] mt-1 text-text-muted">no baseline yet</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface px-5 py-3 text-center min-w-[130px]">
            <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Check-ins Today</p>
            <p className="font-serif text-4xl leading-none mt-1 text-text-primary">
              {checkinsToday}
              <span className="font-sans text-lg text-text-muted">/{totalActive}</span>
            </p>
            <p className="font-mono text-[11px] mt-1 text-text-muted">
              {checkinsToday} submitted · {Math.max(0, totalActive - checkinsToday)} pending
            </p>
          </div>

          <div className={`rounded-lg border px-5 py-3 text-center min-w-[130px] ${needsAttentionCount > 0 ? 'border-magenta/30 bg-magenta/5' : 'border-border bg-surface'}`}>
            <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Needs Attention</p>
            <p className={`font-serif text-4xl leading-none mt-1 ${needsAttentionCount > 0 ? 'text-magenta' : 'text-text-muted'}`}>
              {needsAttentionCount}
            </p>
            {needsAttentionCount > 0 ? (
              <a href="?filter=attention" className="font-sans text-[11px] mt-1 text-magenta hover:underline inline-block">
                Review now →
              </a>
            ) : (
              <p className="font-mono text-[11px] mt-1 text-text-muted">all clear</p>
            )}
          </div>

          {userRole === 'owner' && (
            <a href="/team" className="rounded-md border border-border px-3 py-2 text-xs font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors">
              Team
            </a>
          )}

          <form action={signOut}>
            <button type="submit" className="rounded-md border border-border px-3 py-2 text-xs font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
