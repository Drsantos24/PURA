import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminLearningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  const service = createServiceClient()

  const [{ data: insights }, { data: feedbackStats }] = await Promise.all([
    service
      .from('pura_learning_insights')
      .select('id, insight_type, aggregated_data, confidence_score, applied_to_prompts_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('ai_output_feedback')
      .select('dc_action, output_type, edit_distance, created_at'),
  ])

  // Aggregate feedback stats — never show per-clinic breakdowns here
  const stats = {
    total:     feedbackStats?.length ?? 0,
    approved:  feedbackStats?.filter(f => f.dc_action === 'approved').length ?? 0,
    edited:    feedbackStats?.filter(f => f.dc_action === 'edited').length ?? 0,
    dismissed: feedbackStats?.filter(f => f.dc_action === 'dismissed').length ?? 0,
    ignored:   feedbackStats?.filter(f => f.dc_action === 'ignored').length ?? 0,
  }

  const editDistances = (feedbackStats ?? [])
    .filter(f => f.edit_distance !== null)
    .map(f => f.edit_distance as number)
  const avgEditDist = editDistances.length
    ? Math.round(editDistances.reduce((a, b) => a + b, 0) / editDistances.length)
    : null

  function pct(n: number) {
    if (!stats.total) return '—'
    return `${Math.round((n / stats.total) * 100)}%`
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-10">

        <div className="border-b border-border pb-6">
          <h1 className="font-serif text-4xl text-text-primary">PURA Learning</h1>
          <p className="mt-1 font-sans text-sm text-text-muted">
            Aggregate platform intelligence — no individual clinic data shown here.
            Requires signal from 2+ clinics before patterns are reported.
          </p>
          <div className="mt-3 flex gap-3">
            <a href="/admin/invites" className="text-xs font-sans text-text-muted hover:text-text-primary">← Invites</a>
          </div>
        </div>

        {/* All-time aggregate stats */}
        <section className="space-y-3">
          <p className="font-sans text-xs uppercase tracking-widest text-text-muted">All-time feedback — aggregate only</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total events',   value: stats.total.toString() },
              { label: 'Approval rate',  value: pct(stats.approved) },
              { label: 'Edit rate',      value: pct(stats.edited) },
              { label: 'Dismiss rate',   value: pct(stats.dismissed) },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="font-sans text-xs text-text-muted uppercase tracking-widest">{s.label}</p>
                <p className="font-mono text-2xl text-text-primary mt-1">{s.value}</p>
              </div>
            ))}
          </div>
          {avgEditDist !== null && (
            <p className="font-sans text-xs text-text-muted">
              Avg edit distance: {avgEditDist} characters — {avgEditDist < 30 ? 'minor tweaks, voice is close' : avgEditDist < 80 ? 'moderate rewrites' : 'significant rewrites — consider prompt review'}
            </p>
          )}
        </section>

        {/* Learning insights */}
        <section className="space-y-3">
          <p className="font-sans text-xs uppercase tracking-widest text-text-muted">Learning insights ({insights?.length ?? 0})</p>

          {!insights?.length && (
            <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center">
              <p className="font-sans text-sm text-text-muted">No insights yet — insights are generated weekly once sufficient feedback exists.</p>
            </div>
          )}

          <div className="space-y-3">
            {(insights ?? []).map(insight => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = insight.aggregated_data as any
              const date = new Date(insight.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <div key={insight.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">{insight.insight_type}</span>
                      {insight.confidence_score !== null && (
                        <span className="font-mono text-xs text-magenta">
                          {Math.round((insight.confidence_score as number) * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <span className="font-sans text-xs text-text-muted">{date}</span>
                  </div>

                  {/* Stats row */}
                  {data.total_feedback && (
                    <div className="flex flex-wrap gap-4 text-xs font-sans text-text-muted">
                      <span>{data.total_feedback} events · {data.clinics_contributing} clinic(s)</span>
                      <span>Approved {Math.round((data.approval_rate ?? 0) * 100)}%</span>
                      <span>Edited {Math.round((data.edit_rate ?? 0) * 100)}%</span>
                      <span>Dismissed {Math.round((data.dismissal_rate ?? 0) * 100)}%</span>
                    </div>
                  )}

                  {/* Patterns */}
                  {Array.isArray(data.patterns) && data.patterns.length > 0 && (
                    <ul className="space-y-1">
                      {data.patterns.map((p: string, i: number) => (
                        <li key={i} className="font-sans text-sm text-text-primary flex gap-2">
                          <span className="text-magenta shrink-0">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {insight.applied_to_prompts_at && (
                    <p className="font-sans text-xs text-signal-green">
                      Applied to prompts: {new Date(insight.applied_to_prompts_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-md border border-border/50 bg-surface/50 px-4 py-3 space-y-1">
          <p className="font-sans text-xs font-medium text-text-muted uppercase tracking-widest">Privacy architecture</p>
          <p className="font-sans text-xs text-text-muted leading-relaxed">
            Each clinic&apos;s data, language, and patient information is protected by row-level security and never leaves their account.
            This page shows only aggregate patterns across all clinics — no per-clinic breakdown, no patient data, no identifiable text.
            Patterns are only surfaced when 2+ clinics contribute signal to avoid identifying any single clinic&apos;s behavior.
          </p>
        </section>

      </div>
    </main>
  )
}
