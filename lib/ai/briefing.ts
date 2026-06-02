import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import {
  generateBriefing,
  generateMessageDraft,
  type DeidentifiedPatient,
  type ClinicContext,
} from './gemini'

async function getClinicProfileContext(clinicId: string): Promise<ClinicContext | null> {
  const service = createServiceClient()
  const [{ data: profile }, { data: clinic }] = await Promise.all([
    service
      .from('clinic_profiles')
      .select('practice_type,typical_care_plan_structure,what_successful_recovery_looks_like,communication_style,communication_style_notes,red_flags,practice_philosophy,patient_demographics,typical_visit_frequency,what_makes_a_good_outcome')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    service
      .from('clinics')
      .select('clinic_name')
      .eq('id', clinicId)
      .single(),
  ])
  if (!profile) return null
  return { clinic_name: clinic?.clinic_name ?? null, ...profile }
}

type PatientRow = {
  id: string
  first_name: string
  clinic_id: string
}

type HistRow = {
  patient_id: string
  pura_signal: number
  calculated_at: string
}

function dayLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  return `${daysAgo} days ago`
}

function trend(signals: number[]): DeidentifiedPatient['trend'] {
  if (signals.length < 2) return 'stable'
  const recent = signals.slice(-3)
  const older  = signals.slice(0, -3)
  if (older.length === 0) return 'stable'
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg  = older.reduce((a, b) => a + b, 0)  / older.length
  if (recentAvg - olderAvg > 5)  return 'improving'
  if (olderAvg  - recentAvg > 5) return 'declining'
  return 'stable'
}

export async function generateBriefingForClinic(clinicId: string): Promise<{
  briefingId: string
  calloutsGenerated: number
  draftsGenerated: number
}> {
  const service = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch patients + 7-day history using service key (bypasses RLS for cron context)
  const [{ data: patients }, { data: history }] = await Promise.all([
    service
      .from('patients')
      .select('id, first_name, clinic_id')
      .eq('clinic_id', clinicId)
      .eq('enrollment_status', 'active'),
    service
      .from('pura_index_history')
      .select('patient_id, pura_signal, calculated_at')
      .eq('clinic_id', clinicId)
      .gte('calculated_at', sevenAgo)
      .order('calculated_at', { ascending: true }),
  ])

  if (!patients?.length) {
    throw new Error(`No active patients for clinic ${clinicId}`)
  }

  // Group history by patient
  const byPatient: Record<string, HistRow[]> = {}
  for (const row of history ?? []) {
    if (!byPatient[row.patient_id]) byPatient[row.patient_id] = []
    byPatient[row.patient_id].push(row)
  }

  // Build de-identified payload — NO names, emails, complaints, phone numbers
  const refToId: Record<string, string> = {}
  const idToFirst: Record<string, string> = {}

  const deidentified: DeidentifiedPatient[] = (patients as PatientRow[]).map((p, i) => {
    const ref = `P-${i + 1}`
    refToId[ref] = p.id
    idToFirst[p.id] = p.first_name

    const rows = byPatient[p.id] ?? []
    const signals = rows.map(r => r.pura_signal)
    const latestRow = rows[rows.length - 1] ?? null
    const yesterdayRow = rows.slice().reverse().find(r => !r.calculated_at.startsWith(today)) ?? null

    const sevenAvg = signals.length
      ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)
      : null

    let daysAgo: number | null = null
    if (latestRow) {
      const latestDate = latestRow.calculated_at.slice(0, 10)
      const msPerDay   = 24 * 60 * 60 * 1000
      daysAgo = Math.floor(
        (new Date(today).getTime() - new Date(latestDate).getTime()) / msPerDay
      )
    }

    return {
      ref,
      signal_today:         latestRow?.calculated_at.startsWith(today) ? latestRow.pura_signal : null,
      signal_yesterday:     yesterdayRow?.pura_signal ?? null,
      signal_7day_avg:      sevenAvg,
      trend:                signals.length >= 2 ? trend(signals) : 'no_data',
      last_checkin:         daysAgo !== null ? dayLabel(daysAgo) : null,
      days_without_checkin: daysAgo,
    }
  })

  // Log de-identified payload — confirms PHI is scrubbed
  console.log('[PURA AI payload — no PHI]', JSON.stringify({ clinic_id: clinicId, patients: deidentified }, null, 2))

  // Fetch clinic profile for AI context injection (operational data, not PHI)
  const clinicProfile = await getClinicProfileContext(clinicId)

  // Call Groq (or no-op stub)
  const briefingResult = await generateBriefing(deidentified, clinicProfile)

  // Re-map patient_refs → real patient_ids in callouts
  type StoredCallout = { patient_id: string; reason: string; suggested_action: string }
  const storedCallouts: StoredCallout[] = briefingResult.callouts
    .filter(c => refToId[c.patient_ref])
    .map(c => ({
      patient_id:       refToId[c.patient_ref],
      reason:           c.reason,
      suggested_action: c.suggested_action,
    }))

  // Store briefing
  const { data: briefingRow, error: bErr } = await service
    .from('briefings')
    .insert({
      clinic_id:        clinicId,
      summary_text:     briefingResult.summary,
      patient_callouts: storedCallouts,
    })
    .select('id')
    .single()

  if (bErr || !briefingRow) throw new Error(`Failed to store briefing: ${bErr?.message}`)

  // Determine which patients need a draft
  let draftsGenerated = 0
  const calloutPatientIds = new Set(storedCallouts.map(c => c.patient_id))

  const needsDraft = deidentified.filter(p => {
    const id = refToId[p.ref]
    if (!id) return false
    // Use most recent signal (today if available, else yesterday)
    const recentSig  = p.signal_today ?? p.signal_yesterday
    const redZone    = recentSig !== null && recentSig < 55
    const bigDrop    = recentSig !== null && p.signal_7day_avg !== null &&
                       p.signal_7day_avg - recentSig >= 15
    const isCallout  = calloutPatientIds.has(id)
    return redZone || bigDrop || isCallout
  })

  for (const p of needsDraft) {
    const patientId = refToId[p.ref]

    // Skip if a pending draft already exists
    const { data: existing } = await service
      .from('message_drafts')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) continue

    // Get clinic name for substitution
    const { data: clinic } = await service
      .from('clinics')
      .select('clinic_name')
      .eq('id', clinicId)
      .single()

    const rawDraft = await generateMessageDraft(p, clinicProfile)

    // Re-insert real name server-side — [Name] and [Clinic] placeholders only
    const finalBody = rawDraft
      .replace(/\[Name\]/g,   idToFirst[patientId] ?? 'there')
      .replace(/\[Clinic\]/g, clinic?.clinic_name ?? 'your care team')

    await service.from('message_drafts').insert({
      clinic_id:  clinicId,
      patient_id: patientId,
      body_text:  finalBody,
      status:     'pending',
    })

    draftsGenerated++
  }

  return {
    briefingId:        briefingRow.id,
    calloutsGenerated: storedCallouts.length,
    draftsGenerated,
  }
}
