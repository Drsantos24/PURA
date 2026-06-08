import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClinicIntakeEditor } from './_components/ClinicIntakeEditor'

export default async function ClinicIntakePage() {
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

  const { data: profile } = await supabase
    .from('clinic_profiles')
    .select('*')
    .eq('clinic_id', member.clinic_id)
    .maybeSingle()

  const totalSections = 5
  const completedSections = (profile?.completed_sections as Record<string, boolean>) ?? {}
  const doneSections = Object.values(completedSections).filter(Boolean).length
  const trainingPct  = Math.round((doneSections / totalSections) * 100)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-sans text-base font-medium text-text-primary">Clinic AI Profile</h2>
          <p className="font-sans text-xs text-text-muted">
            The richer the input, the more your PURA briefings and messages sound like you.
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-sans text-text-muted">AI trained</p>
          <p className="text-2xl font-mono text-magenta font-medium">{trainingPct}%</p>
        </div>
      </div>
      <ClinicIntakeEditor initialProfile={profile} />
    </div>
  )
}
