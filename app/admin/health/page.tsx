import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export default async function AdminHealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  const service   = createServiceClient()
  const last24h   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const last7d    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today     = new Date().toISOString().slice(0, 10)

  const [
    { data: recentLogs },
    { data: briefings },
    { count: totalCheckins },
    { count: checkins24h },
  ] = await Promise.all([
    service.from('access_log').select('action, actor_email, created_at').gte('created_at', last24h)
      .order('created_at', { ascending: false }).limit(50),
    service.from('briefings').select('clinic_id, generated_at, summary_text').gte('generated_at', last7d)
      .order('generated_at', { ascending: false }).limit(20),
    service.from('daily_checkins').select('*', { count: 'exact', head: true }),
    service.from('daily_checkins').select('*', { count: 'exact', head: true }).gte('created_at', last24h),
  ])

  // Error rate: actions that look like errors
  const logs  = recentLogs ?? []
  const errorLogs = logs.filter(l =>
    l.action?.includes('error') || l.action?.includes('failed') || l.action?.includes('rejected')
  )

  // Cron health: check if briefings were generated today for each clinic
  const { data: clinics } = await service.from('clinics').select('id, clinic_name').eq('onboarding_complete', true)
  const briefingsToday = new Set((briefings ?? [])
    .filter(b => b.generated_at.startsWith(today))
    .map(b => b.clinic_id))

  // Env key presence (not values)
  const keyStatus = {
    ANTHROPIC_API_KEY:      !!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('placeholder'),
    OPENAI_API_KEY:         !!process.env.OPENAI_API_KEY    && !process.env.OPENAI_API_KEY.startsWith('placeholder'),
    GROQ_API_KEY:           !!process.env.GROQ_API_KEY      && !process.env.GROQ_API_KEY.startsWith('placeholder'),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID:     !!process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('placeholder'),
    CRON_SECRET:            !!process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL:    !!process.env.NEXT_PUBLIC_APP_URL,
  }

  return (
    <main className="min-h-screen bg-background px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-text-primary">System Health</h1>
          <nav className="flex gap-3 text-xs font-sans">
            {[['dashboard','/admin/dashboard'],['invites','/admin/invites'],['checklist','/admin/launch-checklist']].map(([l,h]) => (
              <a key={l} href={h} className="text-text-muted hover:text-text-primary transition-colors capitalize">{l}</a>
            ))}
          </nav>
        </div>

        {/* Key presence */}
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">Environment Keys</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(keyStatus).map(([k, present]) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-border bg-surface/30 px-4 py-2.5">
                <span className="text-xs font-mono text-text-muted">{k}</span>
                <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  present ? 'text-signal-green bg-signal-green/10' : 'text-danger bg-danger/10'
                }`}>
                  {present ? 'Set' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cron health */}
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">Morning Cron — Today</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {['Clinic', 'Briefing Today'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-text-muted font-medium uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(clinics ?? []).map(c => (
                  <tr key={c.id} className="border-b border-border/40">
                    <td className="px-4 py-2.5 text-text-primary">{c.clinic_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        briefingsToday.has(c.id)
                          ? 'text-signal-green bg-signal-green/10'
                          : 'text-amber-400 bg-amber-400/10'
                      }`}>
                        {briefingsToday.has(c.id) ? 'Generated' : 'Not yet'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Check-in volume */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total check-ins (all time)', value: totalCheckins ?? 0 },
            { label: 'Check-ins last 24h',          value: checkins24h ?? 0 },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-surface/30 p-4 space-y-1">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest">{s.label}</p>
              <p className="font-mono text-3xl text-text-primary">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Error rate */}
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">
            Recent Error/Rejection Events (24h) — {errorLogs.length} of {logs.length} logged actions
          </p>
          {errorLogs.length === 0 ? (
            <p className="text-xs font-sans text-signal-green">No error events in last 24h</p>
          ) : (
            <div className="rounded-md border border-border divide-y divide-border/40 max-h-48 overflow-y-auto">
              {errorLogs.slice(0, 20).map((l, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-mono text-danger">{l.action}</span>
                  <span className="text-[10px] font-sans text-text-muted">
                    {l.actor_email} &middot; {new Date(l.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent briefings */}
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">Recent Briefings (7d)</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(briefings ?? []).slice(0, 10).map((b, i) => (
              <div key={i} className="rounded-md border border-border/40 bg-surface/20 px-4 py-2.5 space-y-1">
                <p className="text-[10px] font-sans text-text-muted">
                  {new Date(b.generated_at).toLocaleString()}
                </p>
                <p className="text-xs font-sans text-text-primary line-clamp-2">{b.summary_text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
