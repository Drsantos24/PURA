import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members')
    .select('role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  const isOwner = member.role === 'owner'

  return (
    <main className="min-h-screen bg-background px-4 sm:px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            ← Dashboard
          </Link>
          <span className="text-text-muted/30">/</span>
          <h1 className="font-sans text-sm font-medium text-text-primary">Settings</h1>
        </div>
        <nav className="flex flex-wrap gap-1 border-b border-border pb-0">
          {isOwner && (
            <>
              <Link href="/settings/clinic-intake"
                className="px-4 py-2 text-sm font-sans text-text-muted hover:text-text-primary border-b-2 border-transparent hover:border-magenta/50 transition-colors -mb-px">
                Clinic AI Profile
              </Link>
              <Link href="/settings/documents"
                className="px-4 py-2 text-sm font-sans text-text-muted hover:text-text-primary border-b-2 border-transparent hover:border-magenta/50 transition-colors -mb-px">
                Documents
              </Link>
              <Link href="/settings/approvals"
                className="px-4 py-2 text-sm font-sans text-text-muted hover:text-text-primary border-b-2 border-transparent hover:border-magenta/50 transition-colors -mb-px">
                Approvals
              </Link>
              <Link href="/settings/patients/import"
                className="px-4 py-2 text-sm font-sans text-text-muted hover:text-text-primary border-b-2 border-transparent hover:border-magenta/50 transition-colors -mb-px">
                Import Patients
              </Link>
            </>
          )}
        </nav>
        <div>{children}</div>
      </div>
    </main>
  )
}
