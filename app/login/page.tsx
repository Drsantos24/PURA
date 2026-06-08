import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  // Already signed in — route based on membership state to break redirect loops
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: member } = await supabase
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_email', user.email!)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!member) {
      redirect('/onboarding')
    }

    const { data: clinic } = await supabase
      .from('clinics')
      .select('onboarding_complete')
      .eq('id', member.clinic_id)
      .single()

    if (!clinic?.onboarding_complete) {
      redirect('/onboarding')
    }

    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-6xl text-text-primary">PURA</h1>
          <div className="mx-auto h-px w-8 bg-magenta" />
          <p className="font-sans text-sm text-text-muted">Sign in to your clinic</p>
        </div>

        {error && (
          <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-sans text-danger">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-md bg-signal-green/10 px-4 py-3 text-sm font-sans text-signal-green">
            {message}
          </p>
        )}

        <form action={signIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
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
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-magenta px-4 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <div className="text-center">
          <a
            href="/forgot-password"
            className="text-sm font-sans text-text-muted hover:text-text-primary transition-colors"
          >
            Forgot your password?
          </a>
        </div>
      </div>
    </main>
  )
}
