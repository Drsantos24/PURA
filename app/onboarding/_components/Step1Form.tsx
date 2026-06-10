import { saveStep1 } from '../actions'

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix',     label: 'Mountain – Arizona (no DST)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic – Puerto Rico (AT)' },
]

type Clinic = {
  clinic_name: string
  location: string | null
  timezone: string
  phone?: string | null
  website?: string | null
}

export function Step1Form({ clinic }: { clinic: Clinic }) {
  const currentTz = clinic.timezone ?? 'America/Chicago'

  return (
    <form action={saveStep1} className="space-y-5">
      <p className="text-sm font-sans text-text-muted leading-relaxed">
        This is how your clinic appears to your team inside PURA.
        Your timezone is used to schedule morning check-ins at the right time for your patients.
      </p>
      <Field label="Clinic name">
        <input
          name="clinic_name"
          type="text"
          required
          defaultValue={clinic.clinic_name}
          className={input}
        />
      </Field>

      <Field label="Location (city, state)">
        <input
          name="location"
          type="text"
          placeholder="Austin, TX"
          defaultValue={clinic.location ?? ''}
          className={input}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={<>Phone <Optional /></>}>
          <input
            name="phone"
            type="tel"
            placeholder="+1 (512) 000-0000"
            defaultValue={clinic.phone ?? ''}
            className={input}
          />
        </Field>
        <Field label={<>Website <Optional /></>}>
          <input
            name="website"
            type="url"
            placeholder="https://…"
            defaultValue={clinic.website ?? ''}
            className={input}
          />
        </Field>
      </div>

      <Field label="Timezone">
        <select name="timezone" className={input}>
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value} selected={tz.value === currentTz}>
              {tz.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end pt-2">
        <button type="submit" className={primaryBtn}>Next →</button>
      </div>
    </form>
  )
}

function Optional() {
  return <span className="normal-case font-normal text-text-muted/60">(optional)</span>
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-sans font-medium text-text-muted uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  )
}

const input = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
const primaryBtn = 'rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90'
