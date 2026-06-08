import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractText } from '@/lib/documents/extract'
import { chunkText, embedBatch, embeddingsConfigured } from '@/lib/ai/embeddings'
import Anthropic from '@anthropic-ai/sdk'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES  = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
])
const ALLOWED_EXTS = new Set(['pdf', 'docx', 'txt', 'md'])

const VALID_DOC_TYPES = new Set([
  'care_plan_template', 'intake_packet', 'patient_letter_template',
  'sop', 'training_material', 'other',
])

async function generateSummary(text: string, fileName: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || key.startsWith('placeholder')) return ''
  try {
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize this clinic document in 2–3 sentences. Focus on what it contains and how it would be useful for AI-powered patient communications. File: ${fileName}\n\n${text.slice(0, 4000)}`,
      }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  // Auth — owner only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const formData   = await req.formData()
  const file       = formData.get('file') as File | null
  const docType    = (formData.get('document_type') as string | null) ?? 'other'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Upload PDF, DOCX, TXT, or MD.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit.' }, { status: 400 })
  }
  if (!VALID_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'Invalid document_type.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { text, pageCount, error: extractError } = await extractText(buffer, file.type, file.name)

  if (extractError || !text) {
    return NextResponse.json({ error: extractError ?? 'Could not extract text from file.' }, { status: 422 })
  }

  const [summary] = await Promise.all([generateSummary(text, file.name)])

  const service = createServiceClient()

  // Insert document record
  const { data: doc, error: docErr } = await service
    .from('clinic_documents')
    .insert({
      clinic_id:     member.clinic_id,
      owner_user_id: user.id,
      document_type: docType,
      file_name:     file.name,
      original_text: text,
      summary,
    })
    .select('id, file_name, summary, char_count, uploaded_at')
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: docErr?.message ?? 'Failed to store document.' }, { status: 500 })
  }

  // Generate embeddings and store chunks
  let chunksStored = 0
  if (embeddingsConfigured()) {
    try {
      const chunks    = chunkText(text)
      const embeddings = await embedBatch(chunks)
      const rows = chunks.map((chunk_text, i) => ({
        document_id: doc.id,
        clinic_id:   member.clinic_id,
        chunk_text,
        embedding:   JSON.stringify(embeddings[i]),
        chunk_index: i,
      }))
      for (let i = 0; i < rows.length; i += 50) {
        const { error: chunkErr } = await service
          .from('clinic_document_chunks')
          .insert(rows.slice(i, i + 50))
        if (chunkErr) console.error('[documents] chunk insert error:', chunkErr.message)
        else chunksStored += Math.min(50, rows.length - i)
      }
    } catch (err) {
      console.error('[documents] embedding error:', err)
    }
  }

  return NextResponse.json({
    ok:           true,
    document:     doc,
    chunks_stored: chunksStored,
    page_count:   pageCount,
    embeddings_enabled: embeddingsConfigured(),
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member || !['owner', 'clinician'].includes(member.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('clinic_documents')
    .select('id, document_type, file_name, summary, char_count, uploaded_at')
    .eq('clinic_id', member.clinic_id)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('clinic_documents')
    .delete()
    .eq('id', docId)
    .eq('clinic_id', member.clinic_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
