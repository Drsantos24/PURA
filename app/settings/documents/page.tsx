import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentsManager } from './_components/DocumentsManager'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')
  if (member.role !== 'owner') redirect('/settings')

  const { data: docs } = await supabase
    .from('clinic_documents')
    .select('id, document_type, file_name, summary, char_count, uploaded_at')
    .eq('clinic_id', member.clinic_id)
    .order('uploaded_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-sans text-base font-medium text-text-primary">Clinic Documents</h2>
        <p className="font-sans text-xs text-text-muted">
          Upload care plan templates, philosophy docs, and patient letters.
          PURA reads these to make briefings and messages sound specifically like your clinic.
        </p>
      </div>
      <DocumentsManager initialDocs={docs ?? []} />
    </div>
  )
}
