import 'server-only'
import type { DigestData } from './digest'

export async function sendDigest(d: DigestData): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[monitor/email] RESEND_API_KEY not set — digest logged only')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const toEmail = process.env.FOUNDER_EMAIL ?? 'viveapr@gmail.com'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://purasignal.com'

  const hasAnomalies = d.anomalies.length > 0
  const subject = hasAnomalies
    ? `⚠ PURA ${d.date} — ${d.anomalies.length} anomal${d.anomalies.length === 1 ? 'y' : 'ies'} detected`
    : `✓ PURA ${d.date} — all systems nominal`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'PURA Health <digest@purasignal.com>',
        to:      [toEmail],
        subject,
        html:    buildHtml(d, appUrl),
        text:    buildText(d, appUrl),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[monitor/email] Resend error:', errBody)
      return { ok: false, error: errBody }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function buildHtml(d: DigestData, appUrl: string): string {
  const generatedAt = new Date(d.window.end).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZoneName: 'short',
  })

  const statusBlock = d.anomalies.length > 0
    ? `<div style="background:#2A0A0A;border-left:3px solid #F87171;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
        <p style="margin:0 0 10px;color:#F87171;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,sans-serif;font-weight:600;">
          ${d.anomalies.length} Anomal${d.anomalies.length === 1 ? 'y' : 'ies'} Detected
        </p>
        ${d.anomalies.map(a =>
          `<p style="margin:5px 0;color:#F5F1E8;font-size:14px;font-family:system-ui,sans-serif;">• ${a}</p>`
        ).join('')}
      </div>`
    : `<div style="background:#0A2010;border-left:3px solid #4ADE80;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
        <p style="margin:0;color:#4ADE80;font-size:14px;font-family:system-ui,sans-serif;">
          All systems nominal — no anomalies detected.
        </p>
      </div>`

  const clinicRows = d.clinics.map(c => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #2A2724;color:#F5F1E8;font-size:14px;font-family:system-ui,sans-serif;">${c.clinic_name}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #2A2724;font-size:13px;font-family:system-ui,sans-serif;color:${c.briefing_ok ? '#4ADE80' : '#F87171'};">
        ${c.briefing_ok ? '✓ Generated' : '✗ Failed'}
      </td>
      <td style="padding:11px 14px;border-bottom:1px solid #2A2724;font-size:13px;font-family:system-ui,sans-serif;color:${c.morning_run ? '#4ADE80' : '#F87171'};">
        ${c.morning_run ? '✓ Ran' : '✗ No log'}
      </td>
    </tr>`).join('')

  const retryBlock = d.retryResults.length > 0 ? `
    <h3 style="color:#A8A29A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:32px 0 12px;font-family:system-ui,sans-serif;font-weight:600;">Auto-Retry Results</h3>
    <table style="width:100%;border-collapse:collapse;background:#161412;border:1px solid #2A2724;border-radius:12px;overflow:hidden;">
      ${d.retryResults.map(r => `
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #2A2724;color:#F5F1E8;font-size:14px;font-family:system-ui,sans-serif;">${r.clinic_name}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #2A2724;font-size:13px;color:${r.success ? '#4ADE80' : '#F87171'};font-family:system-ui,sans-serif;">
            ${r.success ? '✓ Retry succeeded' : `✗ ${r.error ?? 'Failed'}`}
          </td>
        </tr>`).join('')}
    </table>` : ''

  const errorBlock = d.errorEvents.length > 0 ? `
    <h3 style="color:#A8A29A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:32px 0 12px;font-family:system-ui,sans-serif;font-weight:600;">
      Error Events (${d.errorEvents.length})
    </h3>
    <div style="background:#161412;border:1px solid #2A2724;border-radius:12px;padding:16px 20px;overflow:auto;max-height:200px;">
      ${d.errorEvents.slice(0, 20).map(e =>
        `<p style="margin:4px 0;font-size:12px;font-family:monospace;color:#A8A29A;">${e.created_at.slice(11, 16)} · ${e.action} · ${e.actor_email ?? '—'}</p>`
      ).join('')}
      ${d.errorEvents.length > 20 ? `<p style="color:#6B655F;font-size:12px;margin:8px 0 0;">+ ${d.errorEvents.length - 20} more</p>` : ''}
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>PURA Daily Digest</title></head>
<body style="background:#0F0E0D;color:#F5F1E8;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <div style="margin-bottom:8px;">
    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6B655F;font-family:system-ui,sans-serif;">PURA Health</p>
    <h1 style="margin:0;font-size:24px;font-weight:400;color:#F5F1E8;font-family:Georgia,serif;">Daily Digest</h1>
    <p style="margin:8px 0 0;font-size:13px;color:#6B655F;font-family:system-ui,sans-serif;">${d.date} · ${generatedAt}</p>
  </div>

  ${statusBlock}

  <!-- Check-in stats -->
  <h3 style="color:#A8A29A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:32px 0 12px;font-family:system-ui,sans-serif;font-weight:600;">Check-ins</h3>
  <div style="display:flex;gap:12px;">
    <div style="background:#161412;border:1px solid #2A2724;border-radius:12px;padding:18px 22px;flex:1;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6B655F;font-family:system-ui,sans-serif;">Today</p>
      <p style="margin:0;font-size:36px;color:#F5F1E8;font-family:Georgia,serif;line-height:1;">${d.checkinsToday}</p>
    </div>
    <div style="background:#161412;border:1px solid #2A2724;border-radius:12px;padding:18px 22px;flex:1;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6B655F;font-family:system-ui,sans-serif;">Last 7 days</p>
      <p style="margin:0;font-size:36px;color:#F5F1E8;font-family:Georgia,serif;line-height:1;">${d.checkinsLast7}</p>
    </div>
  </div>

  <!-- Morning run per clinic -->
  <h3 style="color:#A8A29A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:32px 0 12px;font-family:system-ui,sans-serif;font-weight:600;">Morning Run</h3>
  <table style="width:100%;border-collapse:collapse;background:#161412;border:1px solid #2A2724;border-radius:12px;overflow:hidden;">
    <thead>
      <tr style="background:#1C1917;">
        <th style="padding:10px 14px;text-align:left;color:#6B655F;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:400;font-family:system-ui,sans-serif;">Clinic</th>
        <th style="padding:10px 14px;text-align:left;color:#6B655F;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:400;font-family:system-ui,sans-serif;">Briefing</th>
        <th style="padding:10px 14px;text-align:left;color:#6B655F;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:400;font-family:system-ui,sans-serif;">Cron Log</th>
      </tr>
    </thead>
    <tbody>${clinicRows || '<tr><td colspan="3" style="padding:14px;color:#6B655F;font-size:13px;font-family:system-ui,sans-serif;">No onboarded clinics yet.</td></tr>'}</tbody>
  </table>

  ${retryBlock}
  ${errorBlock}

  <!-- Footer links -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #2A2724;">
    <p style="margin:0;font-size:12px;font-family:system-ui,sans-serif;">
      <a href="${appUrl}/admin/dashboard" style="color:#E879F9;text-decoration:none;">Dashboard</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/admin/health" style="color:#E879F9;text-decoration:none;">Health</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/admin/preflight" style="color:#E879F9;text-decoration:none;">Preflight</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/admin/learning" style="color:#E879F9;text-decoration:none;">Learning</a>
    </p>
    <p style="margin:10px 0 0;font-size:11px;color:#3D3933;font-family:system-ui,sans-serif;">
      PURA Health · purasignal.com · Automated digest
    </p>
  </div>

</div>
</body>
</html>`
}

// ─── Plain text fallback ──────────────────────────────────────────────────────

function buildText(d: DigestData, appUrl: string): string {
  const generatedAt = new Date(d.window.end).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  const lines: string[] = [
    `PURA DAILY DIGEST — ${d.date}`,
    `Generated: ${generatedAt}`,
    `────────────────────────────────────`,
    '',
  ]

  if (d.anomalies.length > 0) {
    lines.push(`⚠  ${d.anomalies.length} ANOMAL${d.anomalies.length === 1 ? 'Y' : 'IES'} DETECTED`)
    d.anomalies.forEach(a => lines.push(`   • ${a}`))
  } else {
    lines.push('✓  All systems nominal')
  }

  lines.push(
    '',
    'CHECK-INS',
    `  Today:      ${d.checkinsToday}`,
    `  Last 7 d:   ${d.checkinsLast7}`,
    '',
    'MORNING RUN',
    ...d.clinics.map(c =>
      `  ${c.briefing_ok ? '✓' : '✗'} ${c.clinic_name.padEnd(28)} briefing: ${c.briefing_ok ? 'ok' : 'FAILED'}  cron: ${c.morning_run ? 'ok' : 'no log'}`
    ),
  )

  if (d.retryResults.length > 0) {
    lines.push('', 'AUTO-RETRY RESULTS')
    d.retryResults.forEach(r =>
      lines.push(`  ${r.success ? '✓' : '✗'} ${r.clinic_name} — ${r.success ? 'succeeded' : (r.error ?? 'failed')}`)
    )
  }

  if (d.errorEvents.length > 0) {
    lines.push('', `ERROR EVENTS (${d.errorEvents.length})`)
    d.errorEvents.slice(0, 10).forEach(e =>
      lines.push(`  ${e.created_at.slice(11, 16)} ${e.action} — ${e.actor_email}`)
    )
  }

  lines.push(
    '',
    '────────────────────────────────────',
    `${appUrl}/admin/dashboard`,
  )

  return lines.join('\n')
}
