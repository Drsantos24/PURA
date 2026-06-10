import { requestPasswordReset } from './actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>
}) {
  const { message, error } = await searchParams

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-2 h-2 rounded-full bg-magenta mx-auto" />
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-text-muted">PURA Health</p>
          <p className="font-sans text-sm text-text-primary">Reset your password</p>
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

        {!message && (
          <form action={requestPasswordReset} className="space-y-4">
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

            <button
              type="submit"
              className="w-full rounded-md bg-magenta px-4 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90"
            >
              Send reset link
            </button>
          </form>
        )}

        <div className="text-center">
          <a
            href="/login"
            className="text-sm font-sans text-text-muted hover:text-text-primary transition-colors"
          >
            ← Back to sign in
          </a>
        </div>
      </div>
    </main>
  )
}
