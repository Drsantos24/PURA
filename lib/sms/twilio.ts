import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResolvedCreds = {
  accountSid:   string
  authToken:    string
  fromNumber:   string
  waFromNumber: string
  source:       'clinic' | 'platform'
}

// ─── Credential resolution ────────────────────────────────────────────────────

/**
 * Returns the active Twilio credentials for a clinic.
 * Priority: verified clinic-specific creds → platform env vars → null.
 */
export async function resolveClinicCreds(clinicId: string): Promise<ResolvedCreds | null> {
  try {
    const service = createServiceClient()
    const { data, error } = await service.rpc('get_clinic_sms_creds', {
      p_clinic_id: clinicId,
    })

    if (!error && data && data.length > 0) {
      const row = data[0] as {
        provider:             string
        account_sid:          string | null
        auth_token:           string | null
        from_number:          string | null
        whatsapp_from_number: string | null
        is_verified:          boolean
      }
      if (
        row.is_verified &&
        row.provider !== 'platform_default' &&
        row.account_sid &&
        row.auth_token &&
        row.from_number
      ) {
        const rawWa = row.whatsapp_from_number || row.from_number
        return {
          accountSid:   row.account_sid,
          authToken:    row.auth_token,
          fromNumber:   row.from_number,
          waFromNumber: rawWa.startsWith('whatsapp:') ? rawWa : `whatsapp:${rawWa}`,
          source:       'clinic',
        }
      }
    }
  } catch (err) {
    console.error('[SMS] resolveClinicCreds error:', err)
  }

  return resolvePlatformCreds()
}

function resolvePlatformCreds(): ResolvedCreds | null {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_TOLL_FREE_NUMBER || process.env.TWILIO_PHONE_NUMBER

  if (!sid || sid.startsWith('placeholder') || !token || !from) return null

  const rawWa  = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'
  const waFrom = rawWa.startsWith('whatsapp:') ? rawWa : `whatsapp:${rawWa}`

  return { accountSid: sid, authToken: token, fromNumber: from, waFromNumber: waFrom, source: 'platform' }
}

// ─── Client factory ───────────────────────────────────────────────────────────

async function makeClient(sid: string, token: string) {
  const Twilio = (await import('twilio')).default
  return Twilio(sid, token)
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

/**
 * Send a plain SMS, routed through the clinic's verified Twilio account if
 * available, otherwise through the platform account.
 */
export async function sendSMS(
  to:       string,
  body:     string,
  clinicId?: string,
): Promise<boolean> {
  const creds = clinicId ? await resolveClinicCreds(clinicId) : resolvePlatformCreds()
  if (!creds) {
    console.log('[SMS] skipped — Twilio not configured')
    return false
  }
  try {
    const client = await makeClient(creds.accountSid, creds.authToken)
    await client.messages.create({ to, from: creds.fromNumber, body })
    if (clinicId) void touchLastSend(clinicId)
    return true
  } catch (err) {
    console.error('[SMS] send failed:', err)
    return false
  }
}

/**
 * Send the daily check-in link via SMS.
 * Convenience wrapper that builds the message body and passes clinicId.
 */
export async function sendCheckin(
  to:              string,
  patientFirstName: string,
  clinicName:      string,
  checkInUrl:      string,
  clinicId:        string,
): Promise<boolean> {
  const body = `Hi ${patientFirstName}, here's your daily check-in from ${clinicName}: ${checkInUrl} — takes 30 seconds.`
  return sendSMS(to, body, clinicId)
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message, routed through the clinic's credentials.
 */
export async function sendWhatsApp(
  to:       string,
  body:     string,
  clinicId?: string,
): Promise<boolean> {
  const creds = clinicId ? await resolveClinicCreds(clinicId) : resolvePlatformCreds()
  if (!creds) {
    console.log('[WhatsApp] skipped — Twilio not configured')
    return false
  }
  const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  try {
    const client = await makeClient(creds.accountSid, creds.authToken)
    await client.messages.create({ to: waTo, from: creds.waFromNumber, body })
    if (clinicId) void touchLastSend(clinicId)
    return true
  } catch (err) {
    console.error('[WhatsApp] send failed:', err)
    return false
  }
}

/**
 * Send the daily check-in link via WhatsApp.
 */
export async function sendWhatsAppCheckin(
  to:              string,
  patientFirstName: string,
  clinicName:      string,
  checkInUrl:      string,
  clinicId?:       string,
): Promise<boolean> {
  const body = `Hi ${patientFirstName}, here's your daily check-in from ${clinicName}: ${checkInUrl} — takes 30 seconds.`
  return sendWhatsApp(to, body, clinicId)
}

// ─── Verification SMS ─────────────────────────────────────────────────────────

/**
 * Send a 6-digit verification code to the DC's phone using the credentials
 * that are currently saved (possibly unverified) for the clinic.
 * Falls back to platform creds if the clinic has no custom creds yet.
 * Returns the code so the API route can compare it on confirmation.
 */
export async function sendVerificationSms(
  clinicId: string,
  toPhone:  string,
): Promise<{ ok: boolean; code: string; error?: string }> {
  const service = createServiceClient()

  // Attempt to use stored (unverified) creds via the decrypt helper
  const { data: decrypted } = await service.rpc('get_clinic_sms_creds', {
    p_clinic_id: clinicId,
  })

  const row = decrypted?.[0] as {
    provider:    string
    account_sid: string | null
    auth_token:  string | null
    from_number: string | null
    is_verified: boolean
  } | undefined

  let accountSid: string
  let authToken:  string
  let fromNumber: string

  if (row && row.account_sid && row.auth_token && row.from_number && row.provider !== 'platform_default') {
    accountSid = row.account_sid
    authToken  = row.auth_token
    fromNumber = row.from_number
  } else {
    const platform = resolvePlatformCreds()
    if (!platform) return { ok: false, code: '', error: 'No credentials available — save your Twilio creds first or configure platform defaults.' }
    accountSid = platform.accountSid
    authToken  = platform.authToken
    fromNumber = platform.fromNumber
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const body = `PURA verification: ${code} — enter this in your SMS settings to confirm your Twilio connection is working.`

  try {
    const client = await makeClient(accountSid, authToken)
    await client.messages.create({ to: toPhone, from: fromNumber, body })
    return { ok: true, code }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[SMS] verification send failed:', msg)
    return { ok: false, code: '', error: msg }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Fire-and-forget: stamp last_send_at after a successful clinic send. */
function touchLastSend(clinicId: string) {
  const service = createServiceClient()
  return service
    .from('clinic_sms_credentials')
    .update({ last_send_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
}
