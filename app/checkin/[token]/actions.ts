'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type ActionState = { error: string | null }

function parseOptInt(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string | null
  if (!v || v.trim() === '') return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

export async function submitCheckin(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = formData.get('token') as string | null
  if (!token) return { error: 'Missing token.' }

  const service = createServiceClient()

  const { data: tokenRow } = await service
    .from('patient_checkin_tokens')
    .select('id, patient_id, clinic_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!tokenRow) return { error: 'This check-in link is invalid. Please contact your clinic for a new one.' }
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'This check-in link has expired. A fresh one will arrive tomorrow morning.' }
  if (tokenRow.used_at) return { error: "You've already submitted today's check-in. See you tomorrow!" }

  // Required fields
  const pain         = parseInt(formData.get('pain_level')         as string, 10)
  const sleepQuality = parseInt(formData.get('sleep_quality')      as string, 10)
  const sleepHours   = parseFloat(formData.get('sleep_hours')      as string)
  const energy       = parseInt(formData.get('energy_level')       as string, 10)
  const stress       = parseInt(formData.get('stress_level')       as string, 10)
  const functional   = parseInt(formData.get('functional_ability') as string, 10)
  const mood         = parseInt(formData.get('mood')               as string, 10)

  if ([pain, sleepQuality, energy, stress, functional, mood].some(isNaN) || isNaN(sleepHours)) {
    return { error: 'Please fill in all required fields before submitting.' }
  }
  if (
    pain < 0 || pain > 10 || sleepQuality < 0 || sleepQuality > 10 ||
    sleepHours < 0 || sleepHours > 12 ||
    energy < 0 || energy > 10 || stress < 0 || stress > 10 ||
    functional < 0 || functional > 10 || mood < 0 || mood > 10
  ) {
    return { error: 'One or more values are out of range. Please review your answers.' }
  }

  // Optional wearable fields
  const note           = (formData.get('patient_note') as string | null)?.trim() || null
  const hrv            = parseOptInt(formData, 'hrv_manual')
  const rhr            = parseOptInt(formData, 'rhr_manual')
  const sleepScore     = parseOptInt(formData, 'sleep_score')
  const readinessScore = parseOptInt(formData, 'readiness_score')
  const deepSleep      = parseOptInt(formData, 'deep_sleep_minutes')
  const remSleep       = parseOptInt(formData, 'rem_sleep_minutes')
  const totalSteps     = parseOptInt(formData, 'total_steps')
  const activeCalories = parseOptInt(formData, 'active_calories')

  const insertResult = await service.from('daily_checkins').insert({
      patient_id: tokenRow.patient_id, clinic_id: tokenRow.clinic_id,
      pain_level: pain, sleep_quality: sleepQuality, sleep_hours: sleepHours,
      energy_level: energy, stress_level: stress, functional_ability: functional, mood,
      hrv_manual: hrv, rhr_manual: rhr, patient_note: note,
      sleep_score: sleepScore, readiness_score: readinessScore,
      deep_sleep_minutes: deepSleep, rem_sleep_minutes: remSleep,
      total_steps: totalSteps, active_calories: activeCalories,
      checkin_date: new Date().toISOString().slice(0, 10),
  })

  if (insertResult.error) {
    console.error('checkin insert error:', insertResult.error.message)
    return { error: 'Something went wrong. Please try again.' }
  }

  // Mark token consumed
  await service
    .from('patient_checkin_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // ── Patient results email (fire-and-wait with 3s cap) ──────────────────────
  try {
    const { sendCheckinResultsEmail, computeSignalFromValues, signalToZone, generateEncouragingLine } =
      await import('@/lib/email/checkin-results')

    // Fetch patient email + clinic info + clinic voice in parallel
    const [patRow, clinicRow, profileRow, trendRow] = await Promise.all([
      service.from('patients').select('email, first_name').eq('id', tokenRow.patient_id).single(),
      service.from('clinics').select('clinic_name, is_demo').eq('id', tokenRow.clinic_id).single(),
      service.from('clinic_profiles')
        .select('clinic_vocabulary, practice_philosophy')
        .eq('clinic_id', tokenRow.clinic_id).maybeSingle(),
      service.from('pura_index_history')
        .select('pura_signal')
        .eq('patient_id', tokenRow.patient_id)
        .order('calculated_at', { ascending: true })
        .limit(7),
    ])

    const patEmail = patRow.data?.email
    const isDemo   = (clinicRow.data as { is_demo?: boolean } | null)?.is_demo === true

    if (patEmail) {
      const signal = computeSignalFromValues({
        pain: pain, sleepQuality, sleepHours, energy, stress, functional, mood,
      })
      const zone  = signalToZone(signal)
      const trend = (trendRow.data ?? []).map(r => r.pura_signal)

      const [encouragingLine] = await Promise.all([
        generateEncouragingLine({
          zone, signal,
          clinicVocabulary: profileRow.data?.clinic_vocabulary,
          clinicPhilosophy: profileRow.data?.practice_philosophy,
          patientFirstName: patRow.data?.first_name ?? 'there',
        }),
      ])

      const emailInput = {
        patientFirstName: patRow.data?.first_name ?? 'there',
        clinicName:       clinicRow.data?.clinic_name ?? 'Your Care Team',
        signal, zone, trend, encouragingLine,
      }

      if (isDemo) {
        // Demo: log only, don't send
        console.log('[checkin-email] Demo mode — would send to:', patEmail, JSON.stringify(emailInput))
      } else {
        void sendCheckinResultsEmail({ toEmail: patEmail, input: emailInput })
      }
    }
  } catch (emailErr) {
    // Non-fatal — never block patient redirect on email failure
    console.error('[checkin-email] Error (non-fatal):', emailErr)
  }

  redirect(`/checkin/${token}/done`)
}
