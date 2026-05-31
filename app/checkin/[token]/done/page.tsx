import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

function signalColor(s: number) {
  if (s >= 80) return 'text-signal-green'
  if (s >= 55) return 'text-amber'
  return 'text-danger'
}

function zoneLabel(s: number) {
  if (s >= 80) return 'Recovering strong'
  if (s >= 55) return 'Hanging in there'
  return 'Tough day'
}

function zoneParagraph(s: number, clinicName: string) {
  if (s >= 80) {
    return "You're recovering strong. Consistency like this is what builds lasting results — keep showing up the way you have been."
  }
  if (s >= 55) {
    return `You're hanging in there. Every check-in gives ${clinicName} a clearer picture of how you're doing between visits. Tomorrow is another data point.`
  }
  return `Tough day. ${clinicName} can see this — they'll reach out if anything needs attention. Rest up tonight, and we'll check in again tomorrow.`
}

export default async function CheckinDonePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const service = createServiceClient()

  const { data: tokenRow } = await service
    .from('patient_checkin_tokens')
    .select('patient_id, clinic_id')
    .eq('token', token)
    .single()

  if (!tokenRow) notFound()

  const [{ data: patient }, { data: clinic }, { data: hist }] = await Promise.all([
    service.from('patients').select('first_name').eq('id', tokenRow.patient_id).single(),
    service.from('clinics').select('clinic_name').eq('id', tokenRow.clinic_id).single(),
    service
      .from('pura_index_history')
      .select('pura_signal')
      .eq('patient_id', tokenRow.patient_id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  if (!patient || !clinic) notFound()

  const signal = hist?.pura_signal ?? null

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-surface/30 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-sm w-full space-y-8">

        {/* Confirmation mark */}
        <div className="text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-magenta/10 border border-magenta/30">
            <span className="text-2xl text-magenta font-serif">✓</span>
          </span>
        </div>

        {/* Heading */}
        <div className="text-center space-y-1">
          <h1 className="font-serif text-4xl text-text-primary">
            {"You're done, "}{patient.first_name}.
          </h1>
          <p className="font-sans text-sm text-text-muted">Your check-in is in.</p>
        </div>

        {/* Signal score */}
        {signal !== null && (
          <div className="text-center space-y-2">
            <p className={`font-serif text-8xl leading-none tabular-nums ${signalColor(signal)}`}>
              {signal}
            </p>
            <p className="font-mono text-xs text-text-muted uppercase tracking-widest">PURA Signal</p>
            <p className={`font-sans text-sm font-medium ${signalColor(signal)}`}>
              {zoneLabel(signal)}
            </p>
            <p className="font-sans text-sm text-text-muted leading-relaxed pt-1 max-w-xs mx-auto">
              {zoneParagraph(signal, clinic.clinic_name)}
            </p>
          </div>
        )}

        {/* "What this means" expandable — native <details>, no JS needed */}
        <details className="rounded-md border border-border overflow-hidden group">
          <summary className="flex items-center justify-between px-4 py-3 text-sm font-sans text-text-muted cursor-pointer hover:text-text-primary transition-colors list-none">
            <span>What this means</span>
            <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="px-4 pb-4 pt-2 text-sm font-sans text-text-muted leading-relaxed border-t border-border">
            Your signal is a daily snapshot of seven things: pain, sleep quality, sleep hours, energy, stress,
            function, and mood. Tracking it daily lets your doctor see how you&apos;re really doing between
            visits — and step in when something needs attention.
          </div>
        </details>

        {/* Footer */}
        <p className="text-center font-sans text-xs text-text-muted/50 pt-2">See you tomorrow.</p>

      </div>
    </main>
  )
}
