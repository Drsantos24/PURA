import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const service = createServiceClient()
  const cutoff  = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await service
    .from('access_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, purged: count })
}

export async function GET(req: NextRequest) { return POST(req) }
