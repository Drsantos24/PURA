import { type NextRequest, NextResponse } from 'next/server'
import { generateBriefingForClinic } from '@/lib/ai/briefing'

// Dev trigger: POST /api/briefings/generate?clinic=<clinic_id>
// Production: called by Vercel cron at 5:30 AM — wire cron in Step 9.
// Guard: requires CRON_SECRET header in production, or FOUNDER_EMAIL match.

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  // In production enforce secret; in dev allow through if no secret set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clinicId = req.nextUrl.searchParams.get('clinic')
  if (!clinicId) {
    return NextResponse.json({ error: 'Missing ?clinic=<id> param' }, { status: 400 })
  }

  try {
    const result = await generateBriefingForClinic(clinicId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[briefing generate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
