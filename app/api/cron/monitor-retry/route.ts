import { type NextRequest, NextResponse } from 'next/server'
import { retryMissingBriefings } from '@/lib/monitor/retry'

// POST /api/cron/monitor-retry
// Runs daily at 14:00 UTC (9:00 AM CT) — ~4h after morning-send.
// Catches any clinics that failed morning briefing and retries before the day starts.
// No email sent here — the 10pm digest covers results.
//
// Auth: Bearer <CRON_SECRET>

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const results = await retryMissingBriefings()

    const succeeded = results.filter(r => r.success).length
    const failed    = results.filter(r => !r.success).length

    console.log('[monitor-retry]', { total: results.length, succeeded, failed })

    return NextResponse.json({
      ok:        true,
      retries:   results.length,
      succeeded,
      failed,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[monitor-retry] fatal error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
