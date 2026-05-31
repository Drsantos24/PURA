import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms/twilio'
import { generateBriefingForClinic } from '@/lib/ai/briefing'

// POST /api/cron/morning-send
// Triggered daily at 10:00 UTC by Vercel cron (covers 5–6 AM US timezones).
// Vercel automatically attaches: Authorization: Bearer <CRON_SECRET>
// Manually triggerable: POST with same header for testing.

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
  throw new Error('Short code generation failed after 10 retries')
}

export async function POST(req: NextRequest) {
  // ── Auth: Vercel cron injects Authorization: Bearer <CRON_SECRET> ──────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const service   = createServiceClient()
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const startedAt = new Date().toISOString()

  // ── Fetch all clinics with auto-send enabled ──────────────────────────────
  const { data: settings, error: sErr } = await service
    .from('clinic_settings')
    .select('clinic_id, checkin_send_time')
    .eq('auto_send_enabled', true)

  if (sErr || !settings?.length) {
    return NextResponse.json({ ok: true, message: 'No clinics with auto-send enabled', clinics: 0 })
  }

  const results: Record<string, unknown>[] = []

  for (const setting of settings) {
    const clinicId = setting.clinic_id
    let tokensSent = 0
    let briefingOk = false
    let briefingError: string | null = null

    try {
      // ── Get clinic info ─────────────────────────────────────────────────
      const { data: clinic } = await service
        .from('clinics')
        .select('clinic_name, is_demo')
        .eq('id', clinicId)
        .single()

      // ── Fetch active patients ───────────────────────────────────────────
      const { data: patients } = await service
        .from('patients')
        .select('id, first_name, phone_number')
        .eq('clinic_id', clinicId)
        .eq('enrollment_status', 'active')

      if (patients?.length) {
        // ── Send check-in links ───────────────────────────────────────────
        for (const patient of patients) {
          try {
            const shortCode = await makeShortCode(service)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

            await service.from('patient_checkin_tokens').insert({
              patient_id: patient.id,
              clinic_id:  clinicId,
              short_code: shortCode,
              expires_at: expiresAt,
            })

            const url  = `${baseUrl}/c/${shortCode}`
            const body = `Hi ${patient.first_name}, here's your daily PURA check-in from ${clinic?.clinic_name ?? 'your care team'}: ${url} — takes 30 seconds.`

            // Demo clinics skip real SMS sends
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isDemo = (clinic as any)?.is_demo === true
            if (!isDemo) {
              await sendSMS(patient.phone_number, body)
            }
            tokensSent++
          } catch (err) {
            console.error(`[cron] Token/SMS failed for patient ${patient.id}:`, err)
          }
        }
      }

      // ── Generate briefing + drafts for this clinic ────────────────────
      try {
        await generateBriefingForClinic(clinicId)
        briefingOk = true
      } catch (err) {
        briefingError = err instanceof Error ? err.message : String(err)
        console.error(`[cron] Briefing failed for clinic ${clinicId}:`, briefingError)
      }

      // ── Log to access_log ─────────────────────────────────────────────
      await service.from('access_log').insert({
        clinic_id:   clinicId,
        actor_email: 'cron@system',
        action:      'morning_send',
        target_type: 'clinic',
        target_id:   clinicId,
      })

      results.push({
        clinicId,
        tokensSent,
        briefingOk,
        ...(briefingError && { briefingError }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron] Clinic ${clinicId} failed:`, msg)
      results.push({ clinicId, error: msg })
    }
  }

  console.log(`[cron] morning-send complete`, { startedAt, results })

  return NextResponse.json({
    ok:        true,
    startedAt,
    clinics:   results.length,
    results,
  })
}

// Vercel cron hits GET on some versions — proxy to POST
export async function GET(req: NextRequest) {
  return POST(req)
}
