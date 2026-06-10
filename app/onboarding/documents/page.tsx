import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { completeOnboarding } from '../actions'

const DOC_TYPES = [
  { icon: '📋', label: 'Care plan templates', why: 'Shows PURA your treatment language and structure' },
  { icon: '💬', label: 'Patient intake forms', why: 'Teaches the questions you consider important' },
  { icon: '✉️', label: 'Patient welcome letters', why: 'Trains your exact voice and tone' },
  { icon: '📄', label: 'Practice philosophy docs', why: 'Grounds the AI in what your clinic stands for' },
]

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

  const hasUploads = docs && docs.length > 0

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="w-2 h-2 rounded-full bg-magenta mx-auto" />
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-text-muted">PURA Health</p>
          <h1 className="font-serif text-2xl text-text-primary">Feed your AI</h1>
          <p className="font-sans text-sm text-text-muted max-w-sm mx-auto">
            Your documents teach PURA to write in your voice — not in generic AI-speak.
            The more context, the more it sounds like you.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface/50 p-6 space-y-5">
          {/* What to upload */}
          {!hasUploads && (
            <div className="space-y-3">
              <p className="font-sans text-xs uppercase tracking-widest text-text-muted font-medium">
                What works well
              </p>
              <div className="space-y-2">
                {DOC_TYPES.map(d => (
                  <div key={d.label} className="flex items-start gap-3 py-1.5">
                    <span className="text-base leading-none mt-0.5">{d.icon}</span>
                    <div>
                      <p className="font-sans text-sm text-text-primary">{d.label}</p>
                      <p className="font-sans text-xs text-text-muted">{d.why}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="font-sans text-xs text-text-muted/70 pt-1 border-t border-border/40">
                Upload from{' '}
                <a href="/settings/documents" className="underline underline-offset-2">Settings &rarr; Documents</a>
                {' '}— PDFs, Word docs, and plain text all work.
                You can add more any time after setup.
              </p>
            </div>
          )}

          {/* Uploaded docs */}
          {hasUploads && (
            <div className="space-y-2">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">
                {docs.length} document{docs.length !== 1 ? 's' : ''} feeding your AI
              </p>
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-xs font-mono text-magenta/70 bg-magenta/10 px-1.5 py-0.5 rounded">
                    {d.document_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-sans text-text-primary truncate">{d.file_name}</span>
                </div>
              ))}
              <p className="font-sans text-xs text-text-muted/70 pt-1">
                Add more any time from{' '}
                <a href="/settings/documents" className="underline underline-offset-2">Settings &rarr; Documents</a>.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <a href="/onboarding/conversation"
            className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">
            &larr; Back
          </a>
          <form action={completeOnboarding}>
            <button type="submit"
              className="rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90">
              {hasUploads ? 'Finish setup →' : 'Continue without docs →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
