import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import { embedText, embeddingsConfigured } from './embeddings'

// Pull key phrases and summaries from completed intake exchanges.
// These are plain text — no embedding needed, always available.
export async function retrieveIntakeInsights(clinicId: string): Promise<string> {
  const service = createServiceClient()
  // Two-step: get most recent completed conversation, then fetch exchanges
  const { data: conv } = await service
    .from('intake_conversations')
    .select('id')
    .eq('clinic_id', clinicId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv) return ''

  const { data } = await service
    .from('intake_exchanges')
    .select('question_category, answer_text, ai_extracted_insights')
    .eq('conversation_id', conv.id)
    .not('answer_text', 'is', null)
    .order('exchange_order', { ascending: true })
    .limit(10)

  if (!data?.length) return ''

  const lines: string[] = ['KEY INSIGHTS FROM CLINIC INTAKE INTERVIEW:']
  for (const ex of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = ex.ai_extracted_insights as any
    if (ins?.summary) lines.push(`[${ex.question_category}] ${ins.summary}`)
    if (ins?.vocabulary?.banned?.length) {
      lines.push(`  NEVER use: ${ins.vocabulary.banned.join(', ')}`)
    }
    if (ins?.vocabulary?.preferred?.length) {
      lines.push(`  USE instead: ${ins.vocabulary.preferred.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export type RetrievedChunk = {
  chunk_text: string
  similarity: number
  document_id: string
  chunk_index: number
}

export async function retrieveClinicContext(
  clinicId: string,
  query: string,
  matchCount = 5,
): Promise<RetrievedChunk[]> {
  if (!embeddingsConfigured()) return []

  try {
    const embedding = await embedText(query)
    const service = createServiceClient()

    const { data, error } = await service.rpc('match_clinic_chunks', {
      p_clinic_id:   clinicId,
      p_embedding:   JSON.stringify(embedding),
      p_match_count: matchCount,
    })

    if (error) {
      console.error('[RAG] match_clinic_chunks error:', error.message)
      return []
    }

    return (data ?? []) as RetrievedChunk[]
  } catch (err) {
    console.error('[RAG] retrieval failed:', err)
    return []
  }
}

export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return ''
  return [
    'RETRIEVED CLINIC DOCUMENTS (ranked by relevance — treat as authoritative clinic-specific context):',
    ...chunks.map((c, i) =>
      `[Doc ${i + 1} | similarity ${(c.similarity * 100).toFixed(0)}%]\n${c.chunk_text}`
    ),
  ].join('\n\n')
}
