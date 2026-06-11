import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

export type RetryResult = {
  clinic_id:  string
  clinic_name: string
  action:     string
  success:    boolean
  error?:     string
}

export type DigestData = {
  date:    string   // YYYY-MM-DD
  window:  { start: string; end: string }

  clinics: Array<{
    clinic_id:   string
    clinic_name: string
    briefing_ok: boolean
    morning_run: boolean   // true if access_log has morning_send for today
  }>

  checkinsToday: number
  checkinsLast7: number

  errorEvents: Array<{
    clinic_id:   string | null
    action:      string
    actor_email: string
    created_at:  string
  }>

  anomalies:     string[]
  retryResults:  RetryResult[]
}

export async function gatherDigest(): Promise<DigestData> {
  const service = createServiceClient()
  const now     = new Date()
  const today   = now.toISOString().slice(0, 10)
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const sevenAgo    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch in parallel
  const [
    { count: checkinsToday },
    { count: checkinsLast7 },
    { data: briefings },
    { data: allClinics },
    { data: logs },
  ] = await Promise.all([
    service
      .from('daily_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('checkin_date', today),

    service
      .from('daily_checkins')
      .select('*', { count: 'exact', head: true })
      .gte('checkin_date', sevenAgo),

    service
      .from('briefings')
      .select('clinic_id')
      .gte('generated_at', `${today}T00:00:00`),

    service
      .from('clinics')
      .select('id, clinic_name')
      .eq('onboarding_complete', true),

    service
      .from('access_log')
      .select('clinic_id, actor_email, action, created_at')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const briefingSet    = new Set((briefings  ?? []).map(b => b.clinic_id))
  const morningRunSet  = new Set(
    (logs ?? [])
      .filter(l => l.action === 'morning_send')
      .map(l => l.clinic_id)
  )

  const errorEvents = (logs ?? []).filter(l =>
    typeof l.action === 'string' && (l.action.includes('fail') || l.action.includes('error'))
  )

  const clinics = (allClinics ?? []).map(c => ({
    clinic_id:   c.id,
    clinic_name: c.clinic_name ?? 'Unknown',
    briefing_ok: briefingSet.has(c.id),
    morning_run: morningRunSet.has(c.id),
  }))

  // ── Anomaly detection ─────────────────────────────────────────────────────
  const anomalies: string[] = []

  const missingBriefings = clinics.filter(c => !c.briefing_ok)
  if (missingBriefings.length > 0) {
    anomalies.push(
      `No briefing generated today for: ${missingBriefings.map(c => c.clinic_name).join(', ')}`
    )
  }

  if (errorEvents.length >= 5) {
    anomalies.push(`Elevated error count: ${errorEvents.length} error events in the last 24 h`)
  }

  if ((checkinsToday ?? 0) === 0 && clinics.length > 0) {
    anomalies.push(
      `Zero check-ins received today across ${clinics.length} clinic(s) — morning send may have failed`
    )
  }

  const missingMorningRun = clinics.filter(c => !c.morning_run)
  if (missingMorningRun.length > 0 && clinics.length > 0) {
    anomalies.push(
      `Morning send not logged for: ${missingMorningRun.map(c => c.clinic_name).join(', ')}`
    )
  }

  return {
    date: today,
    window: { start: windowStart, end: now.toISOString() },
    clinics,
    checkinsToday: checkinsToday ?? 0,
    checkinsLast7: checkinsLast7 ?? 0,
    errorEvents: errorEvents.map(e => ({
      clinic_id:   e.clinic_id ?? null,
      action:      e.action  ?? '',
      actor_email: e.actor_email ?? '',
      created_at:  e.created_at  ?? '',
    })),
    anomalies,
    retryResults: [],  // populated by the caller after retry runs
  }
}
