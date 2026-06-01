import { signOut } from '@/app/login/actions'

type Props = {
  clinicName: string
  dateLabel: string
  practiceSignal: number | null
  practiceSignalDelta: number | null
  checkinsToday: number
  totalActive: number
  needsAttentionCount: number
  userEmail: string
  userRole: 'owner' | 'clinician' | 'assistant'
}

function signalTextColor(s: number) {
  if (s >= 80) return 'text-signal-green'
  if (s >= 55) return 'text-amber'
  return 'text-danger'
}

export default function TopStrip({
  clinicName, dateLabel,
  practiceSignal, practiceSignalDelta,
  checkinsToday, totalActive, needsAttentionCount,
  userEmail, userRole,
}: Props) {
  const deltaSign  = (practiceSignalDelta ?? 0) >= 0 ? '+' : ''
  const deltaArrow = (practiceSignalDelta ?? 0) >= 0 ? '↑' : '↓'
  const deltaColor = (practiceSignalDelta ?? 0) >= 0 ? 'text-signal-green' : 'text-danger'

  return (
    <div className="flex items-center justify-between gap-6 border-b border-border pb-6">
      {/* Left: clinic name + user identity */}
      <div className="min-w-0">
        <h1 className="font-serif text-4xl text-text-primary truncate">{clinicName}</h1>
        <p className="mt-1 font-sans text-sm text-text-muted">{dateLabel}</p>
        <p className="mt-0.5 font-sans text-xs text-text-muted/60">
          {userEmail} · <span className="capitalize">{userRole}</span>
        </p>
      </div>

      {/* Right: stat tiles + nav + sign-out */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Practice Signal */}
        <div className="rounded-lg border border-border bg-surface px-5 py-3 text-center min-w-[130px]">
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Practice Signal</p>
          <p className={`font-serif text-4xl leading-none mt-1 ${practiceSignal !== null ? signalTextColor(practiceSignal) : 'text-text-muted'}`}>
            {practiceSignal !== null ? practiceSignal : '—'}
          </p>
          {practiceSignalDelta !== null ? (
            <p className={`font-mono text-[11px] mt-1 ${deltaColor}`}>
              {deltaArrow} {deltaSign}{practiceSignalDelta} vs yesterday
            </p>
          ) : (
            <p className="font-mono text-[11px] mt-1 text-text-muted">no baseline yet</p>
          )}
        </div>

        {/* Check-ins today */}
        <div className="rounded-lg border border-border bg-surface px-5 py-3 text-center min-w-[130px]">
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Check-ins Today</p>
          <p className="font-serif text-4xl leading-none mt-1 text-text-primary">
            {checkinsToday}
            <span className="font-sans text-lg text-text-muted">/{totalActive}</span>
          </p>
          <p className="font-mono text-[11px] mt-1 text-text-muted">
            {checkinsToday} submitted · {Math.max(0, totalActive - checkinsToday)} pending
          </p>
        </div>

        {/* Needs attention */}
        <div className={`rounded-lg border px-5 py-3 text-center min-w-[130px] ${needsAttentionCount > 0 ? 'border-magenta/30 bg-magenta/5' : 'border-border bg-surface'}`}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Needs Attention</p>
          <p className={`font-serif text-4xl leading-none mt-1 ${needsAttentionCount > 0 ? 'text-magenta' : 'text-text-muted'}`}>
            {needsAttentionCount}
          </p>
          {needsAttentionCount > 0 ? (
            <a href="?filter=attention" className="font-sans text-[11px] mt-1 text-magenta hover:underline inline-block">
              Review now →
            </a>
          ) : (
            <p className="font-mono text-[11px] mt-1 text-text-muted">all clear</p>
          )}
        </div>

        {/* Team link — owner only */}
        {userRole === 'owner' && (
          <a
            href="/team"
            className="rounded-md border border-border px-3 py-2 text-xs font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors"
          >
            Team
          </a>
        )}

        {/* Sign out */}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-xs font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
