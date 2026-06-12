import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateBriefingForClinic } from '@/lib/ai/briefing'
import { DEMO_CLINIC_ID, DEMO_PATIENTS, checkinValues } from '@/lib/demo/seed'

// POST /api/cron/demo-reset
// Resets Vitality Spine & Wellness to a fresh demo state anchored to today.
// Runs every Sunday at 06:00 UTC (vercel.json cron).
// Also callable manually: POST with Authorization: Bearer <CRON_SECRET>
//
// Steps:
//   1. Delete existing check-ins, briefings, drafts, index history
//   2. Re-seed 21 days of check-in data for all 26 patients (from today)
//   3. Call generateBriefingForClinic() — regenerates briefing + message drafts
//   4. Log result to access_log

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = new Date().toISOString()
  const service   = createServiceClient()

  try {
    // ── 1. Clear existing demo data ───────────────────────────────────────────
    const [r1, r2, r3] = await Promise.all([
      service.from('daily_checkins').delete().eq('clinic_id', DEMO_CLINIC_ID),
      service.from('briefings').delete().eq('clinic_id', DEMO_CLINIC_ID),
      service.from('message_drafts').delete().eq('clinic_id', DEMO_CLINIC_ID),
    ])
    await service.from('pura_index_history').delete().eq('clinic_id', DEMO_CLINIC_ID)

    if (r1.error || r2.error || r3.error) {
      throw new Error(
        `Delete failed: ${r1.error?.message ?? ''} ${r2.error?.message ?? ''} ${r3.error?.message ?? ''}`
      )
    }

    // ── 2. Re-seed 21 days of check-ins ──────────────────────────────────────
    const today   = new Date()
    const checkins: Record<string, unknown>[] = []

    DEMO_PATIENTS.forEach((p, idx) => {
      const maxDay = p.group === 'droppedoff' ? 15 : 20
      for (let d = 0; d <= maxDay; d++) {
        const v = checkinValues(p.group, d, idx, p.off)
        const checkinDate = new Date(today)
        checkinDate.setDate(today.getDate() - (20 - d))
        const dateStr = checkinDate.toISOString().slice(0, 10)
        checkins.push({
          patient_id:         p.id,
          clinic_id:          DEMO_CLINIC_ID,
          pain_level:         v.pain,
          sleep_quality:      v.sq,
          sleep_hours:        parseFloat(v.sh.toFixed(1)),
          energy_level:       v.en,
          stress_level:       v.st,
          functional_ability: v.fn,
          mood:               v.md,
          checkin_date:       dateStr,
          created_at:         `${dateStr}T08:00:00+00:00`,
        })
      }
    })

    // Batch insert in chunks of 100
    for (let i = 0; i < checkins.length; i += 100) {
      const { error } = await service.from('daily_checkins').insert(checkins.slice(i, i + 100))
      if (error) throw new Error(`Check-in insert failed: ${error.message}`)
    }

    // ── 3. Regenerate briefing + message drafts ───────────────────────────────
    await generateBriefingForClinic(DEMO_CLINIC_ID)

    // ── 4. Verify counts ──────────────────────────────────────────────────────
    const [{ count: ciCount }, { count: brCount }, { count: mdCount }] = await Promise.all([
      service.from('daily_checkins').select('*', { count: 'exact', head: true }).eq('clinic_id', DEMO_CLINIC_ID),
      service.from('briefings').select('*', { count: 'exact', head: true }).eq('clinic_id', DEMO_CLINIC_ID),
      service.from('message_drafts').select('*', { count: 'exact', head: true }).eq('clinic_id', DEMO_CLINIC_ID).eq('status', 'pending'),
    ])

    // Log to access_log
    void service.from('access_log').insert({
      clinic_id:   DEMO_CLINIC_ID,
      actor_email: 'cron@system',
      action:      'demo_reset',
      target_type: 'clinic',
      target_id:   DEMO_CLINIC_ID,
    })

    console.log('[demo-reset] complete', { checkins: ciCount, briefings: brCount, drafts: mdCount })

    return NextResponse.json({
      ok:        true,
      startedAt,
      checkins:  ciCount,
      briefings: brCount,
      drafts:    mdCount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[demo-reset] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
