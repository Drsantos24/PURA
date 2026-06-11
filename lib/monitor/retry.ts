import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { generateBriefingForClinic } from '@/lib/ai/briefing'
import type { RetryResult } from './digest'

/**
 * Auto-retry briefing generation for any onboarded clinic that has no briefing today.
 * Idempotent — skips clinics that already have a briefing.
 */
export async function retryMissingBriefings(): Promise<RetryResult[]> {
  const service = createServiceClient()
  const today   = new Date().toISOString().slice(0, 10)
  const results: RetryResult[] = []

  const { data: clinics } = await service
    .from('clinics')
    .select('id, clinic_name')
    .eq('onboarding_complete', true)

  if (!clinics?.length) return results

  const { data: existingBriefings } = await service
    .from('briefings')
    .select('clinic_id')
    .gte('generated_at', `${today}T00:00:00`)

  const haveBriefing = new Set((existingBriefings ?? []).map(b => b.clinic_id))

  for (const clinic of clinics) {
    if (haveBriefing.has(clinic.id)) continue

    try {
      await generateBriefingForClinic(clinic.id)

      // Log the successful retry
      await service.from('access_log').insert({
        clinic_id:   clinic.id,
        actor_email: 'monitor@system',
        action:      'auto_retry_briefing_success',
        target_type: 'clinic',
        target_id:   clinic.id,
      }).catch(() => {}) // non-fatal

      results.push({
        clinic_id:   clinic.id,
        clinic_name: clinic.clinic_name ?? clinic.id,
        action:      'briefing',
        success:     true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[monitor/retry] briefing failed for clinic ${clinic.id}:`, msg)

      await service.from('access_log').insert({
        clinic_id:   clinic.id,
        actor_email: 'monitor@system',
        action:      'auto_retry_briefing_failed',
        target_type: 'clinic',
        target_id:   clinic.id,
      }).catch(() => {})

      results.push({
        clinic_id:   clinic.id,
        clinic_name: clinic.clinic_name ?? clinic.id,
        action:      'briefing',
        success:     false,
        error:       msg,
      })
    }
  }

  return results
}
