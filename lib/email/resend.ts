import 'server-only'

// ─── Core Resend helper ───────────────────────────────────────────────────────

async function resendSend(opts: {
  from:     string
  to:       string[]
  subject:  string
  html:     string
  text:     string
  reply_to?: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[email] skipped — RESEND_API_KEY not set')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(opts),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Check-in link email ──────────────────────────────────────────────────────
// Sent by the morning cron as an alternative/supplement to SMS.
// Warm PURA palette; single CTA button.

export async function sendCheckinLinkEmail(opts: {
  toEmail:          string
  patientFirstName: string
  clinicName:       string
  checkInUrl:       string
  isDemo?:          boolean
}): Promise<{ ok: boolean; error?: string }> {
  if (opts.isDemo) {
    console.log('[checkin-link-email] Demo mode — would send to:', opts.toEmail, opts.checkInUrl)
    return { ok: true }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://purasignal.com'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0F0E0D;color:#F5F1E8;font-family:system-ui,sans-serif;margin:0;padding:0;">
<div style="max-width:480px;margin:0 auto;padding:40px 24px;">

  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6B655F;">${opts.clinicName}</p>
  <h1 style="margin:0 0 24px;font-size:20px;font-weight:400;color:#F5F1E8;font-family:Georgia,serif;">
    Good morning, ${opts.patientFirstName}.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#A8A29A;margin:0 0 28px;">
    Your daily check-in is ready. It takes about 30 seconds and helps your care team understand how you're doing.
  </p>

  <a href="${opts.checkInUrl}"
     style="display:block;background:#E879F9;color:#0F0E0D;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:500;text-decoration:none;margin:0 0 28px;">
    Complete your check-in →
  </a>

  <p style="font-size:12px;color:#6B655F;line-height:1.6;margin:0 0 8px;">
    This link expires in 24 hours. If you've already checked in today, you can ignore this email.
  </p>

  <div style="padding-top:20px;border-top:1px solid #2A2724;">
    <p style="margin:0;font-size:11px;color:#6B655F;">
      Sent by ${opts.clinicName} via
      <a href="${appUrl}" style="color:#E879F9;text-decoration:none;">PURA Health</a>
    </p>
  </div>
</div>
</body>
</html>`

  const text = [
    `Good morning, ${opts.patientFirstName}.`,
    '',
    `Your daily check-in from ${opts.clinicName} is ready. It takes 30 seconds:`,
    opts.checkInUrl,
    '',
    'This link expires in 24 hours.',
    '',
    `Sent by ${opts.clinicName} via PURA Health — ${appUrl}`,
  ].join('\n')

  return resendSend({
    from:    `${opts.clinicName} via PURA <checkin@purasignal.com>`,
    to:      [opts.toEmail],
    subject: `Your check-in from ${opts.clinicName}`,
    html,
    text,
  })
}
