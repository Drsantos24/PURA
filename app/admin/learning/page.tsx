import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

const PREVIEW_CARDS = [
  {
    title: 'Message tone effectiveness',
    description: 'Which voices — encouraging, clinical, friendly — get approved vs edited vs dismissed. Reveals whether your default tone matches what DCs actually want.',
  },
  {
    title: 'Red flag accuracy',
    description: 'Which clinic-defined triggers actually predict dropout or missed visits. Helps refine alert thresholds across practices.',
  },
  {
    title: 'Care plan correlations',
    description: 'Which care plan structures correlate with highest patient retention and check-in consistency.',
  },
  {
    title: 'Signal trajectory patterns',
    description: 'Common recovery shapes and decline curves — how PURA scores move over a typical 12-week plan.',
  },
  {
    title: 'Anomaly detection',
    description: 'Clinics with stats that diverge meaningfully from the cohort — surfaced for investigation, never exposed to other clinics.',
  },
  {
    title: 'Onboarding depth impact',
    description: 'How the richness of clinic intake (conversational vs form-only) correlates with AI output quality and DC edit rates.',
  },
]

export default async function AdminLearningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  const service = createServiceClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: insights },
    { data: feedbackStats },
    { data: activeClinics },
  ] = await Promise.all([
    service
      .from('pura_learning_insights')
      .select('id, insight_type, aggregated_data, confidence_score, applied_to_prompts_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('ai_output_feedback')
      .select('dc_action, output_type, edit_distance, created_at'),
    service
      .from('clinics')
      .select('id, clinic_name, created_at')
      .eq('onboarding_complete', true)
      .lt('created_at', sevenDaysAgo),
  ])

  const matureClinicCount = activeClinics?.length ?? 0
  const isEmptyState = matureClinicCount < 2

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
    <main className="min-h-screen bg-background px-4 sm:px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-10">

        <div className="border-b border-border pb-6">
          <h1 className="font-serif text-4xl text-text-primary">PURA Learning</h1>
          <p className="mt-1 font-sans text-sm text-text-muted">
            Aggregate platform intelligence — no individual clinic data shown here.
            Requires signal from 2+ clinics before patterns are reported.
          </p>
        </div>

        {/* Empty-state explainer */}
        {isEmptyState && (
          <section className="space-y-6">
            <div className="rounded-lg border border-border bg-surface/50 p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber/70 mt-1.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="font-sans text-sm font-medium text-text-primary">
                    Aggregate insights activate once 2+ clinics have been generating data for at least 7 days.
                  </p>
                  <p className="font-sans text-sm text-text-muted">
                    Currently:{' '}
                    <span className="font-medium text-text-primary">{matureClinicCount} active clinic{matureClinicCount !== 1 ? 's' : ''}</span>
                    {' '}with 7+ days of signal.
                    Patterns will appear here as your beta clinics onboard and begin generating check-in data.
                  </p>
                  <p className="font-sans text-xs text-text-muted/70 mt-1">
                    The 7-day minimum exists to prevent a single clinic&apos;s behavior from masquerading as a &ldquo;pattern.&rdquo;
                    Cross-clinic learning only surfaces when there is genuine signal diversity.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview cards */}
            <div className="space-y-2">
              <p className="font-sans text-xs uppercase tracking-widest text-text-muted font-medium">
                What will appear here when ready
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PREVIEW_CARDS.map(card => (
                  <div key={card.title} className="rounded-lg border border-border/50 bg-surface/30 p-4 space-y-1.5 opacity-60">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-sans text-sm font-medium text-text-primary">{card.title}</p>
                      <span className="text-[10px] font-sans text-text-muted border border-border/60 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                        Soon
                      </span>
                    </div>
                    <p className="font-sans text-xs text-text-muted leading-relaxed">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* All-time aggregate stats — always shown once there's any feedback */}
        {stats.total > 0 && (
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
        )}

        {/* Learning insights — only shown when not empty-state */}
        {!isEmptyState && (
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

                    {data.total_feedback && (
                      <div className="flex flex-wrap gap-4 text-xs font-sans text-text-muted">
                        <span>{data.total_feedback} events · {data.clinics_contributing} clinic(s)</span>
                        <span>Approved {Math.round((data.approval_rate ?? 0) * 100)}%</span>
                        <span>Edited {Math.round((data.edit_rate ?? 0) * 100)}%</span>
                        <span>Dismissed {Math.round((data.dismissal_rate ?? 0) * 100)}%</span>
                      </div>
                    )}

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
        )}

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
