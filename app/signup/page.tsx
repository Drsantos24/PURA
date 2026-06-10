import { createAdminClient } from '@/lib/supabase/admin'
import { signUp } from './actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams

  if (!token) {
    return <InvalidInvite message="Missing signup token. Please use the link from your invite email." />
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('clinic_invites')
    .select('owner_email, clinic_name, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    return <InvalidInvite message="This invite link is invalid or has expired. Please contact PURA support." />
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-2 h-2 rounded-full bg-magenta mx-auto" />
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-text-muted">PURA Health</p>
          <p className="font-sans text-sm text-text-primary">
            Set up your account for{' '}
            <span className="font-medium">{invite.clinic_name}</span>
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-sans text-danger">
            {error}
          </p>
        )}

        <form action={signUp} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-2">
            <label className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={invite.owner_email}
              readOnly
              className="w-full rounded-md border border-border bg-surface/50 px-4 py-2.5 text-sm font-sans text-text-muted cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-magenta px-4 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90"
          >
            Create account
          </button>
        </form>
      </div>
    </main>
  )
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-2 h-2 rounded-full bg-magenta mx-auto" />
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-text-muted">PURA Health</p>
        <p className="font-sans text-sm text-text-muted">{message}</p>
        <a href="/login" className="block text-sm font-sans text-text-muted hover:text-text-primary transition-colors">
          ← Back to sign in
        </a>
      </div>
    </main>
  )
}
