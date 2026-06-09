import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/patients/import — commit a validated import job
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { rows, filename } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  const service = createServiceClient()

  // Create job record
  const validRows   = rows.filter((r: { status: string }) => r.status !== 'error')
  const invalidRows = rows.filter((r: { status: string }) => r.status === 'error')

  const { data: job, error: jobErr } = await service
    .from('patient_import_jobs')
    .insert({
      clinic_id:        member.clinic_id,
      uploaded_by_user: user.email!,
      original_filename: filename,
      total_rows:   rows.length,
      valid_rows:   validRows.length,
      invalid_rows: invalidRows.length,
      status:       'committing',
      preview_data: { rows: rows.slice(0, 5) },
    })
    .select('id').single()

  if (jobErr || !job) return NextResponse.json({ error: jobErr?.message }, { status: 500 })

  // Insert valid patients
  const toInsert = validRows.map((r: {
    first_name: string; last_name: string; phone_number: string
    email: string | null; chief_complaint: string | null
  }) => ({
    clinic_id:       member.clinic_id,
    first_name:      r.first_name,
    last_name:       r.last_name || '',
    phone_number:    r.phone_number || 'unknown',
    email:           r.email || null,
    chief_complaint: r.chief_complaint || null,
    enrollment_status: 'active',
  }))

  const { error: insertErr } = await service.from('patients').insert(toInsert)

  if (insertErr) {
    await service.from('patient_import_jobs')
      .update({ status: 'failed' }).eq('id', job.id)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  await service.from('patient_import_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', job.id)

  return NextResponse.json({
    ok: true,
    imported:  validRows.length,
    skipped:   invalidRows.length,
    jobId:     job.id,
  })
}

// GET /api/patients/import — check existing phones + emails for dupe detection
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 })

  const { data } = await supabase
    .from('patients')
    .select('phone_number, email')
    .eq('clinic_id', member.clinic_id)

  const phones = (data ?? []).map(p => p.phone_number).filter(Boolean)
  const emails = (data ?? []).map(p => p.email).filter(Boolean)

  return NextResponse.json({ phones, emails })
}
