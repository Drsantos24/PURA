import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { approveRequest, rejectRequest } from '@/lib/approvals'
import { sendSMS } from '@/lib/sms/twilio'

// GET /api/approvals — list pending approvals (owner) or own requests (non-owner)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 })

  const service = createServiceClient()

  if (member.role === 'owner') {
    const { data } = await service
      .from('approval_requests')
      .select('*')
      .eq('clinic_id', member.clinic_id)
      .order('created_at', { ascending: false })
    return NextResponse.json({ requests: data ?? [], role: 'owner' })
  } else {
    const { data } = await service
      .from('approval_requests')
      .select('*')
      .eq('clinic_id', member.clinic_id)
      .eq('requested_by_user', user.email!)
      .order('created_at', { ascending: false })
    return NextResponse.json({ requests: data ?? [], role: member.role })
  }
}

// POST /api/approvals — approve or reject
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { action, requestId, editedPayload, note } = await req.json()

  if (action === 'approve') {
    const payload = await approveRequest(requestId, user.email!, editedPayload)

    // Execute approved action
    const service = createServiceClient()
    const { data: reqRow } = await service
      .from('approval_requests').select('category, payload').eq('id', requestId).single()

    if (reqRow?.category === 'outbound_message') {
      const p = (editedPayload ?? reqRow.payload) as Record<string, string>
      const { data: patient } = await service
        .from('patients').select('phone_number, clinic_id, is_demo_live').eq('id', p.patient_id).single()
      if (patient) {
        const { data: clinic } = await service.from('clinics').select('is_demo').eq('id', patient.clinic_id).single()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isDemo = (clinic as any)?.is_demo === true
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isLive = (patient as any)?.is_demo_live === true
        const body = p.body ?? p.draft_body ?? ''
        if (!isDemo || isLive) await sendSMS(patient.phone_number, body)
        // Mark draft sent
        if (p.draft_id) {
          await service.from('message_drafts')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', p.draft_id)
        }
      }
    }

    return NextResponse.json({ ok: true, payload })
  }

  if (action === 'reject') {
    await rejectRequest(requestId, user.email!, note ?? '')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
