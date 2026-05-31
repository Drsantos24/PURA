import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

function toFirstName(email: string): string {
  const local = email.split('@')[0]
  const cleaned = local
    .replace(/^dr\.?/i, '')
    .replace(/[0-9]/g, '')
    .replace(/[._-]/g, ' ')
    .trim()
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .split(' ')[0]
}

async function main() {
  const [, , targetEmail] = process.argv

  if (!targetEmail) {
    console.error('\nUsage: npx tsx scripts/print-invite-email.ts <email>\n')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const now = new Date().toISOString()

  const { data: invite, error } = await supabase
    .from('clinic_invites')
    .select('token, owner_email, clinic_name, expires_at')
    .eq('owner_email', targetEmail)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !invite) {
    console.error(`\n✗ No active invite found for ${targetEmail}. Run seed-beta-invites.ts first.\n`)
    process.exit(1)
  }

  const firstName   = toFirstName(invite.owner_email)
  const signupUrl   = `${baseUrl}/signup?token=${invite.token}`
  const expiresDate = new Date(invite.expires_at)
  const daysLeft    = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const expiresStr  = expiresDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  console.log(`
${'─'.repeat(60)}
TO:      ${invite.owner_email}
SUBJECT: Your PURA founding access is ready
${'─'.repeat(60)}

Hey ${firstName},

I'm giving you early access to PURA — an AI-powered patient monitoring system I built specifically for chiropractic practices. As a founding beta member for ${invite.clinic_name}, you're locked in at $297/month, and you'll get AI-drafted daily check-ins sent to your active patients automatically.

Here's your setup link:

${signupUrl}

Takes about 3 minutes to get your clinic live. The link expires ${expiresStr} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} from now).

Reply to this email if anything looks off — I'll get on a call.

— Joshua

${'─'.repeat(60)}
`)
}

main().catch(err => { console.error(err); process.exit(1) })
