import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: member } = await supabase
    .from('clinic_members').select('role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) redirect('/dashboard')
  if (member.role === 'owner') redirect('/settings/clinic-intake')
  return (
    <div className="text-sm font-sans text-text-muted">
      No settings available for your role.
    </div>
  )
}
