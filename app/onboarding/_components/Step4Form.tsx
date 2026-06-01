import { saveClinicProfile } from '../actions'

const label       = 'block text-xs font-sans font-medium text-text-muted uppercase tracking-widest'
const hint        = 'text-xs font-sans text-text-muted/70 mt-0.5'
const textarea    = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta resize-none'
const primaryBtn  = 'rounded-md bg-magenta px-6 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90'
const secondaryBtn = 'rounded-md border border-border px-6 py-2.5 text-sm font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors'
const skipBtn     = 'text-xs font-sans text-text-muted underline underline-offset-2 hover:text-text-primary transition-colors'

const FIELDS = [
  {
    name: 'practice_type',
    label: 'What kind of practice is this?',
    hint: 'e.g. "General chiropractic, cash-pay" or "Sports injury, high-volume insurance"',
    rows: 2,
  },
  {
    name: 'patient_demographics',
    label: 'Who are your typical patients?',
    hint: 'e.g. "Working adults 30–60 with lower back pain" or "Athletes and weekend warriors"',
    rows: 2,
  },
  {
    name: 'typical_visit_frequency',
    label: 'How often do patients typically come in?',
    hint: 'e.g. "3x/week for 4 weeks, then monthly maintenance"',
    rows: 2,
  },
  {
    name: 'typical_care_plan_structure',
    label: 'How do you structure care plans?',
    hint: 'e.g. "12-week plans with a re-exam at week 6. Discharge when pain-free for 2 visits."',
    rows: 2,
  },
  {
    name: 'what_successful_recovery_looks_like',
    label: 'What does a successful recovery look like?',
    hint: 'e.g. "Patient reports 80%+ pain reduction, returns to normal activity, stable signal for 2 weeks"',
    rows: 2,
  },
  {
    name: 'what_makes_a_good_outcome',
    label: 'How do you define a good outcome?',
    hint: 'e.g. "Patient completes care plan, avoids surgery, resumes sport or work without restriction"',
    rows: 2,
  },
  {
    name: 'red_flags',
    label: 'What are your red flags — signals that a patient needs immediate attention?',
    hint: 'e.g. "Signal drops >20 points in a week, 3+ days without check-in during active plan, sudden spike in pain rating"',
    rows: 2,
  },
  {
    name: 'practice_philosophy',
    label: 'What is your practice philosophy or care approach?',
    hint: 'e.g. "Whole-body wellness, not just pain relief. We treat the cause, not the symptom."',
    rows: 2,
  },
  {
    name: 'communication_style',
    label: 'How do you communicate with patients?',
    hint: 'e.g. "Warm and personal — we know every patient by first name and celebrate their wins"',
    rows: 2,
  },
  {
    name: 'communication_style_notes',
    label: 'Anything else about how you like to communicate?',
    hint: 'e.g. "Never use clinical jargon in texts. Keep it conversational and encouraging."',
    rows: 2,
  },
] as const

export function Step4Form() {
  return (
    <form action={saveClinicProfile} className="space-y-6">
      <div className="space-y-1">
        <p className="font-sans text-sm text-text-primary font-medium">
          Tell PURA about your practice
        </p>
        <p className="font-sans text-xs text-text-muted">
          This helps PURA write better morning briefings and message drafts — tailored to how your clinic actually works.
          Every field is optional; skip any that don't apply.
        </p>
      </div>

      {FIELDS.map(f => (
        <div key={f.name} className="space-y-1.5">
          <label htmlFor={f.name} className={label}>{f.label}</label>
          <textarea
            id={f.name}
            name={f.name}
            rows={f.rows}
            placeholder=""
            className={textarea}
          />
          <p className={hint}>{f.hint}</p>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <a href="/onboarding?step=3" className={secondaryBtn}>← Back</a>
        <div className="flex items-center gap-4">
          <button type="submit" name="_skip" value="1" className={skipBtn}>
            Skip for now
          </button>
          <button type="submit" name="_skip" value="0" className={primaryBtn}>
            Finish setup →
          </button>
        </div>
      </div>
    </form>
  )
}
