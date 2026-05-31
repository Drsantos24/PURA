import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const BETA_CLINICS = [
  { email: 'harrisonc@helixsportsmed.com',  clinic_name: 'Helix Austin' },
  { email: 'dryinacuevas@gmail.com',         clinic_name: 'Mana Chiropractic' },
  { email: 'dr.bryantramirez@gmail.com',     clinic_name: 'Mycelium Chiropractic' },
  { email: 'davidmirandarivera67@gmail.com', clinic_name: 'Quito Tropical' },
  { email: 'dr.brewerchiro@gmail.com',       clinic_name: 'Anointed Vessel Chiropractic' },
  { email: 'drdenischang@gmail.com',         clinic_name: 'Optimize Health Miami' },
]

const EXPIRY_DAYS = 14

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let newCount = 0
  let reusedCount = 0

  for (const clinic of BETA_CLINICS) {
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('clinic_invites')
      .select('token, expires_at')
      .eq('owner_email', clinic.email)
      .is('used_at', null)
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)

    let token: string
    let expiresAt: string

    if (existing && existing.length > 0) {
      token = existing[0].token
      expiresAt = existing[0].expires_at
      reusedCount++
    } else {
      token = randomBytes(32).toString('hex')
      expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('clinic_invites').insert({
        token,
        owner_email: clinic.email,
        clinic_name: clinic.clinic_name,
        expires_at: expiresAt,
      })

      if (error) {
        console.error(`\n✗ Failed to create invite for ${clinic.email}: ${error.message}`)
        continue
      }
      newCount++
    }

    console.log(`
CLINIC:  ${clinic.clinic_name}
OWNER:   ${clinic.email}
URL:     ${baseUrl}/signup?token=${token}
EXPIRES: ${formatDate(expiresAt)}`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${BETA_CLINICS.length} invite URLs ready. ${newCount} new, ${reusedCount} reused.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
