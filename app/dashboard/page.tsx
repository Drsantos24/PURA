import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopStrip from './_components/TopStrip'
import PatientRoster, { type PatientSummary, type BriefingData } from './_components/PatientRoster'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, clinic_name, onboarding_complete')
    .eq('owner_email', user.email!)
    .single()

  if (!clinic) redirect('/login')
  if (!clinic.onboarding_complete) redirect('/onboarding')

  const today     = new Date().toISOString().slice(0, 10)
  const sevenAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: patients },
    { data: history },
    { count: checkinsToday },
    { data: briefingRows },
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id, first_name, last_name, chief_complaint, last_checkin_date')
      .eq('enrollment_status', 'active')
      .order('last_name'),
    supabase
      .from('pura_index_history')
      .select('patient_id, pura_signal, calculated_at')
      .gte('calculated_at', sevenAgo)
      .order('calculated_at', { ascending: true }),
    supabase
      .from('daily_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('checkin_date', today),
    supabase
      .from('briefings')
      .select('summary_text, patient_callouts')
      .gte('generated_at', `${today}T00:00:00`)
      .order('generated_at', { ascending: false })
      .limit(1),
  ])

  // Group history rows by patient_id
  type HistRow = { patient_id: string; pura_signal: number; calculated_at: string }
  const byPatient: Record<string, HistRow[]> = {}
  for (const row of history ?? []) {
    if (!byPatient[row.patient_id]) byPatient[row.patient_id] = []
    byPatient[row.patient_id].push(row)
  }

  // Build PatientSummary for each active patient
  const patientList = patients ?? []
  const summaries: PatientSummary[] = patientList.map(p => {
    const rows = byPatient[p.id] ?? []    // already sorted asc by calculated_at
    const latestRow = rows.length > 0 ? rows[rows.length - 1] : null
    return {
      id:               p.id,
      first_name:       p.first_name,
      last_name:        p.last_name,
      chief_complaint:  p.chief_complaint,
      last_checkin_date: p.last_checkin_date,
      latestSignal:     latestRow?.pura_signal ?? null,
      sparkline:        rows.map(r => r.pura_signal),
    }
  })

  // Practice signal = average of each patient's latest-ever signal
  const signalled = summaries.filter(p => p.latestSignal !== null)
  const practiceSignal = signalled.length > 0
    ? Math.round(signalled.reduce((s, p) => s + p.latestSignal!, 0) / signalled.length)
    : null

  // Yesterday's average: latest signal per patient whose calculated_at was yesterday
  const yesterdayRows = (history ?? []).filter(r => r.calculated_at.startsWith(yesterday))
  const yByPatient: Record<string, number> = {}
  for (const r of yesterdayRows) {
    yByPatient[r.patient_id] = r.pura_signal   // already asc, last write wins = most recent
  }
  const ySignals = Object.values(yByPatient)
  const yesterdayAvg = ySignals.length > 0
    ? Math.round(ySignals.reduce((a, b) => a + b, 0) / ySignals.length)
    : null

  const practiceSignalDelta = practiceSignal !== null && yesterdayAvg !== null
    ? practiceSignal - yesterdayAvg
    : null

  const needsAttentionCount = summaries.filter(p => p.latestSignal !== null && p.latestSignal < 55).length

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { filter } = await searchParams

  const briefing: BriefingData | null = briefingRows?.[0]
    ? {
        summary_text:     briefingRows[0].summary_text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patient_callouts: (briefingRows[0].patient_callouts as any) ?? [],
      }
    : null

  return (
    <main className="min-h-screen bg-background px-8 py-8">
      <div className="mx-auto max-w-6xl space-y-8">

        <TopStrip
          clinicName={clinic.clinic_name}
          dateLabel={dateLabel}
          practiceSignal={practiceSignal}
          practiceSignalDelta={practiceSignalDelta}
          checkinsToday={checkinsToday ?? 0}
          totalActive={patientList.length}
          needsAttentionCount={needsAttentionCount}
        />

        {/* Zone 2: Patient Roster */}
        <section aria-label="Patient roster" className="space-y-4">
          <PatientRoster
            patients={summaries}
            briefing={briefing}
            initialFilter={filter}
          />
        </section>

      </div>
    </main>
  )
}
