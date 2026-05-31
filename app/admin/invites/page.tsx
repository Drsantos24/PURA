import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminInvitesPage() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  // Fetch all invites via service client (bypasses RLS)
  const service = createServiceClient()
  const { data: invites } = await service
    .from('clinic_invites')
    .select('owner_email, clinic_name, used_at, expires_at, token')
    .order('expires_at', { ascending: false })

  const now = new Date()

  function status(invite: { used_at: string | null; expires_at: string }) {
    if (invite.used_at) return 'used'
    if (new Date(invite.expires_at) < now) return 'expired'
    return 'active'
  }

  const statusStyle: Record<string, string> = {
    active:  'text-signal-green',
    used:    'text-text-muted',
    expired: 'text-amber',
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="font-serif text-4xl text-text-primary">Invites</h1>
          <p className="mt-1 font-sans text-sm text-text-muted">{invites?.length ?? 0} total</p>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-widest">Clinic</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-widest">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-widest">Expires</th>
              </tr>
            </thead>
            <tbody>
              {(invites ?? []).map((invite) => {
                const s = status(invite)
                const expDate = new Date(invite.expires_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
                return (
                  <tr key={invite.token} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-text-primary font-medium">{invite.clinic_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">{invite.owner_email}</td>
                    <td className={`px-4 py-3 font-medium ${statusStyle[s]}`}>{s}</td>
                    <td className="px-4 py-3 text-text-muted">{expDate}</td>
                  </tr>
                )
              })}
              {!invites?.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-text-muted">No invites yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
