import 'server-only'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function configured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID
  return !!sid && !sid.startsWith('placeholder') && !!process.env.TWILIO_AUTH_TOKEN
}

function smsFrom(): string {
  // Use toll-free number when available (higher throughput while A2P pending).
  // Fall through to the standard long-code if toll-free isn't provisioned yet.
  return process.env.TWILIO_TOLL_FREE_NUMBER || process.env.TWILIO_PHONE_NUMBER || ''
}

async function twilioClient() {
  const twilio = (await import('twilio')).default
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSMS(to: string, body: string): Promise<boolean> {
  const from = smsFrom()
  if (!configured() || !from) {
    console.log('[SMS] skipped — Twilio not configured or no from number')
    return false
  }
  try {
    const client = await twilioClient()
    await client.messages.create({ to, from, body })
    return true
  } catch (err) {
    console.error('[SMS] send failed:', err)
    return false
  }
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
// Uses the same Twilio account — prefix both from/to with 'whatsapp:'.
// From number: TWILIO_WHATSAPP_NUMBER (dedicated WA number), or the Twilio sandbox
//   whatsapp:+14155238886 if not yet provisioned.
// Patients must have opted in to WhatsApp via Twilio sandbox first in dev.

export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  if (!configured()) {
    console.log('[WhatsApp] skipped — Twilio not configured')
    return false
  }
  const rawFrom =
    process.env.TWILIO_WHATSAPP_NUMBER ||
    'whatsapp:+14155238886'  // Twilio sandbox fallback

  const whatsappFrom = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`
  const whatsappTo   = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  try {
    const client = await twilioClient()
    await client.messages.create({ to: whatsappTo, from: whatsappFrom, body })
    return true
  } catch (err) {
    console.error('[WhatsApp] send failed:', err)
    return false
  }
}

/** Convenience wrapper: sends the daily check-in link via WhatsApp. */
export async function sendWhatsAppCheckin(
  to: string,
  patientFirstName: string,
  clinicName: string,
  checkInUrl: string,
): Promise<boolean> {
  const body = `Hi ${patientFirstName}, here's your daily check-in from ${clinicName}: ${checkInUrl} — takes 30 seconds.`
  return sendWhatsApp(to, body)
}
