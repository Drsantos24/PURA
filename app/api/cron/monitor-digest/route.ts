import { type NextRequest, NextResponse } from 'next/server'
import { gatherDigest } from '@/lib/monitor/digest'
import { retryMissingBriefings } from '@/lib/monitor/retry'
import { sendDigest } from '@/lib/monitor/email'

// POST /api/cron/monitor-digest
// Runs daily at 03:00 UTC (10:00 PM CT).
// 1. Auto-retries any clinics that had no briefing today.
// 2. Gathers 24h activity summary from access_log + daily_checkins + briefings.
// 3. Sends digest email to FOUNDER_EMAIL via Resend.
//
// Auth: Vercel injects Authorization: Bearer <CRON_SECRET>
// Manual trigger: POST with same header.
//
// Required env vars:
//   RESEND_API_KEY   — get from resend.com (free tier covers daily digest)
//   FOUNDER_EMAIL    — already set (viveapr@gmail.com)
//   CRON_SECRET      — already set

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = new Date().toISOString()

  try {
    // Step 1: Auto-retry clinics missing a briefing today
    const retryResults = await retryMissingBriefings()

    // Step 2: Gather full 24h digest
    const digest = await gatherDigest()
    digest.retryResults = retryResults

    // Step 3: Send email
    const emailResult = await sendDigest(digest)

    // Always log to console so Vercel runtime logs capture the summary
    console.log('[monitor-digest]', JSON.stringify({
      date:          digest.date,
      anomalies:     digest.anomalies,
      checkinsToday: digest.checkinsToday,
      clinics:       digest.clinics.length,
      retries:       retryResults.length,
      emailSent:     emailResult.ok,
      ...(emailResult.error && { emailError: emailResult.error }),
    }))

    return NextResponse.json({
      ok:            true,
      startedAt,
      date:          digest.date,
      anomalies:     digest.anomalies,
      checkinsToday: digest.checkinsToday,
      clinicsChecked: digest.clinics.length,
      retries:       retryResults.length,
      emailSent:     emailResult.ok,
      emailError:    emailResult.error ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[monitor-digest] fatal error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Vercel cron may hit GET on some versions
export async function GET(req: NextRequest) {
  return POST(req)
}
