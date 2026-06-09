import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportWizard } from '@/app/onboarding/patients/_components/ImportWizard'

export default async function SettingsPatientsImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members').select('role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') redirect('/settings')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-sans text-base font-medium text-text-primary">Import Patients</h2>
        <p className="font-sans text-xs text-text-muted">
          Upload a CSV or Excel file. Handles messy formats, detects duplicates, lets you fix errors before committing.
        </p>
      </div>
      <ImportWizard redirectTo="/dashboard" />
    </div>
  )
}
