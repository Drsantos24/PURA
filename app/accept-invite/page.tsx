import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvite } from './actions'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorScreen>Missing invite token. Please use the link from your invite email.</ErrorScreen>
  }

  const service = createServiceClient()
  const { data: invite } = await service
    .from('clinic_member_invites')
    .select('id, invited_email, role, clinic_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    return <ErrorScreen>This invite link is invalid or has expired. Ask your clinic owner to send a new one.</ErrorScreen>
  }

  // Check if they already have a PURA account
  const admin = createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()
  const existingUser = users.find(u => u.email === invite.invited_email)

  if (existingUser) {
    // Already has an account — redirect to login with context
    redirect(`/login?message=${encodeURIComponent(`Sign in as ${invite.invited_email} to join your clinic.`)}`)
  }

  const { data: clinic } = await service
    .from('clinics')
    .select('clinic_name')
    .eq('id', invite.clinic_id)
    .single()

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-6xl text-text-primary">PURA</h1>
          <div className="mx-auto h-px w-8 bg-magenta" />
          <p className="font-sans text-sm text-text-muted">
            You&apos;ve been invited to join{' '}
            <span className="text-text-primary">{clinic?.clinic_name}</span>
            {' '}as a <span className="text-text-primary capitalize">{invite.role}</span>.
          </p>
        </div>

        <form action={acceptInvite} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-2">
            <label className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={invite.invited_email}
              readOnly
              className="w-full rounded-md border border-border bg-surface/50 px-4 py-2.5 text-sm font-sans text-text-muted cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Create password
            </label>
            <input
              id="password" name="password" type="password"
              autoComplete="new-password" required minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Confirm password
            </label>
            <input
              id="confirm" name="confirm" type="password"
              autoComplete="new-password" required minLength={8}
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-magenta px-4 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90"
          >
            Create account &amp; join clinic
          </button>
        </form>
      </div>
    </main>
  )
}

function ErrorScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="font-serif text-6xl text-text-primary">PURA</h1>
        <div className="mx-auto h-px w-8 bg-magenta" />
        <p className="font-sans text-sm text-text-muted">{children}</p>
        <a href="/login" className="block text-sm font-sans text-text-muted hover:text-text-primary transition-colors">← Back to sign in</a>
      </div>
    </main>
  )
}
