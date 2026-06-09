import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportWizard } from './_components/ImportWizard'

export default async function OnboardingPatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) redirect('/login')
  if (member.role !== 'owner') redirect('/dashboard')

  const { data: clinic } = await supabase
    .from('clinics').select('clinic_name').eq('id', member.clinic_id).single()

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-4xl text-text-primary">Import your patients</h1>
          <p className="font-sans text-sm text-text-muted">
            {clinic?.clinic_name} &mdash; upload your existing patient list
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface/50 p-6">
          <ImportWizard redirectTo="/onboarding/conversation" />
        </div>
        <div className="text-center">
          <a href="/onboarding/conversation"
            className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            Skip — I&apos;ll add patients later
          </a>
        </div>
      </div>
    </main>
  )
}
