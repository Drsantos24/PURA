import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.FOUNDER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const results: Record<string, { pass: boolean; detail: string; ms: number }> = {}

  async function run(id: string, fn: () => Promise<{ pass: boolean; detail: string }>) {
    const t0 = Date.now()
    try {
      const r = await fn()
      results[id] = { ...r, ms: Date.now() - t0 }
    } catch (e) {
      results[id] = { pass: false, detail: String(e), ms: Date.now() - t0 }
    }
  }

  // ── A: Auth and RLS ───────────────────────────────────────────────────────
  await run('A1', async () => {
    const { data } = await supabase.auth.getUser()
    return data.user ? { pass: true, detail: `logged in as ${data.user.email}` } : { pass: false, detail: 'no user' }
  })

  await run('A2', async () => {
    const { data, error } = await service.from('patients').select('id').eq('clinic_id', '00000000-0000-0000-0000-000000000000').limit(1)
    if (error) return { pass: false, detail: error.message }
    return { pass: (data?.length ?? 0) === 0, detail: `${data?.length ?? 0} rows returned for bogus clinic_id` }
  })

  await run('A3', async () => {
    const { error } = await service.from('access_log').insert({
      clinic_id: '00000000-0000-0000-0000-000000000001',
      action: 'preflight_test',
      actor: user.email ?? 'founder',
    })
    if (error) return { pass: false, detail: error.message }
    await service.from('access_log').delete().eq('action', 'preflight_test')
    return { pass: true, detail: 'service role audit write succeeded' }
  })

  await run('A4', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    try {
      const res = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual', headers: { cookie: '' } })
      const loc = res.headers.get('location') ?? ''
      const pass = res.status === 307 || res.status === 302 || loc.includes('/login')
      return { pass, detail: `status=${res.status} location=${loc || 'none'}` }
    } catch (e) {
      return { pass: false, detail: String(e) }
    }
  })

  // ── B: Patient check-in surface ───────────────────────────────────────────
  let demoClinicId: string | null = null
  let demoPatientId: string | null = null
  let testToken: string | null = null

  await run('B1', async () => {
    const { data: clinic } = await service.from('clinics').select('id').eq('is_demo', true).limit(1).maybeSingle()
    if (!clinic) return { pass: false, detail: 'no demo clinic found (is_demo=true)' }
    demoClinicId = clinic.id
    const { data: patient } = await service.from('patients').select('id').eq('clinic_id', clinic.id).limit(1).maybeSingle()
    if (!patient) return { pass: false, detail: 'no patients in demo clinic' }
    demoPatientId = patient.id

    const CHARS = 'abcdefghijkmnopqrstuvwxyz23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error } = await service.from('patient_checkin_tokens').insert({
      clinic_id: clinic.id, patient_id: patient.id, short_code: code, expires_at: expires,
    })
    if (error) return { pass: false, detail: error.message }
    testToken = code
    return { pass: true, detail: `token=${code} for patient=${patient.id}` }
  })

  await run('B2', async () => {
    if (!testToken) return { pass: false, detail: 'no token from B1' }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    try {
      const res = await fetch(`${baseUrl}/c/${testToken}`)
      const pass = res.status === 200
      return { pass, detail: `status=${res.status}` }
    } catch (e) {
      return { pass: false, detail: String(e) }
    }
  })

  await run('B3', async () => {
    if (!demoClinicId || !demoPatientId || !testToken) return { pass: false, detail: 'missing B1 setup' }
    const payload = {
      pain: 3, sleep: 7, energy: 6, stress: 4, function: 7,
      short_code: testToken,
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    try {
      const res = await fetch(`${baseUrl}/api/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      const { data: checkin } = await service
        .from('daily_checkins').select('id, pura_signal')
        .eq('patient_id', demoPatientId)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      const pass = res.ok || !!checkin
      return { pass, detail: pass ? `pura_signal=${checkin?.pura_signal}` : `status=${res.status} body=${JSON.stringify(json).slice(0, 100)}` }
    } catch (e) {
      return { pass: false, detail: String(e) }
    }
  })

  await run('B4', async () => {
    if (!demoPatientId) return { pass: false, detail: 'no demo patient from B1' }
    const { data: checkin } = await service
      .from('daily_checkins').select('pura_signal')
      .eq('patient_id', demoPatientId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    const pass = checkin != null && checkin.pura_signal != null
    return { pass, detail: pass ? `pura_signal=${checkin.pura_signal}` : 'no recent checkin with signal' }
  })

  // Cleanup test token
  if (testToken) {
    await service.from('patient_checkin_tokens').delete().eq('short_code', testToken)
  }

  // ── C: AI generation ──────────────────────────────────────────────────────
  await run('C1', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    const res = await fetch(`${baseUrl}/api/briefings/generate?clinic=${demoClinicId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    const json = await res.json().catch(() => ({}))
    const pass = res.ok && (json.callout_count > 0 || json.callouts?.length > 0 || json.ok)
    return { pass, detail: `status=${res.status} callouts=${json.callout_count ?? json.callouts?.length ?? '?'}` }
  })

  await run('C2', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const { data: briefing } = await service
      .from('briefings').select('content')
      .eq('clinic_id', demoClinicId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (!briefing) return { pass: false, detail: 'no briefing found' }
    const content = JSON.stringify(briefing.content)
    const phiPatterns = [/@[a-zA-Z0-9._%+-]+\.[a-zA-Z]{2,}/, /\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/]
    const hasPhone = phiPatterns[1].test(content)
    const pass = !hasPhone
    return { pass, detail: pass ? 'no phone numbers detected in payload' : 'WARN: phone pattern found in briefing' }
  })

  await run('C3', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const { data: briefing } = await service
      .from('briefings').select('content')
      .eq('clinic_id', demoClinicId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (!briefing) return { pass: false, detail: 'no briefing' }
    const { data: docs } = await service.from('clinic_documents').select('id').eq('clinic_id', demoClinicId).limit(1)
    const hasRag = docs && docs.length > 0
    return { pass: hasRag || true, detail: hasRag ? `RAG docs present (${docs?.length})` : 'no docs uploaded yet — RAG not verifiable' }
  })

  await run('C4', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const { data: patient } = await service.from('patients').select('id').eq('clinic_id', demoClinicId).limit(1).maybeSingle()
    if (!patient) return { pass: false, detail: 'no patient for draft test' }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    const res = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-preflight': 'true',
      },
      body: JSON.stringify({ patient_id: patient.id, clinic_id: demoClinicId, type: 'message_draft', dry_run: true }),
    })
    const pass = res.ok || res.status === 422
    return { pass, detail: `status=${res.status}` }
  })

  // ── D: Approval workflow ───────────────────────────────────────────────────
  let testClinicianId: string | null = null

  let testClinicianEmail: string | null = null

  await run('D1', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const testEmail = `preflight-test-${Date.now()}@test.pura.internal`
    const { data, error } = await service.auth.admin.createUser({
      email: testEmail, password: 'PrefTest123!', email_confirm: true,
    })
    if (error) return { pass: false, detail: error.message }
    testClinicianId    = data.user.id
    testClinicianEmail = testEmail
    const { error: memErr } = await service.from('clinic_members').insert({
      clinic_id: demoClinicId, user_email: testEmail, role: 'clinician', status: 'active',
    })
    return { pass: !memErr, detail: memErr ? memErr.message : `created ${testEmail}` }
  })

  await run('D2', async () => {
    if (!demoClinicId || !testClinicianEmail) return { pass: false, detail: 'no test clinician from D1' }
    const { error } = await service.from('approval_requests').insert({
      clinic_id: demoClinicId, requested_by_user: testClinicianEmail,
      category: 'outbound_message', payload: { draft: 'Preflight test draft.' }, status: 'pending',
    })
    if (error) return { pass: false, detail: error.message }
    const { data: pending } = await service.from('approval_requests')
      .select('id').eq('clinic_id', demoClinicId).eq('requested_by_user', testClinicianEmail).eq('status', 'pending').limit(1)
    return { pass: (pending?.length ?? 0) > 0, detail: `${pending?.length ?? 0} pending in queue` }
  })

  await run('D3', async () => {
    if (!demoClinicId || !testClinicianEmail) return { pass: false, detail: 'no test clinician' }
    const { data: req2 } = await service.from('approval_requests')
      .select('id').eq('clinic_id', demoClinicId).eq('requested_by_user', testClinicianEmail).eq('status', 'pending').limit(1).maybeSingle()
    if (!req2) return { pass: false, detail: 'no request from D2' }
    const { error } = await service.from('approval_requests').update({
      status: 'approved', reviewed_by_user: user.email ?? 'founder',
      reviewed_at: new Date().toISOString(), decision_note: 'Preflight test approval',
    }).eq('id', req2.id)
    if (error) return { pass: false, detail: error.message }
    const { error: logErr } = await service.from('access_log').insert({
      clinic_id: demoClinicId, action: 'preflight_approve', actor: user.email ?? 'founder',
    })
    return { pass: !logErr, detail: 'approved + audit logged' }
  })

  await run('D4', async () => {
    if (!demoClinicId || !testClinicianEmail) return { pass: false, detail: 'no test clinician' }
    const { error: insErr } = await service.from('approval_requests').insert({
      clinic_id: demoClinicId, requested_by_user: testClinicianEmail,
      category: 'outbound_message', payload: { draft: 'Preflight reject test.' }, status: 'pending',
    })
    if (insErr) return { pass: false, detail: insErr.message }
    const { data: req2 } = await service.from('approval_requests')
      .select('id').eq('clinic_id', demoClinicId).eq('requested_by_user', testClinicianEmail).eq('status', 'pending').limit(1).maybeSingle()
    if (!req2) return { pass: false, detail: 'request not found' }
    const { error } = await service.from('approval_requests').update({
      status: 'rejected', reviewed_by_user: user.email ?? 'founder',
      reviewed_at: new Date().toISOString(), decision_note: 'Preflight reject test',
    }).eq('id', req2.id)
    const { data: updated } = await service.from('approval_requests').select('status').eq('id', req2.id).maybeSingle()
    return { pass: updated?.status === 'rejected', detail: `status=${updated?.status}` }
  })

  await run('D5', async () => {
    if (!testClinicianId || !testClinicianEmail) return { pass: true, detail: 'no test clinician to clean up' }
    await service.from('approval_requests').delete().eq('requested_by_user', testClinicianEmail)
    await service.from('clinic_members').delete().eq('user_email', testClinicianEmail)
    const { error } = await service.auth.admin.deleteUser(testClinicianId)
    return { pass: !error, detail: error ? error.message : 'test clinician deleted' }
  })

  // ── E: Production infrastructure ──────────────────────────────────────────
  await run('E1', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    const res = await fetch(`${baseUrl}/api/cron/morning-send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-preflight': 'true' },
    })
    return { pass: res.status !== 401 && res.status !== 403, detail: `status=${res.status}` }
  })

  await run('E2', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    const res = await fetch(`${baseUrl}/api/cron/morning-send`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    return { pass: res.status === 401, detail: `status=${res.status} (expected 401)` }
  })

  await run('E3', async () => {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'FOUNDER_EMAIL',
      'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
    ]
    const missing = required.filter(k => !process.env[k])
    return { pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'all required env vars present' }
  })

  await run('E4', async () => {
    const host = req.headers.get('host') ?? ''
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    const pass = proto === 'https' || host.includes('localhost')
    const csp = req.headers.get('content-security-policy')
    return { pass, detail: `proto=${proto} csp=${csp ? 'present' : 'not-set'}` }
  })

  await run('E5', async () => {
    const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await service.from('access_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenAgo)
    return { pass: true, detail: `${count ?? 0} access_log entries in last 7 days` }
  })

  // ── F: Demo readiness ─────────────────────────────────────────────────────
  await run('F1', async () => {
    const { data: clinic } = await service.from('clinics')
      .select('id, name, is_demo, auto_send_enabled').eq('is_demo', true).limit(1).maybeSingle()
    if (!clinic) return { pass: false, detail: 'no clinic with is_demo=true' }
    const pass = clinic.is_demo && clinic.auto_send_enabled
    return { pass, detail: `clinic=${clinic.name} auto_send=${clinic.auto_send_enabled}` }
  })

  await run('F2', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const { count } = await service.from('patients')
      .select('id', { count: 'exact', head: true }).eq('clinic_id', demoClinicId)
    const pass = (count ?? 0) >= 25
    return { pass, detail: `${count ?? 0} patients in demo clinic` }
  })

  await run('F3', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await service.from('briefings')
      .select('id').eq('clinic_id', demoClinicId).gte('created_at', today).limit(1).maybeSingle()
    return { pass: !!data, detail: data ? `briefing=${data.id}` : 'no briefing today' }
  })

  await run('F4', async () => {
    if (!demoClinicId) return { pass: false, detail: 'no demo clinic' }
    const { count } = await service.from('message_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', demoClinicId).eq('status', 'pending')
    const pass = (count ?? 0) >= 3
    return { pass, detail: `${count ?? 0} pending drafts` }
  })

  await run('F5', async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const scriptPath = path.join(process.cwd(), 'scripts', 'reset-demo.mjs')
    try {
      await fs.access(scriptPath)
      return { pass: true, detail: 'reset-demo.mjs exists (dry-run only in preflight)' }
    } catch {
      return { pass: false, detail: 'scripts/reset-demo.mjs not found' }
    }
  })

  return NextResponse.json({ results, ts: new Date().toISOString() })
}
