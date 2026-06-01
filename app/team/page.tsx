import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentClinicMember } from '@/lib/auth/permissions'
import { inviteTeamMember, revokeMember, revokeInvite } from './actions'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_url?: string; err?: string }>
}) {
  const member = await getCurrentClinicMember()
  if (!member) redirect('/login')
  if (member.role !== 'owner') notFound()

  const { invite_url, err } = await searchParams
  const supabase = await createClient()

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from('clinic_members')
      .select('id, user_email, role, status, accepted_at')
      .eq('clinic_id', member.clinic_id)
      .order('accepted_at', { ascending: true }),
    supabase
      .from('clinic_member_invites')
      .select('id, invited_email, role, expires_at, created_at')
      .eq('clinic_id', member.clinic_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  return (
    <main className="min-h-screen bg-background px-8 py-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-serif text-4xl text-text-primary">Team</h1>
            <p className="mt-1 font-sans text-sm text-text-muted">Manage who has access to your clinic</p>
          </div>
          <a href="/dashboard" className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            ← Dashboard
          </a>
        </div>

        {/* Error banner */}
        {err && (
          <div className="rounded-md bg-danger/10 border border-danger/20 px-4 py-3 text-sm font-sans text-danger">
            {err}
          </div>
        )}

        {/* New invite URL banner */}
        {invite_url && (
          <div className="rounded-md bg-magenta/5 border border-magenta/30 px-4 py-3 space-y-1">
            <p className="font-sans text-xs uppercase tracking-widest text-magenta">Invite link created — copy and share</p>
            <p className="font-mono text-xs text-text-primary break-all">{invite_url}</p>
          </div>
        )}

        {/* Invite form */}
        <section className="space-y-3">
          <p className="font-sans text-xs uppercase tracking-widest text-text-muted">Invite a team member</p>
          <form action={inviteTeamMember} className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-sans text-text-muted">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="colleague@clinic.com"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-sans text-text-muted">Role</label>
              <select
                name="role"
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-sans text-text-primary focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta"
              >
                <option value="clinician">Clinician</option>
                <option value="assistant">Assistant</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-magenta/10 border border-magenta/40 px-4 py-2 text-sm font-sans text-magenta hover:bg-magenta/20 transition-colors"
            >
              Generate invite
            </button>
          </form>
        </section>

        {/* Pending invites */}
        {(invites?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <p className="font-sans text-xs uppercase tracking-widest text-text-muted">Pending invites</p>
            <div className="space-y-2">
              {invites!.map(inv => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                  <div>
                    <p className="font-sans text-sm text-text-primary">{inv.invited_email}</p>
                    <p className="font-sans text-xs text-text-muted capitalize">
                      {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <form action={revokeInvite.bind(null, inv.id)}>
                    <button className="text-xs font-sans text-text-muted hover:text-danger transition-colors">
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active members */}
        <section className="space-y-3">
          <p className="font-sans text-xs uppercase tracking-widest text-text-muted">Active members</p>
          <div className="space-y-2">
            {(members ?? []).filter(m => m.status === 'active').map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="font-sans text-sm text-text-primary">{m.user_email}</p>
                  <p className="font-sans text-xs text-text-muted capitalize">{m.role}</p>
                </div>
                {m.role !== 'owner' && (
                  <form action={revokeMember.bind(null, m.id)}>
                    <button className="text-xs font-sans text-text-muted hover:text-danger transition-colors">
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
