import { createServiceClient } from '@/lib/supabase/server'
import { CheckinForm } from '@/app/checkin/[token]/_components/CheckinForm'

function ErrorScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="font-serif text-4xl text-text-primary">PURA</h1>
        <p className="font-sans text-sm text-text-muted">{children}</p>
      </div>
    </main>
  )
}

function signalColor(signal: number) {
  if (signal >= 80) return 'text-signal-green'
  if (signal >= 55) return 'text-amber'
  return 'text-danger'
}

export default async function ShortCheckinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const service = createServiceClient()

  const { data: tokenRow } = await service
    .from('patient_checkin_tokens')
    .select('token, patient_id, clinic_id, expires_at, used_at')
    .eq('short_code', code)
    .single()

  if (!tokenRow) {
    return (
      <ErrorScreen>
        This check-in link is invalid. Please contact your clinic for a new one.
      </ErrorScreen>
    )
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <ErrorScreen>
        This check-in link expired. A fresh one will arrive tomorrow morning.
      </ErrorScreen>
    )
  }

  if (tokenRow.used_at) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: checkin } = await service
      .from('daily_checkins')
      .select('id')
      .eq('patient_id', tokenRow.patient_id)
      .eq('checkin_date', today)
      .limit(1)
      .single()

    let signal: number | null = null
    if (checkin) {
      const { data: hist } = await service
        .from('pura_index_history')
        .select('pura_signal')
        .eq('patient_id', tokenRow.patient_id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single()
      signal = hist?.pura_signal ?? null
    }

    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <h1 className="font-serif text-4xl text-text-primary">PURA</h1>
          <p className="font-sans text-sm text-text-muted">
            {"You've already submitted today's check-in. See you tomorrow!"}
          </p>
          {signal !== null && (
            <div className="space-y-1">
              <p className={`font-serif text-6xl ${signalColor(signal)}`}>{signal}</p>
              <p className="text-xs font-sans text-text-muted">today's signal</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  const [{ data: patient }, { data: clinic }] = await Promise.all([
    service.from('patients').select('first_name').eq('id', tokenRow.patient_id).single(),
    service.from('clinics').select('clinic_name').eq('id', tokenRow.clinic_id).single(),
  ])

  if (!patient || !clinic) {
    return (
      <ErrorScreen>
        This check-in link is invalid. Please contact your clinic for a new one.
      </ErrorScreen>
    )
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-surface/30 px-5 py-10">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-text-primary">
            Hi {patient.first_name}
          </h1>
          <p className="font-sans text-sm text-text-muted/70 font-medium tracking-wide">
            Daily check-in &middot; {clinic.clinic_name}
          </p>
          <p className="font-sans text-xs text-text-muted/50 pt-0.5">{today}</p>
        </div>

        <CheckinForm token={tokenRow.token} patientFirstName={patient.first_name} />
      </div>
    </main>
  )
}
