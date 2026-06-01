import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'

// Supabase Auth webhook payload shape (subset we care about)
type AuthWebhookPayload = {
  type: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'SIGNUP' | string
  event:  string
  user?: {
    id:    string
    email?: string
  }
}

function actionFromType(type: string): string {
  switch (type) {
    case 'LOGIN':             return 'login'
    case 'LOGOUT':            return 'logout'
    case 'SIGNUP':            return 'signup'
    case 'PASSWORD_RECOVERY': return 'password_reset_requested'
    case 'USER_UPDATED':      return 'user_updated'
    case 'TOKEN_REFRESHED':   return 'token_refreshed'
    default:                  return type.toLowerCase()
  }
}

export async function POST(req: NextRequest) {
  // ── Validate shared secret via HMAC-SHA256 signature ─────────────────────
  const secret = process.env.SUPABASE_AUTH_WEBHOOK_SECRET
  if (secret) {
    const signature = req.headers.get('x-supabase-signature') ?? ''
    const rawBody   = await req.text()

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const sigBuf   = Buffer.from(signature)
    const expBuf   = Buffer.from(expected)

    const valid =
      sigBuf.length === expBuf.length &&
      timingSafeEqual(sigBuf, expBuf)

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse after signature check
    let payload: AuthWebhookPayload
    try { payload = JSON.parse(rawBody) }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    await writeLog(payload)
  } else {
    // No secret set yet — parse and log anyway (dev / pre-config mode)
    let payload: AuthWebhookPayload
    try { payload = await req.json() }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    await writeLog(payload)
  }

  return NextResponse.json({ ok: true })
}

async function writeLog(payload: AuthWebhookPayload) {
  const email  = payload.user?.email ?? 'unknown'
  const action = actionFromType(payload.type ?? payload.event ?? 'unknown')

  // Skip noisy token refreshes from the audit log
  if (action === 'token_refreshed') return

  try {
    const service = createServiceClient()

    // Resolve clinic_id from email (may be null for non-owner users)
    const { data: clinic } = await service
      .from('clinics')
      .select('id')
      .eq('owner_email', email)
      .maybeSingle()

    await service.from('access_log').insert({
      clinic_id:   clinic?.id ?? null,
      actor_email: email,
      action,
      target_type: 'auth',
      target_id:   payload.user?.id ?? null,
    })
  } catch (err) {
    // Never let logging errors break the 200 response — Supabase retries on non-200
    console.error('[auth-webhook] log write failed:', err)
  }
}
