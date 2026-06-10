import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PreflightClient } from './_components/PreflightClient'

export default async function PreflightPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  return (
    <main className="min-h-screen bg-background px-4 sm:px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-text-primary">Pre-Share Preflight</h1>
            <p className="font-sans text-xs text-text-muted mt-1">Founder-only. Runs live against production data.</p>
          </div>
          <nav className="hidden sm:flex gap-3 text-xs font-sans">
            {([['checklist', '/admin/launch-checklist'], ['dashboard', '/admin/dashboard'], ['health', '/admin/health']] as [string, string][]).map(([l, h]) => (
              <a key={l} href={h} className="text-text-muted hover:text-text-primary transition-colors capitalize">{l}</a>
            ))}
          </nav>
        </div>
        <PreflightClient />
      </div>
    </main>
  )
}
