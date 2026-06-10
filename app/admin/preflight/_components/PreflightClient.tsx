'use client'

import { useState } from 'react'

type TestResult = { pass: boolean; detail: string; ms: number }
type Results = Record<string, TestResult>

const TESTS: { id: string; label: string; category: string }[] = [
  // A
  { id: 'A1', label: 'Demo user login succeeds',                          category: 'A — Auth & RLS' },
  { id: 'A2', label: 'RLS isolation — bogus clinic_id returns 0 rows',    category: 'A — Auth & RLS' },
  { id: 'A3', label: 'Service role audit log write succeeds',             category: 'A — Auth & RLS' },
  { id: 'A4', label: 'Unauthenticated /dashboard → /login redirect',      category: 'A — Auth & RLS' },
  // B
  { id: 'B1', label: 'Generate fresh check-in token for demo patient',    category: 'B — Check-in Surface' },
  { id: 'B2', label: '/c/[code] route renders, form interactive',         category: 'B — Check-in Surface' },
  { id: 'B3', label: 'Submit check-in → daily_checkins row created',      category: 'B — Check-in Surface' },
  { id: 'B4', label: '/done renders with signal score',                   category: 'B — Check-in Surface' },
  // C
  { id: 'C1', label: 'Briefing generation <30s, ≥1 callout',              category: 'C — AI Generation' },
  { id: 'C2', label: 'PHI scrubbing — no names/phones in AI payload',     category: 'C — AI Generation' },
  { id: 'C3', label: 'RAG retrieval verified in briefing',                category: 'C — AI Generation' },
  { id: 'C4', label: 'Message draft generation <15s, non-empty',          category: 'C — AI Generation' },
  // D
  { id: 'D1', label: 'Create test clinician in demo clinic',              category: 'D — Approval Workflow' },
  { id: 'D2', label: 'Clinician draft request lands in /approvals',       category: 'D — Approval Workflow' },
  { id: 'D3', label: 'Owner approves with edit → status + audit log',     category: 'D — Approval Workflow' },
  { id: 'D4', label: 'Owner rejects with note → status = rejected',       category: 'D — Approval Workflow' },
  { id: 'D5', label: 'Cleanup test clinician',                            category: 'D — Approval Workflow' },
  // E
  { id: 'E1', label: 'Cron route responds with valid CRON_SECRET',        category: 'E — Infrastructure' },
  { id: 'E2', label: 'Cron route rejects invalid secret (401)',           category: 'E — Infrastructure' },
  { id: 'E3', label: 'All required env vars present',                     category: 'E — Infrastructure' },
  { id: 'E4', label: 'HTTPS enforced, security headers present',          category: 'E — Infrastructure' },
  { id: 'E5', label: 'access_log last 7 days — no error spikes',          category: 'E — Infrastructure' },
  // F
  { id: 'F1', label: 'Demo clinic exists with is_demo + auto_send',       category: 'F — Demo Readiness' },
  { id: 'F2', label: '25+ demo patients with realistic trajectories',     category: 'F — Demo Readiness' },
  { id: 'F3', label: "Today's briefing generated successfully",           category: 'F — Demo Readiness' },
  { id: 'F4', label: '≥3 pending message drafts in queue',                category: 'F — Demo Readiness' },
  { id: 'F5', label: 'scripts/reset-demo.mjs exists and runnable',        category: 'F — Demo Readiness' },
  // G
  { id: 'G1', label: 'Root redirect → /login (no auth)',                  category: 'G — Real HTTP' },
  { id: 'G2', label: 'GET /login → 200 with PURA branding',               category: 'G — Real HTTP' },
  { id: 'G3', label: 'Demo user auth — session cookie acquired',          category: 'G — Real HTTP' },
  { id: 'G4', label: 'GET /dashboard with demo session → 200 + content',  category: 'G — Real HTTP' },
  { id: 'G5', label: 'GET /settings with demo session → 200',             category: 'G — Real HTTP' },
  { id: 'G6', label: '/admin/preflight protected (unauthenticated ≠ 200)', category: 'G — Real HTTP' },
  { id: 'G7', label: 'GET /legal/terms + /legal/privacy → both 200',      category: 'G — Real HTTP' },
  { id: 'G8', label: 'GET /c/[fresh-token] → 200 with check-in form',     category: 'G — Real HTTP' },
]

const CATEGORIES = Array.from(new Set(TESTS.map(t => t.category)))

export function PreflightClient() {
  const [results, setResults] = useState<Results>({})
  const [running, setRunning] = useState(false)
  const [ts, setTs]           = useState<string | null>(null)

  async function runAll() {
    setRunning(true)
    setResults({})
    setTs(null)
    try {
      const res = await fetch('/api/admin/preflight')
      const json = await res.json()
      setResults(json.results ?? {})
      setTs(json.ts ?? null)
    } catch (e) {
      console.error(e)
    }
    setRunning(false)
  }

  const ran       = Object.keys(results).length > 0
  const allPassed = ran && TESTS.every(t => results[t.id]?.pass)
  const anyFailed = ran && TESTS.some(t => results[t.id] && !results[t.id].pass)
  const passCount = TESTS.filter(t => results[t.id]?.pass).length

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={runAll}
          disabled={running}
          className="px-5 py-2 rounded-md bg-magenta text-white font-sans text-sm font-medium hover:bg-magenta/80 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running…' : ran ? 'Re-run all' : 'Run preflight'}
        </button>
        {ran && (
          <span className="text-xs font-sans text-text-muted">
            {passCount}/{TESTS.length} passed
            {ts ? ` · ${new Date(ts).toLocaleTimeString()}` : ''}
          </span>
        )}
      </div>

      {/* Ready banner */}
      {allPassed && (
        <div className="rounded-lg border-2 border-signal-green bg-signal-green/10 p-6 text-center space-y-1">
          <p className="font-serif text-4xl text-signal-green">READY TO SHARE</p>
          <p className="font-sans text-sm text-signal-green/80">All {TESTS.length} checks passed.</p>
        </div>
      )}
      {anyFailed && ran && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="font-sans text-sm text-red-400">{TESTS.filter(t => results[t.id] && !results[t.id].pass).length} check(s) failed — see details below.</p>
        </div>
      )}

      {/* Category groups */}
      {CATEGORIES.map(cat => {
        const catTests = TESTS.filter(t => t.category === cat)
        const catPass  = catTests.filter(t => results[t.id]?.pass).length
        const catRan   = catTests.filter(t => results[t.id]).length
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">{cat}</p>
              {catRan > 0 && (
                <span className="text-[10px] font-sans text-text-muted">{catPass}/{catTests.length}</span>
              )}
            </div>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
              {catTests.map(test => {
                const r = results[test.id]
                const isRunning = running && !r
                return (
                  <div key={test.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="font-mono text-[10px] text-text-muted w-6 shrink-0 mt-0.5">{test.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-sans text-sm ${r ? (r.pass ? 'text-text-primary' : 'text-red-400') : 'text-text-muted'}`}>
                        {test.label}
                      </p>
                      {r && (
                        <p className="font-mono text-[10px] text-text-muted mt-0.5 truncate">{r.detail}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r && (
                        <span className="font-mono text-[10px] text-text-muted">{r.ms}ms</span>
                      )}
                      {isRunning ? (
                        <span className="text-[10px] font-sans text-text-muted animate-pulse">…</span>
                      ) : r ? (
                        r.pass
                          ? <span className="text-signal-green text-xs">✓</span>
                          : <span className="text-red-400 text-xs">✗</span>
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-border inline-block" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
