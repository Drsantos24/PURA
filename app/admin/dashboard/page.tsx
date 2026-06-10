import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  const service = createServiceClient()
  const today     = new Date().toISOString().slice(0, 10)
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: clinics },
    { count: totalPatients },
    { count: checkinsToday },
    { data: redZoneData },
    { data: dailyCheckins },
    { data: briefings },
  ] = await Promise.all([
    service.from('clinics').select('id, clinic_name, owner_email, created_at, onboarding_complete'),
    service.from('patients').select('*', { count: 'exact', head: true }).eq('enrollment_status', 'active'),
    service.from('daily_checkins').select('*', { count: 'exact', head: true }).eq('checkin_date', today),
    service.from('pura_index_history').select('clinic_id').lt('pura_signal', 55).gte('calculated_at', sevenAgo),
    service.from('daily_checkins').select('clinic_id, checkin_date').gte('checkin_date', thirtyAgo.slice(0, 10)),
    service.from('briefings').select('clinic_id, generated_at').gte('generated_at', thirtyAgo).order('generated_at', { ascending: false }),
  ])

  // Per-clinic stats
  const clinicList = clinics ?? []
  const patientCountMap: Record<string, number> = {}
  const checkinCountMap: Record<string, Record<string, number>> = {}

  for (const c of dailyCheckins ?? []) {
    if (!checkinCountMap[c.clinic_id]) checkinCountMap[c.clinic_id] = {}
    checkinCountMap[c.clinic_id][c.checkin_date] = (checkinCountMap[c.clinic_id][c.checkin_date] ?? 0) + 1
  }

  // Fetch per-clinic patient counts
  const { data: patRows } = await service
    .from('patients').select('clinic_id').eq('enrollment_status', 'active')
  for (const r of patRows ?? []) {
    patientCountMap[r.clinic_id] = (patientCountMap[r.clinic_id] ?? 0) + 1
  }

  // Last briefing per clinic
  const lastBriefingMap: Record<string, string> = {}
  for (const b of briefings ?? []) {
    if (!lastBriefingMap[b.clinic_id]) lastBriefingMap[b.clinic_id] = b.generated_at
  }

  // 30-day daily check-in chart data
  const chartByDate: Record<string, number> = {}
  for (const c of dailyCheckins ?? []) {
    chartByDate[c.checkin_date] = (chartByDate[c.checkin_date] ?? 0) + 1
  }
  const chartDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const chartData = chartDates.map(d => ({ date: d, count: chartByDate[d] ?? 0 }))
  const maxCount  = Math.max(...chartData.map(d => d.count), 1)

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

  return (
    <main className="min-h-screen bg-background px-4 sm:px-8 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-text-primary">PURA — Founder View</h1>
            <p className="font-sans text-xs text-text-muted mt-1">Clinic-level aggregates only. No PHI.</p>
          </div>
          <nav className="hidden sm:flex gap-3 text-xs font-sans">
            {[['invites','/admin/invites'],['health','/admin/health'],['checklist','/admin/launch-checklist']].map(([l,h]) => (
              <a key={l} href={h} className="text-text-muted hover:text-text-primary transition-colors capitalize">{l}</a>
            ))}
          </nav>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total clinics',      value: clinicList.length,              sub: `${clinicList.filter(c => c.onboarding_complete).length} active` },
            { label: 'Total patients',     value: totalPatients ?? 0,             sub: 'enrolled active' },
            { label: 'Check-ins today',    value: checkinsToday ?? 0,             sub: today },
            { label: 'Red zone (7d)',       value: (redZoneData ?? []).length,     sub: 'unique signals < 55' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-surface/30 p-4 space-y-1">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest">{s.label}</p>
              <p className="font-mono text-3xl text-text-primary">{s.value}</p>
              <p className="text-xs font-sans text-text-muted/70">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* 30-day check-in chart */}
        <div className="rounded-lg border border-border bg-surface/30 p-5 space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">Daily Check-ins — All Clinics (30d)</p>
          <div className="flex items-end gap-0.5 h-20">
            {chartData.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full rounded-sm bg-magenta/60 transition-all"
                  style={{ height: `${Math.round((d.count / maxCount) * 76)}px`, minHeight: d.count > 0 ? '2px' : '0' }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-sans text-text-muted">
            <span>{chartDates[0]}</span>
            <span>{chartDates[chartDates.length - 1]}</span>
          </div>
        </div>

        {/* Per-clinic table */}
        <div className="space-y-3">
          <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">Per-Clinic Summary</p>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {clinicList.map(c => {
              const pCount  = patientCountMap[c.id] ?? 0
              const ciLast7 = Object.entries(checkinCountMap[c.id] ?? {})
                .filter(([d]) => d >= sevenAgo.slice(0, 10))
                .reduce((s, [, n]) => s + n, 0)
              const lastBrief = lastBriefingMap[c.id]
              return (
                <div key={c.id} className="rounded-lg border border-border bg-surface/30 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-sans text-sm font-medium text-text-primary">{c.clinic_name}</p>
                    <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                      c.onboarding_complete ? 'text-signal-green bg-signal-green/10' : 'text-amber-400 bg-amber-400/10'
                    }`}>{c.onboarding_complete ? 'Active' : 'Onboarding'}</span>
                  </div>
                  <p className="font-sans text-xs text-text-muted">{c.owner_email}</p>
                  <div className="flex gap-4 text-xs font-sans text-text-muted">
                    <span><span className="font-mono text-text-primary">{pCount}</span> patients</span>
                    <span><span className="font-mono text-text-primary">{ciLast7}</span> check-ins (7d)</span>
                    <span>{lastBrief ? new Date(lastBrief).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {['Clinic', 'Owner', 'Age', 'Patients', 'Check-ins (7d)', 'Last Briefing', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-text-muted font-medium uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clinicList.map(c => {
                  const pCount   = patientCountMap[c.id] ?? 0
                  const ciLast7  = Object.entries(checkinCountMap[c.id] ?? {})
                    .filter(([d]) => d >= sevenAgo.slice(0, 10))
                    .reduce((s, [, n]) => s + n, 0)
                  const lastBrief = lastBriefingMap[c.id]
                  const daysAgo  = daysSince(c.created_at)
                  return (
                    <tr key={c.id} className="border-b border-border/40 hover:bg-surface/30 transition-colors">
                      <td className="px-4 py-3 text-text-primary font-medium">{c.clinic_name}</td>
                      <td className="px-4 py-3 text-text-muted">{c.owner_email}</td>
                      <td className="px-4 py-3 text-text-muted">{daysAgo}d</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{pCount}</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{ciLast7}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {lastBrief ? new Date(lastBrief).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          c.onboarding_complete ? 'text-signal-green bg-signal-green/10' : 'text-amber-400 bg-amber-400/10'
                        }`}>
                          {c.onboarding_complete ? 'Active' : 'Onboarding'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
