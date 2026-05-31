import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

async function main() {
  const [, , email, clinicName] = process.argv

  if (!email || !clinicName) {
    console.error('\nUsage: npx tsx scripts/create-invite.ts <email> "Clinic Name"\n')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('clinic_invites').insert({
    token,
    owner_email: email,
    clinic_name: clinicName,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('\nError creating invite:', error.message, '\n')
    process.exit(1)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  console.log('\n✓ Invite created')
  console.log(`  Email:   ${email}`)
  console.log(`  Clinic:  ${clinicName}`)
  console.log(`  Expires: ${new Date(expiresAt).toLocaleDateString()}`)
  console.log(`\nSignup URL:\n  ${baseUrl}/signup?token=${token}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
