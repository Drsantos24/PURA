import { finishOnboarding } from '../actions'

const TONES = [
  { value: 'encouraging', label: 'Encouraging' },
  { value: 'clinical',    label: 'Clinical' },
  { value: 'friendly',    label: 'Friendly' },
  { value: 'formal',      label: 'Formal' },
]

type Settings = {
  checkin_send_time: string | null
  auto_send_enabled: boolean | null
  message_tone: string | null
  alert_threshold: number | null
}

export function Step3Form({
  settings,
  imported,
  skipped,
}: {
  settings: Settings | null
  imported?: number
  skipped?: number
}) {
  const sendTime       = (settings?.checkin_send_time ?? '06:00:00').slice(0, 5)
  const autoSend       = settings?.auto_send_enabled ?? true
  const currentTone    = settings?.message_tone === 'professional'
    ? 'encouraging'   // migrate old default
    : (settings?.message_tone ?? 'encouraging')
  const threshold      = settings?.alert_threshold ?? 15

  return (
    <form action={finishOnboarding} className="space-y-6">
      {(imported !== undefined) && (
        <p className="rounded-md bg-signal-green/10 px-4 py-3 text-sm font-sans text-signal-green">
          ✓ {imported} patient{imported !== 1 ? 's' : ''} imported
          {skipped ? `, ${skipped} skipped (missing contact info)` : ''}.
        </p>
      )}

      {/* Send time */}
      <div className="space-y-1.5">
        <label className={label}>Check-in send time</label>
        <input
          name="send_time"
          type="time"
          required
          defaultValue={sendTime}
          className={input}
        />
        <p className="text-xs font-sans text-text-muted">
          Check-ins go out to all active patients at this time each morning.
        </p>
      </div>

      {/* Auto-send toggle */}
      <div className="flex items-start gap-3 rounded-md border border-border px-4 py-3">
        <input
          id="auto_send"
          name="auto_send"
          type="checkbox"
          defaultChecked={autoSend}
          className="mt-0.5 h-4 w-4 rounded border-border accent-magenta cursor-pointer"
        />
        <div>
          <label htmlFor="auto_send" className="block text-sm font-sans text-text-primary cursor-pointer">
            Send check-ins automatically every day
          </label>
          <p className="text-xs font-sans text-text-muted mt-0.5">
            You can pause or override this at any time from your dashboard.
          </p>
        </div>
      </div>

      {/* Message tone */}
      <div className="space-y-1.5">
        <label className={label}>AI message tone</label>
        <select name="message_tone" className={input}>
          {TONES.map(t => (
            <option key={t.value} value={t.value} selected={t.value === currentTone}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs font-sans text-text-muted">
          Sets the voice of AI-drafted check-in messages and alerts.
        </p>
      </div>

      {/* Alert threshold */}
      <div className="space-y-1.5">
        <label className={label}>
          Alert threshold{' '}
          <span className="normal-case font-normal text-text-muted/60">(points, 5 – 30)</span>
        </label>
        <input
          name="alert_threshold"
          type="number"
          min={5}
          max={30}
          required
          defaultValue={threshold}
          className={input}
        />
        <p className="text-xs font-sans text-text-muted">
          Fire an alert when a patient's PURA Signal drops this many points below their baseline.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <a href="/onboarding?step=2" className={secondaryBtn}>← Back</a>
        <button type="submit" className={primaryBtn}>
          Finish setup →
        </button>
      </div>
    </form>
  )
}

const label      = 'block text-xs font-sans font-medium text-text-muted uppercase tracking-widest'
const input      = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
const primaryBtn = 'rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90'
const secondaryBtn='rounded-md border border-border px-6 py-2.5 text-sm font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors'
