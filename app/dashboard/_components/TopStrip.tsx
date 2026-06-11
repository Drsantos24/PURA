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

function signalHeroStyle(s: number) {
  if (s >= 80) return 'border-signal-green/20 bg-signal-green/[0.04]'
  if (s >= 55) return 'border-amber/20 bg-amber/[0.04]'
  return 'border-danger/20 bg-danger/[0.04]'
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

  return (
    <div className="space-y-5 pb-8 border-b border-border">

      {/* ── Row 1: Clinic name + account icon ─────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl sm:text-5xl text-text-primary leading-none">
            {clinicName}
          </h1>
          <p className="mt-2 font-sans text-sm text-text-muted">{dateLabel}</p>
          <p className="mt-0.5 font-sans text-xs text-text-muted/60 hidden sm:block">
            {userEmail} · <span className="capitalize">{userRole}</span>
          </p>
        </div>

        {/* Account menu — single icon on both mobile and desktop */}
        <div className="relative shrink-0 mt-1">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-magenta/40"
            aria-label="Account menu"
          >
            <span className="text-[13px] tracking-tight leading-none">•••</span>
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

      {/* ── Row 2: Practice Signal hero ───────────────────────── */}
      <div className={`rounded-2xl border px-6 py-6 sm:px-8 sm:py-7 ${
        practiceSignal !== null ? signalHeroStyle(practiceSignal) : 'border-border bg-surface'
      }`}>
        <p className="font-sans text-[11px] uppercase tracking-widest text-text-muted">
          Practice Signal
        </p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className={`font-serif text-7xl sm:text-8xl leading-none ${
            practiceSignal !== null ? signalTextColor(practiceSignal) : 'text-text-muted'
          }`}>
            {practiceSignal !== null ? practiceSignal : '—'}
          </p>
          <div className="text-right pb-1 shrink-0">
            {practiceSignalDelta !== null ? (
              <>
                <p className={`font-sans text-base font-medium ${deltaColor}`}>
                  {deltaArrow} {deltaSign}{practiceSignalDelta}
                </p>
                <p className="font-sans text-xs text-text-muted mt-0.5">vs yesterday</p>
              </>
            ) : (
              <p className="font-sans text-xs text-text-muted">no baseline yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Secondary metrics (2-col grid) ─────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Check-ins Today */}
        <div className="rounded-2xl border border-border bg-surface px-5 py-5">
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Check-ins Today
          </p>
          <p className="font-serif text-4xl leading-none mt-3 text-text-primary">
            {checkinsToday}
            <span className="font-sans text-xl text-text-muted ml-1.5">/{totalActive}</span>
          </p>
          <p className="font-sans text-xs text-text-muted mt-2">
            {Math.max(0, totalActive - checkinsToday)} pending
          </p>
        </div>

        {/* Needs Attention */}
        <div className={`rounded-2xl border px-5 py-5 ${
          needsAttentionCount > 0 ? 'border-magenta/30 bg-magenta/[0.04]' : 'border-border bg-surface'
        }`}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Needs Attention
          </p>
          <p className={`font-serif text-4xl leading-none mt-3 ${
            needsAttentionCount > 0 ? 'text-magenta' : 'text-text-muted'
          }`}>
            {needsAttentionCount}
          </p>
          {needsAttentionCount > 0 ? (
            <a
              href="?filter=attention"
              className="font-sans text-xs text-magenta hover:underline inline-block mt-2"
            >
              Review now →
            </a>
          ) : (
            <p className="font-sans text-xs text-text-muted mt-2">all clear</p>
          )}
        </div>

      </div>
    </div>
  )
}
