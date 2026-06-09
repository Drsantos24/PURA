'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Request = {
  id:                 string
  requested_by_user:  string
  category:           string
  payload:            Record<string, unknown>
  status:             string
  reviewed_by_user:   string | null
  decision_note:      string | null
  created_at:         string
}

const CATEGORY_LABELS: Record<string, string> = {
  outbound_message:  'Outbound Message',
  care_plan_change:  'Care Plan Change',
  intake_edit:       'Profile Edit',
  patient_invite:    'Patient Invite',
  patient_data_edit: 'Patient Data Edit',
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'text-amber-400 bg-amber-400/10',
  approved: 'text-signal-green bg-signal-green/10',
  rejected: 'text-danger bg-danger/10',
  expired:  'text-text-muted bg-border/30',
}

const primaryBtn = 'rounded-md bg-magenta px-4 py-1.5 text-xs font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'
const dangerBtn  = 'rounded-md border border-danger/30 px-4 py-1.5 text-xs font-sans text-danger hover:bg-danger/10 transition-colors'
const ghostBtn   = 'rounded-md border border-border px-4 py-1.5 text-xs font-sans text-text-muted hover:text-text-primary transition-colors'

export function ApprovalInbox({
  requests, userRole, userEmail,
}: {
  requests:  Request[]
  userRole:  'owner' | 'clinician' | 'assistant'
  userEmail: string
}) {
  const router = useRouter()
  const [acting, setActing]     = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [note, setNote]         = useState('')
  const [editId, setEditId]     = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const pending  = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  async function approve(r: Request, edited?: string) {
    setActing(r.id)
    const editedPayload = edited !== undefined
      ? { ...r.payload as Record<string, unknown>, body: edited }
      : undefined
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', requestId: r.id, editedPayload }),
    })
    setActing(null)
    setEditId(null)
    router.refresh()
  }

  async function reject(r: Request) {
    setActing(r.id)
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', requestId: r.id, note }),
    })
    setActing(null)
    setRejectId(null)
    setNote('')
    router.refresh()
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="font-sans text-sm text-text-muted">No approval requests</p>
        {userRole === 'owner' && (
          <p className="font-sans text-xs text-text-muted/60">
            When your team members send messages or invite patients, they appear here for your review.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-sans text-xs font-medium text-text-muted uppercase tracking-widest">
            Pending ({pending.length})
          </h2>
          {pending.map(r => (
            <div key={r.id} className="rounded-lg border border-border bg-surface/30 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-magenta/70 bg-magenta/10 px-2 py-0.5 rounded">
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </span>
                    <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs font-sans text-text-muted">
                    Requested by {r.requested_by_user} &middot; {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Payload preview */}
              {r.category === 'outbound_message' && (
                <div className="rounded-md bg-surface border border-border/50 p-3">
                  {editId === r.id ? (
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={4}
                      className="w-full bg-transparent text-sm font-sans text-text-primary resize-none focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm font-sans text-text-primary whitespace-pre-wrap">
                      {String(r.payload.body ?? r.payload.draft_body ?? '')}
                    </p>
                  )}
                </div>
              )}

              {r.category !== 'outbound_message' && (
                <pre className="rounded-md bg-surface border border-border/50 p-3 text-xs font-mono text-text-muted overflow-auto max-h-32">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
              )}

              {/* Reject note input */}
              {rejectId === r.id && (
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Reason for rejection (shown to requester)..."
                  rows={2}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-danger focus:outline-none resize-none"
                />
              )}

              {userRole === 'owner' && (
                <div className="flex items-center gap-2">
                  {editId === r.id ? (
                    <>
                      <button type="button" onClick={() => approve(r, editBody)} disabled={acting === r.id} className={primaryBtn}>
                        Approve edited
                      </button>
                      <button type="button" onClick={() => setEditId(null)} className={ghostBtn}>Cancel</button>
                    </>
                  ) : rejectId === r.id ? (
                    <>
                      <button type="button" onClick={() => reject(r)} disabled={acting === r.id} className={dangerBtn}>
                        Confirm reject
                      </button>
                      <button type="button" onClick={() => setRejectId(null)} className={ghostBtn}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => approve(r)} disabled={acting === r.id} className={primaryBtn}>
                        {acting === r.id ? 'Approving...' : 'Approve'}
                      </button>
                      {r.category === 'outbound_message' && (
                        <button type="button" onClick={() => { setEditId(r.id); setEditBody(String(r.payload.body ?? r.payload.draft_body ?? '')) }} className={ghostBtn}>
                          Edit & approve
                        </button>
                      )}
                      <button type="button" onClick={() => setRejectId(r.id)} className={dangerBtn}>Reject</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-sans text-xs font-medium text-text-muted uppercase tracking-widest">
            Reviewed ({reviewed.length})
          </h2>
          {reviewed.map(r => (
            <div key={r.id} className="rounded-lg border border-border/40 bg-surface/10 p-4 space-y-2 opacity-70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-magenta/50 bg-magenta/5 px-2 py-0.5 rounded">
                  {CATEGORY_LABELS[r.category] ?? r.category}
                </span>
                <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[r.status]}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-xs font-sans text-text-muted">
                {r.requested_by_user} &middot; {new Date(r.created_at).toLocaleDateString()}
                {r.reviewed_by_user && ` · Reviewed by ${r.reviewed_by_user}`}
              </p>
              {r.decision_note && (
                <p className="text-xs font-sans text-danger/80">Note: {r.decision_note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
