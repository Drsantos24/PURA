import 'server-only'

// Sync extracted insights from intake_exchanges back into clinic_profiles.
// Called after each answered exchange so the profile stays current.

import { createServiceClient } from '@/lib/supabase/server'
import type { ExtractedInsights } from './questions'

export async function syncInsightsToProfile(
  clinicId: string,
  insights: ExtractedInsights,
  category: string
): Promise<void> {
  const service = createServiceClient()

  const { data: existing } = await service
    .from('clinic_profiles')
    .select('clinic_vocabulary, communication_style_notes, completed_sections')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vocab = (existing?.clinic_vocabulary as any) ?? { preferred_terms: [], banned_words: [], signature_phrases: [] }

  const prefSet = Array.from(new Set([...(vocab.preferred_terms ?? []), ...(insights.vocabulary.preferred ?? [])]))
  const bannSet = Array.from(new Set([...(vocab.banned_words   ?? []), ...(insights.vocabulary.banned   ?? [])]))
  const sigSet  = Array.from(new Set([...(vocab.signature_phrases ?? []), ...insights.key_phrases]))
  const preferred = prefSet
  const banned    = bannSet
  const signature = sigSet

  const update: Record<string, unknown> = {
    clinic_vocabulary: { ...vocab, preferred_terms: preferred, banned_words: banned, signature_phrases: signature },
    last_substantive_edit: new Date().toISOString(),
  }

  // Map category to profile fields
  if (category === 'philosophy' && insights.summary) {
    update.practice_philosophy = insights.summary
  }
  if (category === 'decision_thresholds') {
    const dt = insights.numeric_thresholds
    if (Object.keys(dt).length > 0) update.decision_thresholds = dt
  }
  if (category === 'identity' && insights.clinic_values.length > 0) {
    update.what_you_wish_other_chiropractors_knew = insights.clinic_values.join('. ')
  }

  // Mark section complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completed = (existing?.completed_sections as any) ?? {}
  const sectionMap: Record<string, string> = {
    identity: 'practice_identity', philosophy: 'practice_identity',
    vocabulary: 'clinical_vocabulary', decision_thresholds: 'decision_thresholds',
    patient_journey: 'patient_journey', outcomes: 'outcomes_measured',
  }
  if (sectionMap[category]) completed[sectionMap[category]] = true
  update.completed_sections = completed

  await service
    .from('clinic_profiles')
    .upsert({ clinic_id: clinicId, ...update }, { onConflict: 'clinic_id' })
}
