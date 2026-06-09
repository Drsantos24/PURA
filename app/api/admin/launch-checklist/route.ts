import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const FOUNDER_KEY = 'launch_checklist'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.FOUNDER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data } = await service.from('founder_config').select('value').eq('key', FOUNDER_KEY).maybeSingle()
  return NextResponse.json({ checklist: data?.value ?? {} })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.FOUNDER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { checklist } = await req.json()
  const service = createServiceClient()
  await service.from('founder_config').upsert({
    key: FOUNDER_KEY, value: checklist, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  return NextResponse.json({ ok: true })
}
