import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import { embedText, embeddingsConfigured } from './embeddings'

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
