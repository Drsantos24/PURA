'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// ── helpers ────────────────────────────────────────────────────

function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return raw.trim()
}

function splitCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { values.push(current); current = ''; continue }
    current += ch
  }
  values.push(current)
  return values
}

interface PatientRow {
  first_name: string
  last_name: string
  phone_number: string
  email: string | null
  chief_complaint: string | null
}

function parseCSV(text: string): { rows: PatientRow[]; skipped: number } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], skipped: 0 }

  const rawHeaders = splitCSVLine(lines[0]).map(h =>
    h.replace(/['"]/g, '').trim().toLowerCase().replace(/[\s-]/g, '_')
  )

  const aliases: Record<string, string> = {
    first_name: 'first_name', firstname: 'first_name', first: 'first_name',
    last_name:  'last_name',  lastname:  'last_name',  last:  'last_name',
    phone_number: 'phone_number', phone: 'phone_number',
    mobile: 'phone_number', cell: 'phone_number',
    email: 'email', email_address: 'email',
    chief_complaint: 'chief_complaint', complaint: 'chief_complaint',
    condition: 'chief_complaint', reason: 'chief_complaint',
  }

  const colMap = rawHeaders.map(h => aliases[h] ?? null)
  const get = (values: string[], field: string) => {
    const idx = colMap.indexOf(field)
    return idx >= 0 ? (values[idx] ?? '').replace(/^["']|["']$/g, '').trim() : ''
  }

  const rows: PatientRow[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = splitCSVLine(line)
    const firstName = get(vals, 'first_name')
    const phone     = get(vals, 'phone_number')
    const email     = get(vals, 'email')
    if (!firstName || (!phone && !email)) { skipped++; continue }
    rows.push({
      first_name:      firstName,
      last_name:       get(vals, 'last_name'),
      phone_number:    sanitizePhone(phone),
      email:           email || null,
      chief_complaint: get(vals, 'chief_complaint') || null,
    })
  }

  return { rows, skipped }
}

// ── step 1 ─────────────────────────────────────────────────────

export async function saveStep1(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('clinics')
    .update({
      clinic_name: (formData.get('clinic_name') as string).trim(),
      location:    (formData.get('location')    as string).trim() || null,
      timezone:     formData.get('timezone')    as string,
      phone:       (formData.get('phone')       as string).trim() || null,
      website:     (formData.get('website')     as string).trim() || null,
    })
    .eq('owner_email', user.email!)

  redirect('/onboarding?step=2')
}

// ── step 2 ─────────────────────────────────────────────────────

export async function importPatients(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('owner_email', user.email!)
    .single()
  if (!clinic) redirect('/login')

  const mode = formData.get('mode') as string
  let toInsert: (PatientRow & { clinic_id: string })[] = []
  let skipped = 0

  if (mode === 'csv') {
    const file = formData.get('csv') as File | null
    if (!file || file.size === 0) redirect('/onboarding?step=2&error=No+file+selected.')
    if ((file as File).size > 1_000_000) {
      redirect('/onboarding?step=2&error=CSV+exceeds+1+MB.+Contact+support+for+larger+imports.')
    }
    const text = await (file as File).text()
    const parsed = parseCSV(text)
    toInsert = parsed.rows.map(r => ({ ...r, clinic_id: clinic.id }))
    skipped = parsed.skipped
  } else {
    // manual entry — patients_json hidden field
    const json = formData.get('patients_json') as string
    let manual: Array<{
      first_name?: string; last_name?: string
      phone_number?: string; email?: string; chief_complaint?: string
    }> = []
    try { manual = JSON.parse(json) } catch {
      redirect('/onboarding?step=2&error=Invalid+form+data.+Please+try+again.')
    }

    for (const p of manual) {
      const fn    = (p.first_name    ?? '').trim()
      const phone = (p.phone_number  ?? '').trim()
      const email = (p.email         ?? '').trim()
      if (!fn || (!phone && !email)) { skipped++; continue }
      toInsert.push({
        clinic_id:       clinic.id,
        first_name:      fn,
        last_name:       (p.last_name       ?? '').trim(),
        phone_number:    sanitizePhone(phone),
        email:           email || null,
        chief_complaint: (p.chief_complaint ?? '').trim() || null,
      })
    }
  }

  if (toInsert.length === 0) {
    redirect(
      `/onboarding?step=2&error=${encodeURIComponent(
        `No valid patients found — ${skipped} row(s) skipped (missing name or contact info).`
      )}`
    )
  }

  // Regular server client → RLS applies → DC can only insert into their own clinic
  const { error: insertErr } = await supabase.from('patients').insert(toInsert)
  if (insertErr) redirect(`/onboarding?step=2&error=${encodeURIComponent(insertErr.message)}`)

  redirect(`/onboarding?step=3&imported=${toInsert.length}&skipped=${skipped}`)
}

// ── step 3 ─────────────────────────────────────────────────────

export async function finishOnboarding(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('owner_email', user.email!)
    .single()
  if (!clinic) redirect('/login')

  const threshold = parseInt(formData.get('alert_threshold') as string, 10)

  await supabase
    .from('clinic_settings')
    .update({
      checkin_send_time:  formData.get('send_time') as string,
      auto_send_enabled:  formData.get('auto_send') === 'on',
      message_tone:       formData.get('message_tone') as string,
      alert_threshold:    isNaN(threshold) ? 15 : Math.min(30, Math.max(5, threshold)),
    })
    .eq('clinic_id', clinic.id)

  await supabase
    .from('clinics')
    .update({ onboarding_complete: true })
    .eq('id', clinic.id)

  redirect('/dashboard')
}
