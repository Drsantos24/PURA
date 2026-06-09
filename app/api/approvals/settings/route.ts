import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { category, requires_approval, auto_approve_for_roles } = await req.json()

  const service = createServiceClient()
  const { error } = await service
    .from('approval_settings')
    .upsert({
      clinic_id: member.clinic_id,
      category,
      requires_approval,
      auto_approve_for_roles: auto_approve_for_roles ?? [],
    }, { onConflict: 'clinic_id,category' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
