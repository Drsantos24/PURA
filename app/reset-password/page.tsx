import { updatePassword } from './actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-6xl text-text-primary">PURA</h1>
          <div className="mx-auto h-px w-8 bg-magenta" />
          <p className="font-sans text-sm text-text-muted">Set a new password</p>
        </div>

        {error && (
          <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-sans text-danger">
            {error}
          </p>
        )}

        <form action={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            Update password
          </button>
        </form>
      </div>
    </main>
  )
}
