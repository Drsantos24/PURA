import 'server-only'

export type CheckinResultsInput = {
  patientFirstName: string
  clinicName:       string
  clinicEmail?:     string  // reply-to address
  signal:           number
  zone:             'strong' | 'stable' | 'watch'
  trend:            number[]   // last 7 signals, oldest → newest
  encouragingLine:  string
}

function zoneColor(zone: CheckinResultsInput['zone']) {
  if (zone === 'strong') return '#4ADE80'
  if (zone === 'stable') return '#FBBF24'
  return '#F87171'
}

function zoneLabel(zone: CheckinResultsInput['zone']) {
  if (zone === 'strong') return 'Strong'
  if (zone === 'stable') return 'Stable'
  return 'Watch'
}

function trendBar(values: number[]): string {
  // Render as simple ASCII sparkline dots
  if (values.length === 0) return ''
  return values.map(v => {
    if (v >= 80) return '●'
    if (v >= 55) return '◐'
    return '○'
  }).join(' ')
}

/** Build email HTML and plain text. Zero external dependencies. */
export function buildCheckinResultsEmail(d: CheckinResultsInput): { html: string; text: string } {
  const color  = zoneColor(d.zone)
  const label  = zoneLabel(d.zone)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://purasignal.com'

  // Trend: last 7 days as colored dots
  const trendDots = d.trend.slice(-7).map(v => {
    const c = v >= 80 ? '#4ADE80' : v >= 55 ? '#FBBF24' : '#F87171'
    return `<span style="color:${c};font-size:18px;">●</span>`
  }).join('<span style="color:#2A2724;"> </span>')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0F0E0D;color:#F5F1E8;font-family:system-ui,sans-serif;margin:0;padding:0;">
<div style="max-width:480px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6B655F;">${d.clinicName}</p>
  <h1 style="margin:0 0 32px;font-size:20px;font-weight:400;color:#F5F1E8;font-family:Georgia,serif;">Today's Check-in</h1>

  <!-- Signal hero -->
  <div style="background:#161412;border:1px solid #2A2724;border-radius:16px;padding:32px 28px;text-align:center;margin-bottom:24px;">
    <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6B655F;">Your PURA Signal</p>
    <p style="margin:0;font-size:72px;line-height:1;color:${color};font-family:Georgia,serif;">${d.signal}</p>
    <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${color};">${label}</p>
  </div>

  <!-- Encouraging line -->
  <p style="font-size:16px;line-height:1.6;color:#F5F1E8;margin:0 0 28px;font-family:Georgia,serif;">${d.encouragingLine}</p>

  <!-- 7-day trend -->
  ${d.trend.length >= 2 ? `
  <div style="background:#161412;border:1px solid #2A2724;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
    <p style="margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#6B655F;">Your last 7 days</p>
    <div style="letter-spacing:4px;">${trendDots}</div>
    <p style="margin:8px 0 0;font-size:11px;color:#6B655F;">${d.trend.slice(-7).join('  ')} → today</p>
  </div>` : ''}

  <!-- Footer -->
  <div style="padding-top:20px;border-top:1px solid #2A2724;">
    <p style="margin:0;font-size:11px;color:#6B655F;line-height:1.6;">
      Powered by PURA Health · <a href="${appUrl}" style="color:#E879F9;text-decoration:none;">purasignal.com</a>
    </p>
    <p style="margin:6px 0 0;font-size:10px;color:#3D3933;">
      You're receiving this because you're enrolled in care with ${d.clinicName}.
    </p>
  </div>

</div>
</body>
</html>`

  const text = [
    `Today's Check-in — ${d.clinicName}`,
    '',
    `Your PURA Signal: ${d.signal} (${label})`,
    '',
    d.encouragingLine,
    '',
    d.trend.length >= 2 ? `7-day trend: ${d.trend.slice(-7).join(', ')} → today` : '',
    '',
    `Powered by PURA Health · ${appUrl}`,
  ].filter(l => l !== '').join('\n')

  return { html, text }
}

/** Derive zone from signal number */
export function signalToZone(s: number): CheckinResultsInput['zone'] {
  if (s >= 80) return 'strong'
  if (s >= 55) return 'stable'
  return 'watch'
}

/** Compute PURA signal from raw check-in values (mirrors DB trigger) */
export function computeSignalFromValues(v: {
  pain: number; sleepQuality: number; sleepHours: number
  energy: number; stress: number; functional: number; mood: number
}): number {
  const sleepNorm = Math.min(v.sleepHours / 8, 1) * 10
  const raw =
    (10 - v.pain)       * 0.25 +
    v.sleepQuality      * 0.20 +
    sleepNorm           * 0.15 +
    v.energy            * 0.15 +
    (10 - v.stress)     * 0.10 +
    v.functional        * 0.10 +
    v.mood              * 0.05
  return Math.round(raw * 10)
}

/** Generate one encouraging line via Claude Haiku using the clinic's voice */
export async function generateEncouragingLine(opts: {
  zone:              CheckinResultsInput['zone']
  signal:            number
  clinicVocabulary?: string | null
  clinicPhilosophy?: string | null
  patientFirstName:  string
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('placeholder') || apiKey.startsWith('your_')) {
    return defaultLine(opts.zone, opts.patientFirstName)
  }
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const ai   = new Anthropic({ apiKey })
    const tone = opts.clinicVocabulary || opts.clinicPhilosophy || 'warm, direct, clinical but human'
    const zoneContext =
      opts.zone === 'strong'  ? "Their signal is strong — celebrate the momentum."
      : opts.zone === 'stable' ? "Their signal is stable — acknowledge the consistency."
      : "Their signal is in the watch zone — be warm and encouraging."

    const msg = await ai.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages:   [{
        role:    'user',
        content: `Write ONE sentence (15–25 words) for a patient's check-in results email.\nPatient name: ${opts.patientFirstName}\nZone: ${opts.zone} — ${zoneContext}\nClinic style: ${tone}\nDo NOT mention numbers. Address the patient by name. Output ONLY the sentence.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text?.trim() : null
    return text || defaultLine(opts.zone, opts.patientFirstName)
  } catch {
    return defaultLine(opts.zone, opts.patientFirstName)
  }
}

function defaultLine(zone: CheckinResultsInput['zone'], name: string): string {
  if (zone === 'strong') return `${name}, you're doing great — keep that momentum going this week.`
  if (zone === 'stable') return `${name}, consistency is the treatment — your steady effort is showing.`
  return `${name}, your care team sees you checking in, and that counts — keep it up.`
}

/** Send the check-in results email via Resend. */
export async function sendCheckinResultsEmail(opts: {
  toEmail:     string
  input:       CheckinResultsInput
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' }

  const { html, text } = buildCheckinResultsEmail(opts.input)
  const subject = `Your check-in — Signal ${opts.input.signal} (${zoneLabel(opts.input.zone)})`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     `${opts.input.clinicName} via PURA <checkin@purasignal.com>`,
        to:       [opts.toEmail],
        reply_to: opts.input.clinicEmail ? [opts.input.clinicEmail] : undefined,
        subject,
        html,
        text,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
