import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApprovalSettingsEditor } from './_components/ApprovalSettingsEditor'
import { seedDefaultApprovalSettings } from '@/lib/approvals'

export default async function ApprovalSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) redirect('/dashboard')
  if (member.role !== 'owner') redirect('/settings')

  const service = createServiceClient()
  const { data: settings } = await service
    .from('approval_settings')
    .select('*')
    .eq('clinic_id', member.clinic_id)

  // Seed defaults if empty
  if (!settings || settings.length === 0) {
    await seedDefaultApprovalSettings(member.clinic_id)
    const { data: fresh } = await service
      .from('approval_settings').select('*').eq('clinic_id', member.clinic_id)
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-sans text-base font-medium text-text-primary">Approval Settings</h2>
          <p className="font-sans text-xs text-text-muted">Control which actions require your review before firing.</p>
        </div>
        <ApprovalSettingsEditor initialSettings={fresh ?? []} clinicId={member.clinic_id} />
      </div>
    )
  }

  // Get team members for auto-approve configuration
  const { data: teamMembers } = await service
    .from('clinic_members').select('user_email, role')
    .eq('clinic_id', member.clinic_id).eq('status', 'active').neq('role', 'owner')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-sans text-base font-medium text-text-primary">Approval Settings</h2>
        <p className="font-sans text-xs text-text-muted">
          Control which actions require your review before they reach patients.
          You are the clinical authority — these settings let you delegate safely.
        </p>
      </div>
      <ApprovalSettingsEditor
        initialSettings={settings ?? []}
        clinicId={member.clinic_id}
        teamMembers={teamMembers ?? []}
      />
    </div>
  )
}
