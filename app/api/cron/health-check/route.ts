import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms/twilio'

// POST /api/cron/health-check
// Runs every 10 minutes (vercel.json: "*/10 * * * *") on Pro plan.
// Checks Supabase connectivity + recent error rate.
// Sends SMS to FOUNDER_PHONE if:
//   - 2+ health-check failures in the last 10 minutes, OR
//   - 5+ error events in access_log in the last hour
//
// Results logged to access_log with action 'health_check_pass' / 'health_check_fail'.
// SMS de-duped: won't send again within 30 minutes if already alerted.

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const service    = createServiceClient()
  const now        = new Date()
  const nowIso     = now.toISOString()
  const tenMinAgo  = new Date(now.getTime() -  10 * 60 * 1000).toISOString()
  const oneHourAgo = new Date(now.getTime() -  60 * 60 * 1000).toISOString()
  const thirtyAgo  = new Date(now.getTime() -  30 * 60 * 1000).toISOString()

  // ── 1. Health checks ───────────────────────────────────────────────────────
  const failures: string[] = []

  // Check 1: Supabase responsive
  try {
    const { error } = await service.from('clinics').select('id').limit(1)
    if (error) failures.push(`Supabase error: ${error.message}`)
  } catch (e) {
    failures.push(`Supabase unreachable: ${String(e)}`)
  }

  // Check 2: Error rate in access_log (last hour)
  let recentErrors = 0
  try {
    const { count } = await service
      .from('access_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)
      .or('action.ilike.%fail%,action.ilike.%error%')
    recentErrors = count ?? 0
    if (recentErrors >= 5) {
      failures.push(`Elevated error rate: ${recentErrors} errors in last hour`)
    }
  } catch {
    // Non-fatal: don't count this as a health failure
  }

  const passed = failures.length === 0
  const action = passed ? 'health_check_pass' : 'health_check_fail'

  // ── 2. Log result ──────────────────────────────────────────────────────────
  void service.from('access_log').insert({
    clinic_id:   null,
    actor_email: 'monitor@system',
    action,
    target_type: 'system',
    target_id:   null,
  })

  // ── 3. Decide whether to send SMS alert ───────────────────────────────────
  let smsSent    = false
  let smsReason  = ''

  if (!passed) {
    const founderPhone = process.env.FOUNDER_PHONE
    if (founderPhone) {
      // Check: 2+ failures in last 10 minutes (including this one)
      const { count: recentFailCount } = await service
        .from('access_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenMinAgo)
        .eq('action', 'health_check_fail')

      const failCount = (recentFailCount ?? 0) + 1  // +1 for this failure

      if (failCount >= 2) {
        // De-dupe: check if we already alerted in last 30 minutes
        const { count: recentAlerts } = await service
          .from('access_log')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', thirtyAgo)
          .eq('action', 'health_check_sms_sent')

        if ((recentAlerts ?? 0) === 0) {
          smsReason = `PURA alert: ${failCount} health check failures in 10 min.\n${failures.join('\n')}\nCheck: ${process.env.NEXT_PUBLIC_APP_URL}/admin/health`
          smsSent = await sendSMS(founderPhone, smsReason)

          if (smsSent) {
            void service.from('access_log').insert({
              clinic_id:   null,
              actor_email: 'monitor@system',
              action:      'health_check_sms_sent',
              target_type: 'system',
              target_id:   null,
            })
          }
        }
      }
    }
  }

  console.log('[health-check]', { passed, failures, recentErrors, smsSent, ts: nowIso })

  return NextResponse.json({
    ok:           passed,
    passed,
    failures,
    recentErrors,
    smsSent,
    ts:           nowIso,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
