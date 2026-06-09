import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { completeOnboarding } from '../actions'

export default async function OnboardingDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member) redirect('/login')

  const { data: docs } = await supabase
    .from('clinic_documents')
    .select('id, file_name, document_type, uploaded_at')
    .eq('clinic_id', member.clinic_id)
    .order('uploaded_at', { ascending: false })

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-4xl text-text-primary">Upload documents</h1>
          <p className="font-sans text-sm text-text-muted">
            Optional — care plan templates, philosophy docs, and patient letters help your AI speak in your exact voice.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface/50 p-6 space-y-4">
          {docs && docs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">
                {docs.length} document{docs.length !== 1 ? 's' : ''} uploaded
              </p>
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-xs font-mono text-magenta/70 bg-magenta/10 px-1.5 py-0.5 rounded">
                    {d.document_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-sans text-text-primary truncate">{d.file_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-sans text-text-muted text-center py-4">
              No documents yet. You can add them anytime from Settings.
            </p>
          )}

          <p className="text-xs font-sans text-text-muted/70">
            Documents can be uploaded at any time from{' '}
            <a href="/settings/documents" className="underline underline-offset-2">Settings &rarr; Documents</a>.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <a href="/onboarding/conversation"
            className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            &larr; Back to conversation
          </a>
          <form action={completeOnboarding}>
            <button type="submit"
              className="rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90">
              Finish setup &rarr;
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
