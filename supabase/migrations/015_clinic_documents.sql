-- ================================================================
-- 015_clinic_documents.sql
-- Document upload + RAG: clinic_documents + clinic_document_chunks.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── clinic_documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type   text        NOT NULL DEFAULT 'other'
                              CHECK (document_type IN (
                                'care_plan_template',
                                'intake_packet',
                                'patient_letter_template',
                                'sop',
                                'training_material',
                                'other'
                              )),
  file_name       text        NOT NULL,
  original_text   text        NOT NULL,
  summary         text,
  char_count      integer     GENERATED ALWAYS AS (char_length(original_text)) STORED,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_documents_clinic_id ON clinic_documents(clinic_id);

-- RLS
ALTER TABLE clinic_documents ENABLE ROW LEVEL SECURITY;

-- Owners can manage their clinic's documents
CREATE POLICY "owners_manage_clinic_documents" ON clinic_documents
  FOR ALL
  USING (
    clinic_id IN (
      SELECT cm.clinic_id FROM clinic_members cm
      WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND cm.role = 'owner'
        AND cm.status = 'active'
    )
  );

-- Clinicians can read
CREATE POLICY "clinicians_read_clinic_documents" ON clinic_documents
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT cm.clinic_id FROM clinic_members cm
      WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND cm.role IN ('owner', 'clinician')
        AND cm.status = 'active'
    )
  );

-- ── clinic_document_chunks ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_document_chunks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES clinic_documents(id) ON DELETE CASCADE,
  clinic_id    uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  chunk_text   text        NOT NULL,
  embedding    vector(1536),
  chunk_index  integer     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON clinic_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_clinic_id   ON clinic_document_chunks(clinic_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON clinic_document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS — service role only for chunks (embeddings pipeline uses service key)
ALTER TABLE clinic_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_chunks" ON clinic_document_chunks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── RAG retrieval function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_clinic_chunks(
  p_clinic_id   uuid,
  p_embedding   vector(1536),
  p_match_count integer DEFAULT 5
)
RETURNS TABLE (
  chunk_text  text,
  similarity  float,
  document_id uuid,
  chunk_index integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.chunk_text,
    1 - (c.embedding <=> p_embedding) AS similarity,
    c.document_id,
    c.chunk_index
  FROM clinic_document_chunks c
  WHERE c.clinic_id = p_clinic_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_embedding
  LIMIT p_match_count;
$$;
