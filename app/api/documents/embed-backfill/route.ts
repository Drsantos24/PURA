import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { embedBatch, embeddingsConfigured } from '@/lib/ai/embeddings'

// POST /api/documents/embed-backfill?clinic=<id>
// Backfills embeddings for any chunks that have null embedding.
// Protected by CRON_SECRET — same as morning briefing cron.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!embeddingsConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 400 })
  }

  const clinicId = req.nextUrl.searchParams.get('clinic')
  if (!clinicId) return NextResponse.json({ error: 'Missing ?clinic=' }, { status: 400 })

  const service = createServiceClient()

  // Fetch chunks without embeddings
  const { data: chunks, error } = await service
    .from('clinic_document_chunks')
    .select('id, chunk_text')
    .eq('clinic_id', clinicId)
    .is('embedding', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!chunks?.length) return NextResponse.json({ ok: true, backfilled: 0 })

  const BATCH = 50
  let backfilled = 0

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const texts = batch.map(c => c.chunk_text)
    const embeddings = await embedBatch(texts)

    for (let j = 0; j < batch.length; j++) {
      const { error: upErr } = await service
        .from('clinic_document_chunks')
        .update({ embedding: JSON.stringify(embeddings[j]) })
        .eq('id', batch[j].id)
      if (!upErr) backfilled++
    }
  }

  return NextResponse.json({ ok: true, backfilled, total: chunks.length })
}
