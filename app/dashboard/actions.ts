'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms/twilio'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawerCheckin = {
  id: string
  checkin_date: string
  pain_level: number
  sleep_quality: number
  sleep_hours: number
  energy_level: number
  stress_level: number
  functional_ability: number
  mood: number
  hrv_manual: number | null
  rhr_manual: number | null
  sleep_score: number | null
  readiness_score: number | null
  pura_signal: number | null
}

export type DrawerSignalPoint = { date: string; signal: number }

export type DrawerDraft = {
  id: string
  body_text: string
}

export type PatientDetailData = {
  checkins:      DrawerCheckin[]
  signalHistory: DrawerSignalPoint[]
  pendingDraft:  DrawerDraft | null
}

// ─── Fetch patient detail (lazy-loaded when drawer opens) ─────────────────────

export async function fetchPatientDetail(patientId: string): Promise<PatientDetailData> {
  const supabase = await createClient()

  const [{ data: checkins }, { data: signals }, { data: draft }] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('id, checkin_date, pain_level, sleep_quality, sleep_hours, energy_level, stress_level, functional_ability, mood, hrv_manual, rhr_manual, sleep_score, readiness_score')
      .eq('patient_id', patientId)
      .order('checkin_date', { ascending: false })
      .limit(5),
    supabase
      .from('pura_index_history')
      .select('pura_signal, calculated_at')
      .eq('patient_id', patientId)
      .order('calculated_at', { ascending: false })
      .limit(7),
    supabase
      .from('message_drafts')
      .select('id, body_text')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .order('drafted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const signalHistory: DrawerSignalPoint[] = (signals ?? [])
    .map(s => ({ date: s.calculated_at.slice(0, 10), signal: s.pura_signal }))
    .reverse()

  const signalByDate: Record<string, number> = {}
  for (const s of signals ?? []) {
    const d = s.calculated_at.slice(0, 10)
    if (!(d in signalByDate)) signalByDate[d] = s.pura_signal
  }

  return {
    checkins: (checkins ?? []).map(c => ({
      ...c,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sleep_score:     (c as any).sleep_score     ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readiness_score: (c as any).readiness_score ?? null,
      pura_signal:     signalByDate[c.checkin_date] ?? null,
    })),
    signalHistory,
    pendingDraft: draft ?? null,
  }
}

// ─── Short code generator ─────────────────────────────────────────────────────

const CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function makeShortCode(service: ReturnType<typeof createServiceClient>): Promise<string> {
  for (let i = 0; i < 10; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    const { data } = await service
      .from('patient_checkin_tokens')
      .select('id')
      .eq('short_code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Failed to generate unique short code')
}

// ─── Demo: simulated send (indistinguishable from real) ───────────────────────

async function isDemoClinic(service: ReturnType<typeof createServiceClient>, clinicId: string): Promise<boolean> {
  const { data } = await service.from('clinics').select('is_demo').eq('id', clinicId).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.is_demo === true
}

async function simulatedSend(): Promise<true> {
  await new Promise(r => setTimeout(r, 1400))
  return true
}

// ─── Build 1: Send check-in link manually ─────────────────────────────────────

export async function sendCheckinLinkNow(patientId: string): Promise<{
  url: string
  sent: boolean
  firstName: string
}> {
  const service = createServiceClient()

  const { data: patient } = await service
    .from('patients')
    .select('first_name, phone_number, clinic_id, is_demo_live')
    .eq('id', patientId)
    .single()

  if (!patient) throw new Error('Patient not found')

  const { data: clinicRow } = await service
    .from('clinics')
    .select('clinic_name, is_demo')
    .eq('id', patient.clinic_id)
    .single()

  const shortCode = await makeShortCode(service)
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  await service.from('patient_checkin_tokens').insert({
    patient_id: patientId,
    clinic_id:  patient.clinic_id,
    short_code: shortCode,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  const url  = `${baseUrl}/c/${shortCode}`
  const body = `Hi ${patient.first_name}, here's your PURA check-in from ${clinicRow?.clinic_name ?? 'your clinic'}: ${url} — takes 30 seconds.`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDemo     = (clinicRow as any)?.is_demo === true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLivePt   = (patient  as any)?.is_demo_live === true

  let sent: boolean
  if (isDemo && !isLivePt) {
    sent = await simulatedSend()
  } else {
    sent = await sendSMS(patient.phone_number, body)
    if (!sent && isDemo && isLivePt) {
      console.log('[DEMO] Twilio A2P not approved yet — simulating live patient check-in send')
      sent = await simulatedSend()
    }
  }

  return { url, sent, firstName: patient.first_name }
}

// ─── Build 3: Draft message actions ───────────────────────────────────────────

export async function sendDraftAsSMS(draftId: string, patientId: string): Promise<{
  sent: boolean
  body: string
}> {
  const service = createServiceClient()

  const [{ data: draft }, { data: patient }] = await Promise.all([
    service.from('message_drafts').select('body_text').eq('id', draftId).single(),
    service.from('patients').select('phone_number, clinic_id, is_demo_live').eq('id', patientId).single(),
  ])

  if (!draft || !patient) throw new Error('Draft or patient not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLivePt = (patient as any)?.is_demo_live === true
  const isDemo   = await isDemoClinic(service, patient.clinic_id)

  let sent: boolean
  if (isDemo && !isLivePt) {
    sent = await simulatedSend()
  } else {
    sent = await sendSMS(patient.phone_number, draft.body_text)
    if (!sent && isDemo && isLivePt) {
      console.log('[DEMO] Twilio A2P not approved yet — simulating live patient draft send')
      sent = await simulatedSend()
    }
  }

  await service
    .from('message_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', draftId)

  return { sent, body: draft.body_text }
}

export async function dismissDraft(draftId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('message_drafts')
    .update({ status: 'dismissed' })
    .eq('id', draftId)
}

export async function updateDraftBody(draftId: string, body: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('message_drafts')
    .update({ body_text: body.trim() })
    .eq('id', draftId)
}
