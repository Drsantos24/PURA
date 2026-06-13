# PURA Health — Claude Code Notes

## Stack
Next.js 14 App Router · TypeScript · Supabase · Vercel · Claude Haiku (briefings) · Groq/Llama (SMS drafts) · OpenAI text-embedding-3-small (RAG)

## Architecture rules
1. Service role key and AI keys ONLY in server API routes — never client-side
2. Every table has `clinic_id` + RLS enforcing per-clinic isolation
3. AI calls receive de-identified data only; server re-inserts real names before display
4. Founder sees clinic-level aggregates only, never raw PHI
5. Patients never log in — they use 24-hour check-in tokens via SMS

## Known issues / workarounds

### Node 26 ByteString bug (CRITICAL)
Node 26's built-in `fetch` implementation rejects non-ASCII characters (em dashes, smart quotes, etc.) in HTTP request/response handling and throws:
```
TypeError: Cannot convert argument to a ByteString because the character at index N has a value of 8212 which is greater than 255.
```

**Affected:** Supabase JS client when response bodies contain non-ASCII chars. Affects local scripts using Node 26.

**NOT affected:** Vercel deploys (run Node 18-20), API routes in Next.js.

**Workarounds:**
- For fire-and-forget Supabase calls that aren't awaited: use `void service.from(...).insert(...)` — do NOT chain `.catch()` on the result (the Supabase query builder returns a `PromiseLike<void>`, not a `Promise`, so `.catch()` doesn't exist on the type).
- For scripts that need to read/write non-ASCII data to Supabase: sanitize strings through a charCode-based replacer before passing to the Supabase JS client, OR use the Supabase MCP `execute_sql` tool directly (bypasses the JS client entirely).
- For local scripts that only call OpenAI (not Supabase): the OpenAI SDK is unaffected — it handles UTF-8 correctly.

### GitHub PAT rotation
The PAT used during Sessions 1-4 (`ghp_jsI...`) was used for inline git pushes. Rotate it at github.com/settings/tokens after each session. Claude Code cannot revoke GitHub tokens autonomously — this is a manual action.

### Approval settings dead call (fixed Session 4)
`ApprovalSettingsEditor` previously made a dead first call to `/api/clinic-intake` before the real `/api/approvals/settings` call. Fixed — now calls only `/api/approvals/settings`.

### Send button label (fixed Session 4)
`DraftCard` now receives `userRole` prop. Owners see "Send as SMS", non-owners see "Send for Approval". Role flows: dashboard/page.tsx → PatientRoster → PatientDrawer → DraftCard.

## Migration history
- 001-009: Initial schema, invites, tokens, check-ins, wearables, briefings, drafts
- 014: clinic_profiles v2 (expanded intake fields)
- 015: pgvector + clinic_documents + clinic_document_chunks (RAG)
- 016: Fix log_checkin_submitted trigger (::text cast bug)
- 017: intake_conversations + intake_exchanges (conversational intake)
- 018: approval_settings + approval_requests (multi-user approval workflow)
- 019: patient_import_jobs + founder_config
- 020: delivery_channel enum on patients ('sms' | 'whatsapp' | 'email' | 'both_sms_email'), default 'sms'
- 021: clinic_sms_credentials — per-clinic Twilio creds, AES-encrypted via pgcrypto, RLS, SECURITY DEFINER get_clinic_sms_creds() + encrypt_sms_credentials()

## Per-clinic SMS env vars (migration 021)
- `SUPABASE_SMS_SECRET` — 32-byte hex string used as AES key. Generate: `openssl rand -hex 32`
- Must be set two places:
  1. Vercel env: `SUPABASE_SMS_SECRET=<value>`
  2. Supabase SQL Editor: `ALTER DATABASE postgres SET app.sms_secret = '<value>';`
- lib/sms/twilio.ts now calls `get_clinic_sms_creds(clinic_id)` RPC. Falls back to platform TWILIO_* env vars if clinic has no verified creds.
- /settings/sms (owner-only): two-card UI for own Twilio vs platform default, with 6-digit SMS verification flow.

## Demo credentials
- URL: purasignal.com
- Demo login: demo@purahealth.app / demo-pura-2026
- Demo clinic: Vitality Spine & Wellness (clinic_id: 95386a93-a473-438d-bb25-c23bcf2d72df)
- Live demo patient: Joshua — +17874628720

## Cron secrets
CRON_SECRET is in .env.local. Morning briefing endpoint:
```
curl -X POST "https://purasignal.com/api/briefings/generate?clinic=<clinic_id>" \
  -H "Authorization: Bearer $CRON_SECRET"
```
