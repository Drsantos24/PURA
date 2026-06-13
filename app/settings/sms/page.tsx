import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SmsSettingsClient } from './_components/SmsSettingsClient'

export const dynamic = 'force-dynamic'

export default async function SmsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')
  if (member.role !== 'owner') redirect('/settings')

  const service = createServiceClient()

  // Safe credential status — no decryption here, blobs stay server-side
  const { data: creds } = await service
    .from('clinic_sms_credentials')
    .select('provider, from_number, whatsapp_from_number, is_verified, verified_at, last_send_at')
    .eq('clinic_id', member.clinic_id)
    .maybeSingle()

  // Sends this month (morning_send actions in access_log)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count: sendCount } = await service
    .from('access_log')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', member.clinic_id)
    .eq('action', 'morning_send')
    .gte('created_at', monthStart.toISOString())

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-sans text-base font-medium text-text-primary">SMS &amp; Messaging</h2>
        <p className="font-sans text-xs text-text-muted">
          Choose how PURA sends daily check-in links to your patients.{' '}
          <a
            href="/docs/sms-setup"
            className="underline underline-offset-2 hover:text-text-primary transition-colors"
          >
            Setup guide →
          </a>
        </p>
      </div>

      <SmsSettingsClient
        clinicId={member.clinic_id}
        initialCreds={creds ?? null}
        sendCountThisMonth={sendCount ?? 0}
      />
    </div>
  )
}
