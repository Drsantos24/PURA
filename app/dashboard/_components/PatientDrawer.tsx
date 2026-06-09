'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  fetchPatientDetail,
  sendCheckinLinkNow,
  sendDraftAsSMS,
  dismissDraft,
  updateDraftBody,
  logDraftFeedback,
  type PatientDetailData,
} from '../actions'

type Props = {
  patientId:       string | null
  patientName:     string
  chiefComplaint:  string | null
  onClose:         () => void
}

const SLEEP_LABEL: Record<number, string> = { 0: 'Poor', 3: 'Fair', 7: 'Good', 10: 'Excellent' }
function sleepLabel(v: number) { return SLEEP_LABEL[v] ?? `${v}/10` }

function signalColor(s: number) {
  return s >= 80 ? '#22C55E' : s >= 55 ? '#F59E0B' : '#EF4444'
}

// ─── 7-day line chart ─────────────────────────────────────────────────────────

function DrawerChart({ points }: { points: { date: string; signal: number }[] }) {
  if (points.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-text-muted font-sans">
        Not enough data for trend
      </div>
    )
  }
  const W = 400, H = 112, P = { t: 8, r: 8, b: 24, l: 28 }
  const iW = W - P.l - P.r, iH = H - P.t - P.b
  const xOf = (i: number) => P.l + (i / (points.length - 1)) * iW
  const yOf = (v: number) => P.t + (1 - v / 100) * iH
  const line = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.signal).toFixed(1)}`).join(' ')
  const lastColor = signalColor(points[points.length - 1].signal)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="7-day signal trend">
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={P.l} y1={yOf(v)} x2={W - P.r} y2={yOf(v)} stroke="#27272A" strokeWidth="1" />
          <text x={P.l - 4} y={yOf(v) + 3} fontSize="8" fill="#71717A" textAnchor="end">{v}</text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke={lastColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(p.signal)} r="3" fill={signalColor(p.signal)} />
      ))}
      {points.map((p, i) => {
        const d = new Date(p.date + 'T12:00:00')
        return (
          <text key={i} x={xOf(i)} y={H - 4} fontSize="8" fill="#71717A" textAnchor="middle">
            {d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
      <p className="font-mono text-xs text-text-primary">{value}</p>
    </div>
  )
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  patientId,
  onHandled,
}: {
  draft:      { id: string; body_text: string }
  patientId:  string
  onHandled:  (toast: string) => void
}) {
  const [editMode,   setEditMode]   = useState(false)
  const [editText,   setEditText]   = useState(draft.body_text)
  const [busy,       setBusy]       = useState(false)
  const openedAt = useState(() => Date.now())[0]

  function elapsedSeconds() {
    return Math.round((Date.now() - openedAt) / 1000)
  }

  async function handleSend() {
    setBusy(true)
    const elapsed = elapsedSeconds()
    const result = await sendDraftAsSMS(draft.id, patientId)
    // Fire-and-forget: log approved action
    logDraftFeedback(draft.id, 'approved', 0, elapsed, draft.body_text, draft.body_text)
    if (result.pendingApproval) {
      onHandled('Sent for DC approval ✓')
    } else if (result.sent) {
      onHandled('Sent ✓')
    } else {
      await navigator.clipboard.writeText(result.body)
      onHandled('Twilio pending — message copied to clipboard')
    }
  }

  async function handleDismiss() {
    setBusy(true)
    const elapsed = elapsedSeconds()
    await dismissDraft(draft.id)
    // Fire-and-forget: log dismissed action
    logDraftFeedback(draft.id, 'dismissed', 0, elapsed, draft.body_text, '')
    onHandled('Draft dismissed')
  }

  async function handleSaveAndSend() {
    setBusy(true)
    const elapsed = elapsedSeconds()
    const editDistance = Math.abs(editText.length - draft.body_text.length)
    await updateDraftBody(draft.id, editText)
    const result = await sendDraftAsSMS(draft.id, patientId)
    // Fire-and-forget: log edited action with distance
    logDraftFeedback(draft.id, 'edited', editDistance, elapsed, draft.body_text, editText)
    if (result.sent) {
      onHandled('Sent ✓')
    } else {
      await navigator.clipboard.writeText(editText)
      onHandled('Twilio pending — edited message copied to clipboard')
    }
  }

  return (
    <div className="rounded-lg border border-magenta/30 bg-magenta/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-magenta shrink-0" aria-hidden="true" />
        <p className="font-sans text-xs font-medium text-magenta uppercase tracking-widest">AI Draft — Pending Review</p>
      </div>

      {editMode ? (
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={4}
          maxLength={320}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-magenta/40"
          aria-label="Edit draft message"
        />
      ) : (
        <p className="font-sans text-sm text-text-primary leading-relaxed">{draft.body_text}</p>
      )}

      {!editMode ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={busy}
            className="flex-1 rounded-md bg-magenta/20 border border-magenta/40 py-1.5 text-xs font-sans text-magenta hover:bg-magenta/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            {busy ? 'Sending...' : 'Send for Approval'}
          </button>
          <button
            onClick={() => setEditMode(true)}
            disabled={busy}
            className="rounded-md border border-border py-1.5 px-3 text-xs font-sans text-text-muted hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            Edit
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            className="rounded-md border border-border py-1.5 px-3 text-xs font-sans text-text-muted hover:text-danger hover:border-danger/40 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAndSend}
            disabled={busy}
            className="flex-1 rounded-md bg-magenta/20 border border-magenta/40 py-1.5 text-xs font-sans text-magenta hover:bg-magenta/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            Send edited
          </button>
          <button
            onClick={() => { setEditMode(false); setEditText(draft.body_text) }}
            disabled={busy}
            className="rounded-md border border-border py-1.5 px-3 text-xs font-sans text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export default function PatientDrawer({ patientId, patientName, chiefComplaint, onClose }: Props) {
  const [detail,       setDetail]       = useState<PatientDetailData | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [draftHandled, setDraftHandled] = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const [sendBusy,     setSendBusy]     = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setDetail(null)
    setDraftHandled(false)
    const data = await fetchPatientDetail(id)
    setDetail(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (patientId) load(patientId)
  }, [patientId, load])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleSendLink() {
    if (!patientId) return
    setSendBusy(true)
    try {
      const result = await sendCheckinLinkNow(patientId)
      if (result.sent) {
        setToast(`Check-in link sent to ${result.firstName} ✓`)
      } else {
        await navigator.clipboard.writeText(result.url)
        setToast(`Twilio pending — link copied to clipboard`)
      }
    } catch {
      setToast('Error generating link')
    }
    setSendBusy(false)
  }

  const isOpen = patientId !== null

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-label={`Patient detail: ${patientName}`}
        className={`fixed inset-y-0 right-0 w-[520px] max-w-full bg-surface border-l border-border shadow-2xl z-50 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-serif text-2xl text-text-primary">{patientName}</h2>
            {chiefComplaint && (
              <p className="font-sans text-sm text-text-muted mt-0.5">{chiefComplaint}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-border/50 transition-colors focus:outline-none focus:ring-2 focus:ring-magenta/50"
            aria-label="Close patient detail"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14" /><line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-text-muted font-sans">
              Loading…
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Draft card — above everything else */}
              {detail.pendingDraft && !draftHandled && (
                <DraftCard
                  draft={detail.pendingDraft}
                  patientId={patientId!}
                  onHandled={msg => { setDraftHandled(true); setToast(msg) }}
                />
              )}

              {/* 7-day chart */}
              <div>
                <p className="font-sans text-xs uppercase tracking-widest text-text-muted mb-3">7-Day Signal Trend</p>
                <DrawerChart points={detail.signalHistory} />
              </div>

              {/* Check-in history */}
              {detail.checkins.length === 0 ? (
                <p className="font-sans text-sm text-text-muted">No check-ins recorded yet.</p>
              ) : (
                <div>
                  <p className="font-sans text-xs uppercase tracking-widest text-text-muted mb-3">
                    Last {detail.checkins.length} Check-in{detail.checkins.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {detail.checkins.map(c => {
                      const d = new Date(c.checkin_date + 'T12:00:00')
                      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      const hasWearable = c.hrv_manual || c.rhr_manual || c.sleep_score || c.readiness_score
                      return (
                        <div key={c.id} className="rounded-lg border border-border bg-background p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-sans text-sm font-medium text-text-primary">{dateStr}</span>
                            {c.pura_signal !== null && (
                              <span className="font-serif text-xl" style={{ color: signalColor(c.pura_signal) }}>
                                {c.pura_signal}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-x-4 gap-y-1">
                            <Metric label="Pain"     value={`${c.pain_level}/10`} />
                            <Metric label="Sleep"    value={sleepLabel(c.sleep_quality)} />
                            <Metric label="Hrs"      value={`${c.sleep_hours}h`} />
                            <Metric label="Energy"   value={`${c.energy_level}/10`} />
                            <Metric label="Stress"   value={`${c.stress_level}/10`} />
                            <Metric label="Function" value={`${c.functional_ability}/10`} />
                            <Metric label="Mood"     value={`${c.mood}/10`} />
                          </div>
                          {hasWearable && (
                            <div className="grid grid-cols-4 gap-x-4 gap-y-1 pt-1 border-t border-border mt-1 opacity-60">
                              {c.hrv_manual      && <Metric label="HRV"       value={`${c.hrv_manual}ms`} />}
                              {c.rhr_manual      && <Metric label="RHR"       value={`${c.rhr_manual}bpm`} />}
                              {c.sleep_score     && <Metric label="Sleep Sc." value={`${c.sleep_score}`} />}
                              {c.readiness_score && <Metric label="Readiness" value={`${c.readiness_score}`} />}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-20 left-4 right-4 rounded-md bg-surface border border-border px-4 py-3 text-sm font-sans text-text-primary shadow-lg z-10 animate-fade-in">
            {toast}
          </div>
        )}

        {/* Footer: send check-in link */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={handleSendLink}
            disabled={sendBusy || !patientId}
            className="w-full rounded-md border border-border py-2.5 text-sm font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-magenta/40"
          >
            {sendBusy ? 'Sending…' : 'Send check-in link now'}
          </button>
        </div>
      </div>
    </>
  )
}
