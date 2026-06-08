import 'server-only'

// OpenAI text-embedding-3-small — cheap ($0.02/M tokens), 1536 dimensions.
// Used for document chunk embedding and RAG query embedding.
// No-ops gracefully when OPENAI_API_KEY is missing.

export function embeddingsConfigured(): boolean {
  const k = process.env.OPENAI_API_KEY
  return !!k && !k.startsWith('placeholder') && !k.startsWith('your_')
}

async function openaiClient() {
  const { default: OpenAI } = await import('openai')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const EMBED_MODEL = 'text-embedding-3-small'

export async function embedText(text: string): Promise<number[]> {
  const client = await openaiClient()
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text.replace(/\n/g, ' '),
  })
  return res.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = await openaiClient()
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts.map(t => t.replace(/\n/g, ' ')),
  })
  return res.data.map(d => d.embedding)
}

// Split text into ~500-token chunks with 50-token overlap.
// Approximation: 1 token ≈ 4 chars.
export function chunkText(text: string, chunkChars = 2000, overlapChars = 200): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length)
    chunks.push(text.slice(start, end).trim())
    start += chunkChars - overlapChars
  }
  return chunks.filter(c => c.length > 50)
}
