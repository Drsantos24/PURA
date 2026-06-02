import 'server-only'

// Each clinic's specific data, language, and patient information stays within their clinic's row, protected by RLS.
// PURA learns from anonymized aggregate patterns across all clinics — what works, what doesn't, at the platform level.
// No clinic's specific words, patients, or proprietary approaches are ever shared with or visible to another clinic.
// This is the model: clinic-facing experience is proprietary to each clinic. PURA-the-platform learning is aggregate-only.

import { createServiceClient } from '@/lib/supabase/server'

export type WeeklyInsightSummary = {
  weekStart:             string
  totalFeedback:         number
  approvalRate:          number
  editRate:              number
  dismissalRate:         number
  ignoredRate:           number
  avgEditDistance:       number | null
  avgResponseTimeSeconds: number | null
  clinicsContributing:   number
  patterns:              string[]
  insightsWritten:       number
}

export async function runWeeklyAggregation(): Promise<WeeklyInsightSummary> {
  const service = createServiceClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // 1 — Mark stale pending drafts as ignored (drafted > 7 days ago, still pending)
  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: staleDrafts } = await service
    .from('message_drafts')
    .select('id, clinic_id, body_text')
    .eq('status', 'pending')
    .lt('drafted_at', staleCutoff)

  for (const draft of staleDrafts ?? []) {
    // Check we haven't already logged this as ignored
    const { data: existing } = await service
      .from('ai_output_feedback')
      .select('id')
      .eq('output_id', draft.id)
      .eq('dc_action', 'ignored')
      .maybeSingle()

    if (!existing) {
      await service.from('ai_output_feedback').insert({
        clinic_id:    draft.clinic_id,
        output_type:  'message_draft',
        output_id:    draft.id,
        dc_action:    'ignored',
        original_text: draft.body_text,
      })
    }

    // Mark draft as dismissed so it stops showing up
    await service
      .from('message_drafts')
      .update({ status: 'dismissed' })
      .eq('id', draft.id)
  }

  // 2 — Pull this week's feedback
  const { data: feedback } = await service
    .from('ai_output_feedback')
    .select('clinic_id, dc_action, edit_distance, response_time_seconds, output_type')
    .gte('created_at', weekAgo)
    .lte('created_at', now)

  if (!feedback?.length) {
    return {
      weekStart:              weekAgo.slice(0, 10),
      totalFeedback:          0,
      approvalRate:           0,
      editRate:               0,
      dismissalRate:          0,
      ignoredRate:            0,
      avgEditDistance:        null,
      avgResponseTimeSeconds: null,
      clinicsContributing:    0,
      patterns:               ['No feedback data this week.'],
      insightsWritten:        0,
    }
  }

  const total        = feedback.length
  const approved     = feedback.filter(f => f.dc_action === 'approved').length
  const edited       = feedback.filter(f => f.dc_action === 'edited').length
  const dismissed    = feedback.filter(f => f.dc_action === 'dismissed').length
  const ignored      = feedback.filter(f => f.dc_action === 'ignored').length
  const uniqueClinics = new Set(feedback.map(f => f.clinic_id)).size

  const editDistances = feedback
    .filter(f => f.edit_distance !== null && f.edit_distance !== undefined)
    .map(f => f.edit_distance as number)
  const avgEditDistance = editDistances.length
    ? Math.round(editDistances.reduce((a, b) => a + b, 0) / editDistances.length)
    : null

  const responseTimes = feedback
    .filter(f => f.response_time_seconds !== null && f.response_time_seconds !== undefined)
    .map(f => f.response_time_seconds as number)
  const avgResponseTime = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null

  const approvalRate  = approved  / total
  const editRate      = edited    / total
  const dismissalRate = dismissed / total
  const ignoredRate   = ignored   / total

  // 3 — Identify patterns (only report when 2+ clinics contribute to avoid identifying single clinics)
  const patterns: string[] = []

  if (uniqueClinics >= 2) {
    if (approvalRate >= 0.7) {
      patterns.push(`High approval rate (${Math.round(approvalRate * 100)}%) across ${uniqueClinics} clinics — AI voice matching is working well.`)
    }
    if (editRate >= 0.4) {
      patterns.push(`High edit rate (${Math.round(editRate * 100)}%) — DCs are commonly rewriting drafts. Consider tightening communication style enforcement.`)
    }
    if (dismissalRate >= 0.3) {
      patterns.push(`Dismissal rate elevated (${Math.round(dismissalRate * 100)}%) — flagged patients may not be matching DCs' actual priorities.`)
    }
    if (ignoredRate >= 0.4) {
      patterns.push(`Ignore rate high (${Math.round(ignoredRate * 100)}%) — drafts sitting untouched for 7+ days. Consider reducing draft volume or improving targeting.`)
    }
    if (avgEditDistance !== null && avgEditDistance > 80) {
      patterns.push(`Average edit distance ${avgEditDistance} chars — significant rewrites happening. Prompts may need stronger voice enforcement.`)
    }
    if (avgEditDistance !== null && avgEditDistance < 20 && editRate > 0.1) {
      patterns.push(`Low avg edit distance (${avgEditDistance} chars) despite edits — DCs making minor tweaks only. AI voice is close but not quite.`)
    }
  } else if (uniqueClinics === 1) {
    patterns.push(`Only 1 clinic contributed feedback this week — aggregate patterns require 2+ clinics. Growing signal base.`)
  }

  if (patterns.length === 0) {
    patterns.push(`${total} feedback events across ${uniqueClinics} clinic(s). Approval: ${Math.round(approvalRate * 100)}%, Edit: ${Math.round(editRate * 100)}%, Dismiss: ${Math.round(dismissalRate * 100)}%.`)
  }

  // 4 — Write aggregated insight (only if there's meaningful signal)
  let insightsWritten = 0
  if (total >= 5 && uniqueClinics >= 1) {
    const { error } = await service.from('pura_learning_insights').insert({
      insight_type: 'weekly_feedback_aggregate',
      aggregated_data: {
        week_start:              weekAgo.slice(0, 10),
        total_feedback:          total,
        clinics_contributing:    uniqueClinics,
        approval_rate:           approvalRate,
        edit_rate:               editRate,
        dismissal_rate:          dismissalRate,
        ignored_rate:            ignoredRate,
        avg_edit_distance:       avgEditDistance,
        avg_response_time_s:     avgResponseTime,
        patterns,
        // Deliberately no clinic_id, no clinic names, no patient data
      },
      confidence_score: Math.min(0.95, uniqueClinics * 0.15 + total * 0.01),
    })
    if (!error) insightsWritten = 1
  }

  return {
    weekStart:              weekAgo.slice(0, 10),
    totalFeedback:          total,
    approvalRate,
    editRate,
    dismissalRate,
    ignoredRate,
    avgEditDistance,
    avgResponseTimeSeconds: avgResponseTime,
    clinicsContributing:    uniqueClinics,
    patterns,
    insightsWritten,
  }
}
