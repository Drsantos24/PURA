import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { LaunchChecklistClient } from './_components/LaunchChecklistClient'
import { BaaTracker } from './_components/BaaTracker'

const CHECKLIST_ITEMS = [
  { id: 'anthropic_credits',    category: 'finance',     label: 'Anthropic credits ≥ $50',                         auto: false },
  { id: 'openai_credits',       category: 'finance',     label: 'OpenAI credits ≥ $20',                            auto: false },
  { id: 'twilio_a2p',           category: 'ops',         label: 'Twilio A2P 10DLC registered and approved',        auto: false },
  { id: 'supabase_pitr',        category: 'infra',       label: 'PITR enabled on Supabase Pro',                    auto: false },
  { id: 'baa_anthropic',        category: 'legal',       label: 'BAA signed with Anthropic',                       auto: false },
  { id: 'baa_openai',           category: 'legal',       label: 'BAA signed with OpenAI',                          auto: false },
  { id: 'baa_supabase',         category: 'legal',       label: 'BAA signed with Supabase',                        auto: false },
  { id: 'baa_vercel',           category: 'legal',       label: 'BAA signed with Vercel',                          auto: false },
  { id: 'baa_twilio',           category: 'legal',       label: 'BAA signed with Twilio',                          auto: false },
  { id: 'trademark_pura',       category: 'legal',       label: 'Trademark filed — PURA',                          auto: false },
  { id: 'trademark_signal',     category: 'legal',       label: 'Trademark filed — PURA Signal',                   auto: false },
  { id: 'terms_live',           category: 'legal',       label: 'Terms of Service live at /legal/terms',           auto: false },
  { id: 'privacy_live',         category: 'legal',       label: 'Privacy Policy live at /legal/privacy',           auto: false },
  { id: 'pat_rotated',          category: 'security',    label: 'GitHub PAT rotated (used across sessions)',        auto: false },
  { id: 'beta_invites',         category: 'launch',      label: 'All 6 beta clinic invites drafted and sent',      auto: false },
  { id: 'admin_tested',         category: 'launch',      label: 'Founder admin view tested with live data',        auto: false },
  { id: 'e2e_onboarding',       category: 'launch',      label: 'Full end-to-end onboarding test on clean account', auto: false },
  { id: 'cron_verified',        category: 'launch',      label: 'Morning cron firing daily on all clinics',        auto: false },
  { id: 'sms_verified',         category: 'launch',      label: 'SMS delivery verified on at least one clinic',    auto: false },
  { id: 'approval_workflow',    category: 'launch',      label: 'Approval workflow tested with real clinician',    auto: false },
]

export default async function LaunchChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!user || !founderEmail || user.email !== founderEmail) notFound()

  const service = createServiceClient()
  const [{ data }, { data: baaData }] = await Promise.all([
    service.from('founder_config').select('value').eq('key', 'launch_checklist').maybeSingle(),
    service.from('founder_config').select('value').eq('key', 'baa_tracker').maybeSingle(),
  ])
  const saved    = (data?.value    ?? {}) as Record<string, boolean>
  const baaState = (baaData?.value ?? {}) as Record<string, { requested: string; signed: string }>

  return (
    <main className="min-h-screen bg-background px-8 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-text-primary">Beta Launch Checklist</h1>
            <p className="font-sans text-xs text-text-muted mt-1">Founder-only. Mark items as you complete them.</p>
          </div>
          <nav className="flex gap-3 text-xs font-sans">
            {[['dashboard','/admin/dashboard'],['health','/admin/health'],['invites','/admin/invites']].map(([l,h]) => (
              <a key={l} href={h} className="text-text-muted hover:text-text-primary transition-colors capitalize">{l}</a>
            ))}
          </nav>
        </div>
        <BaaTracker initialData={baaState} />
        <LaunchChecklistClient items={CHECKLIST_ITEMS} initialState={saved} />
      </div>
    </main>
  )
}
