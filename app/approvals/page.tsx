import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApprovalInbox } from './_components/ApprovalInbox'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) redirect('/dashboard')

  const service = createServiceClient()

  // Owners see all pending; non-owners see their own
  const query = service
    .from('approval_requests')
    .select('*')
    .eq('clinic_id', member.clinic_id)
    .order('created_at', { ascending: false })

  const { data: requests } = member.role === 'owner'
    ? await query
    : await query.eq('requested_by_user', user.email!)

  return (
    <main className="min-h-screen bg-background px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            ← Dashboard
          </a>
          <span className="text-text-muted/30">/</span>
          <h1 className="font-sans text-sm font-medium text-text-primary">
            {member.role === 'owner' ? 'Approval Inbox' : 'My Requests'}
          </h1>
        </div>

        <ApprovalInbox
          requests={requests ?? []}
          userRole={member.role as 'owner' | 'clinician' | 'assistant'}
          userEmail={user.email!}
        />
      </div>
    </main>
  )
}
