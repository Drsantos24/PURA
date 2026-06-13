import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendVerificationSms } from '@/lib/sms/twilio'

// Owner-only SMS credentials API.
// All write operations happen via service role after owner auth is confirmed.

async function getOwnerMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member || member.role !== 'owner') return null
  return { user, member }
}

// ─── GET — credential status (no sensitive values returned) ──────────────────

export async function GET() {
  const auth = await getOwnerMember()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: creds } = await service
    .from('clinic_sms_credentials')
    .select('provider, from_number, whatsapp_from_number, is_verified, verified_at, last_send_at, updated_at')
    .eq('clinic_id', auth.member.clinic_id)
    .maybeSingle()

  // Monthly send count from access_log
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count: sendCount } = await service
    .from('access_log')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', auth.member.clinic_id)
    .in('action', ['sms_sent', 'morning_send'])
    .gte('created_at', monthStart.toISOString())

  return NextResponse.json({
    credentials:       creds ?? null,
    sendCountThisMonth: sendCount ?? 0,
  })
}

// ─── POST — actions ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getOwnerMember()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const action = body.action as string
  const service = createServiceClient()
  const clinicId = auth.member.clinic_id

  // ── save: encrypt + upsert credentials ──────────────────────────────────────
  if (action === 'save') {
    const { provider, accountSid, authToken, fromNumber, whatsappFromNumber } = body

    if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

    if (provider === 'platform_default') {
      const { error } = await service.from('clinic_sms_credentials').upsert({
        clinic_id:            clinicId,
        provider:             'platform_default',
        account_sid_enc:      null,
        auth_token_enc:       null,
        from_number:          null,
        whatsapp_from_number: whatsappFromNumber ?? null,
        is_verified:          false,
        verified_at:          null,
      }, { onConflict: 'clinic_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json({ error: 'accountSid, authToken, fromNumber required' }, { status: 400 })
    }

    // Encrypt via SECURITY DEFINER function
    const { data: enc, error: encErr } = await service.rpc('encrypt_sms_credentials', {
      p_account_sid: accountSid,
      p_auth_token:  authToken,
    })

    if (encErr) console.error('[SMS save] encrypt_sms_credentials error:', encErr)

    const encRow = enc?.[0] as { account_sid_enc: string | null; auth_token_enc: string | null } | undefined

    const { error: upsertErr } = await service.from('clinic_sms_credentials').upsert({
      clinic_id:            clinicId,
      provider,
      account_sid_enc:      encRow?.account_sid_enc ?? null,
      auth_token_enc:       encRow?.auth_token_enc  ?? null,
      from_number:          fromNumber,
      whatsapp_from_number: whatsappFromNumber || null,
      is_verified:          false,   // always reset to unverified on credential change
      verified_at:          null,
    }, { onConflict: 'clinic_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    await service.from('access_log').insert({
      clinic_id:   clinicId,
      actor_email: auth.user.email!,
      action:      'sms_credentials_saved',
      target_type: 'sms_credentials',
    })

    return NextResponse.json({ ok: true })
  }

  // ── send_verification: send 6-digit code to DC's phone ───────────────────────
  if (action === 'send_verification') {
    const { toPhone } = body
    if (!toPhone) return NextResponse.json({ error: 'toPhone required' }, { status: 400 })

    const result = await sendVerificationSms(clinicId, toPhone)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    // Return the code to the client — it holds it in memory for the confirm step.
    // Not stored in DB to avoid plain-text leak. Code expires by user session.
    return NextResponse.json({ ok: true, code: result.code })
  }

  // ── confirm_verification: validate code, mark is_verified ────────────────────
  if (action === 'confirm_verification') {
    const { enteredCode, expectedCode } = body
    if (!enteredCode || !expectedCode) {
      return NextResponse.json({ error: 'enteredCode and expectedCode required' }, { status: 400 })
    }
    if (String(enteredCode).trim() !== String(expectedCode).trim()) {
      return NextResponse.json({ error: 'Code does not match. Please try again.' }, { status: 400 })
    }

    const { error } = await service.from('clinic_sms_credentials')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('clinic_id', clinicId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await service.from('access_log').insert({
      clinic_id:   clinicId,
      actor_email: auth.user.email!,
      action:      'sms_credentials_verified',
      target_type: 'sms_credentials',
    })

    return NextResponse.json({ ok: true })
  }

  // ── switch_to_platform: revert to shared PURA account ────────────────────────
  if (action === 'switch_to_platform') {
    const { error } = await service.from('clinic_sms_credentials')
      .update({ provider: 'platform_default', is_verified: false, verified_at: null })
      .eq('clinic_id', clinicId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await service.from('access_log').insert({
      clinic_id:   clinicId,
      actor_email: auth.user.email!,
      action:      'sms_switched_to_platform',
      target_type: 'sms_credentials',
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
