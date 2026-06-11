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

function signalCardStyle(s: number) {
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
  const pending    = Math.max(0, totalActive - checkinsToday)

  return (
    <div className="space-y-4 pb-8 border-b border-border">

      {/* ── Row 1: Clinic masthead + account icon ─────────────── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          {/* Clinic name: restrained masthead — Aman reference */}
          <h1 className="font-serif text-2xl sm:text-3xl text-text-primary leading-tight tracking-wide">
            {clinicName}
          </h1>
          <p className="mt-1.5 font-sans text-xs text-text-muted">{dateLabel}</p>
          <p className="mt-0.5 font-sans text-xs text-text-muted/50 hidden sm:block">
            {userEmail} · <span className="capitalize">{userRole}</span>
          </p>
        </div>

        {/* Account icon — single circle button, always */}
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

      {/* ── Row 2: Practice Signal — prominent but contextual ──── */}
      {/* Whoop reference: number is context for action, not the action */}
      <div className={`rounded-2xl border px-6 py-5 sm:px-7 sm:py-6 ${
        practiceSignal !== null ? signalCardStyle(practiceSignal) : 'border-border bg-surface'
      }`}>
        <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
          Practice Signal
        </p>

        <div className="mt-3 flex items-baseline gap-5">
          {/* Number — prominent but not poster-sized */}
          <span className={`font-serif text-5xl sm:text-6xl leading-none ${
            practiceSignal !== null ? signalTextColor(practiceSignal) : 'text-text-muted'
          }`}>
            {practiceSignal !== null ? practiceSignal : '—'}
          </span>

          {/* Delta — legible and meaningful */}
          {practiceSignalDelta !== null ? (
            <div>
              <p className={`font-sans text-base font-semibold leading-none ${deltaColor}`}>
                {deltaArrow} {deltaSign}{practiceSignalDelta}
              </p>
              <p className="font-sans text-xs text-text-muted mt-1">from yesterday</p>
            </div>
          ) : (
            <p className="font-sans text-xs text-text-muted">no baseline yet</p>
          )}
        </div>

        {/* Context — makes the number feel grounded, not a vanity metric */}
        {totalActive > 0 && (
          <p className="mt-3 font-sans text-xs text-text-muted">
            avg · {totalActive} active patient{totalActive === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {/* ── Row 3: Secondary metrics — Carbon Health card hierarchy ── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Check-ins Today */}
        <div className="rounded-2xl border border-border bg-surface px-5 py-5">
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Check-ins Today
          </p>
          <p className="font-serif text-3xl leading-none mt-2 text-text-primary">
            {checkinsToday}
            <span className="font-sans text-base text-text-muted ml-1">/{totalActive}</span>
          </p>
          <p className="font-sans text-xs text-text-muted mt-2">
            {pending > 0 ? `${pending} pending` : 'all in'}
          </p>
        </div>

        {/* Needs Attention */}
        <div className={`rounded-2xl border px-5 py-5 ${
          needsAttentionCount > 0
            ? 'border-magenta/30 bg-magenta/[0.04]'
            : 'border-border bg-surface'
        }`}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">
            Needs Attention
          </p>
          <p className={`font-serif text-3xl leading-none mt-2 ${
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
