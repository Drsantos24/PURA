import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { generateUniqueShortCode } from '../lib/shortCode'

async function main() {
  const [, , identifier] = process.argv

  if (!identifier) {
    console.error('\nUsage: npx tsx scripts/generate-test-token.ts <patient_email_or_id>\n')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

  const { data: patients, error } = isUuid
    ? await supabase.from('patients').select('id, first_name, last_name, clinic_id').eq('id', identifier)
    : await supabase.from('patients').select('id, first_name, last_name, clinic_id').ilike('email', identifier)

  if (error) {
    console.error('\n✗ DB error:', error.message, '\n')
    process.exit(1)
  }
  if (!patients || patients.length === 0) {
    console.error(`\n✗ No patient found for "${identifier}"\n`)
    process.exit(1)
  }

  const patient = patients[0]
  const shortCode = await generateUniqueShortCode(supabase as Parameters<typeof generateUniqueShortCode>[0])

  const { data: tokenRow, error: tokenError } = await supabase
    .from('patient_checkin_tokens')
    .insert({
      patient_id: patient.id,
      clinic_id:  patient.clinic_id,
      short_code: shortCode,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token, short_code')
    .single()

  if (tokenError || !tokenRow) {
    console.error('\n✗ Failed to create token:', tokenError?.message, '\n')
    process.exit(1)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  console.log(`
Patient: ${patient.first_name} ${patient.last_name}
ID:      ${patient.id}

Short URL (send this):
${baseUrl}/c/${tokenRow.short_code}

Backup URL (same destination):
${baseUrl}/checkin/${tokenRow.token}
`)
}

main().catch(err => { console.error(err); process.exit(1) })
