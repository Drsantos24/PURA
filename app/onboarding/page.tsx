import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Stepper }   from './_components/Stepper'
import { Step1Form } from './_components/Step1Form'
import { Step2Form } from './_components/Step2Form'
import { Step3Form } from './_components/Step3Form'
import { Step4Form } from './_components/Step4Form'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    step?: string
    error?: string
    imported?: string
    skipped?: string
  }>
}) {
  const params = await searchParams
  const step = Math.min(4, Math.max(1, parseInt(params.step ?? '1', 10)))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('*, clinic_settings(*)')
    .eq('owner_email', user.email!)
    .single()

  if (!clinic) redirect('/login')
  if (clinic.onboarding_complete) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (clinic.clinic_settings as any[])?.[0] ?? null

  // For step 2: check if patients were already imported (back-button protection)
  let patientCount = 0
  if (step === 2) {
    const { count } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
    patientCount = count ?? 0
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <h1 className="font-serif text-5xl text-text-primary">PURA</h1>
          <p className="font-sans text-sm text-text-muted">Setting up your clinic</p>
        </div>

        <Stepper current={step} />

        <div className="rounded-lg border border-border bg-surface/50 p-6">
          {step === 1 && <Step1Form clinic={clinic} />}

          {step === 2 && (
            <Step2Form
              clinicId={clinic.id}
              error={params.error}
              alreadyImported={patientCount > 0}
              alreadyCount={patientCount}
            />
          )}

          {step === 3 && (
            <Step3Form
              settings={settings}
              imported={params.imported ? parseInt(params.imported, 10) : undefined}
              skipped={params.skipped  ? parseInt(params.skipped,   10) : undefined}
            />
          )}

          {step === 4 && <Step4Form />}
        </div>
      </div>
    </main>
  )
}
