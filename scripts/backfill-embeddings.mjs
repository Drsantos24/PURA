#!/usr/bin/env node
// Direct embedding backfill -- bypasses Vercel function, hits Supabase + OpenAI directly.
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = (k) => env.match(new RegExp('^' + k + '=(.+)', 'm'))?.[1]?.trim()

const db     = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))
const openai = new OpenAI({ apiKey: get('OPENAI_API_KEY') })
const CLINIC = '95386a93-a473-438d-bb25-c23bcf2d72df'

const { data: chunks, error } = await db
  .from('clinic_document_chunks')
  .select('id, chunk_text, chunk_index, document_id')
  .eq('clinic_id', CLINIC)
  .is('embedding', null)

if (error) { console.error('Fetch error:', error.message); process.exit(1) }
console.log(`Chunks needing embeddings: ${chunks.length}`)
if (!chunks.length) { console.log('All chunks already embedded.'); process.exit(0) }

const texts = chunks.map(c => c.chunk_text.replace(/\n/g, ' '))
const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
console.log(`Got ${res.data.length} embeddings from OpenAI (${res.data[0].embedding.length} dims)`)

let ok = 0
for (let i = 0; i < chunks.length; i++) {
  const { error: upErr } = await db
    .from('clinic_document_chunks')
    .update({ embedding: JSON.stringify(res.data[i].embedding) })
    .eq('id', chunks[i].id)
  if (upErr) console.error(`  chunk ${chunks[i].id} error:`, upErr.message)
  else { ok++; console.log(`  [${i+1}/${chunks.length}] chunk_index=${chunks[i].chunk_index} embedded`) }
}

console.log(`\nBackfill complete: ${ok}/${chunks.length} chunks embedded.`)
