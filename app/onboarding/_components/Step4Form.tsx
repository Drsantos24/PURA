'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '../actions'

const label      = 'block text-xs font-sans font-medium text-text-muted uppercase tracking-widest'
const hint       = 'text-xs font-sans text-text-muted/70 mt-0.5'
const textarea   = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta resize-none'
const inputCls   = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
const primaryBtn = 'rounded-md bg-magenta px-5 py-2 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'
const ghostBtn   = 'rounded-md border border-border px-5 py-2 text-sm font-sans text-text-muted hover:border-text-muted hover:text-text-primary transition-colors'

type SectionKey = 'practice_identity' | 'patient_journey' | 'clinical_vocabulary' | 'decision_thresholds' | 'outcomes_measured'
type CompletedSections = Partial<Record<SectionKey, boolean>>

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  { key: 'practice_identity',   title: 'Practice Identity',   description: 'Who you are and why you practice.' },
  { key: 'patient_journey',     title: 'Patient Journey',     description: 'How patients move through care with you.' },
  { key: 'clinical_vocabulary', title: 'Clinical Vocabulary', description: "The words that define your clinic's voice." },
  { key: 'decision_thresholds', title: 'Decision Thresholds', description: 'When does a patient need immediate attention?' },
  { key: 'outcomes_measured',   title: 'Outcomes Measured',   description: 'What does success look like in numbers?' },
]

export function Step4Form() {
  const router = useRouter()
  const [active, setActive]       = useState<SectionKey>('practice_identity')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState<SectionKey | null>(null)
  const [completed, setCompleted] = useState<CompletedSections>({})
  const [finishing, setFinishing] = useState(false)

  const pct = Math.round(
    (Object.values(completed).filter(Boolean).length / SECTIONS.length) * 100
  )

  async function saveSection(section: SectionKey, data: Record<string, unknown>) {
    setSaving(true)
    try {
      const res  = await fetch('/api/clinic-intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, ...data }),
      })
      const json = await res.json()
      if (json.completedSections) setCompleted(json.completedSections)
      setSaved(section)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  const sectionDone = (k: SectionKey) => completed[k] === true

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="font-sans text-sm text-text-primary font-medium">Train your clinic AI</p>
        <p className="font-sans text-xs text-text-muted">
          Each section you complete makes PURA more specific to your practice.
          Save any section independently — none are required to finish setup.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-sans text-text-muted">AI training progress</span>
          <span className="text-xs font-mono text-magenta font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-magenta rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {pct < 60 && (
          <p className="text-xs font-sans text-text-muted/70">
            Complete more sections for better briefings and message drafts.
          </p>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <button key={s.key} type="button" onClick={() => setActive(s.key)}
            className={[
              'px-3 py-1.5 rounded-md text-xs font-sans transition-colors',
              active === s.key ? 'bg-magenta/15 text-magenta border border-magenta/30' : 'border border-border text-text-muted hover:border-text-muted/50',
            ].join(' ')}>
            {sectionDone(s.key) && <span className="mr-1 text-signal-green">✓</span>}
            {s.title}
          </button>
        ))}
      </div>

      {/* Active section */}
      <div className="rounded-md border border-border/60 bg-surface/30 p-4">
        <p className="text-xs font-sans text-text-muted mb-4">
          {SECTIONS.find(s => s.key === active)?.description}
        </p>
        {active === 'practice_identity'   && <PracticeIdentitySection   saving={saving} onSave={d => saveSection('practice_identity',   d)} saved={saved === 'practice_identity'}   />}
        {active === 'patient_journey'     && <PatientJourneySection     saving={saving} onSave={d => saveSection('patient_journey',     d)} saved={saved === 'patient_journey'}     />}
        {active === 'clinical_vocabulary' && <ClinicalVocabSection      saving={saving} onSave={d => saveSection('clinical_vocabulary', d)} saved={saved === 'clinical_vocabulary'} />}
        {active === 'decision_thresholds' && <DecisionThresholdsSection saving={saving} onSave={d => saveSection('decision_thresholds', d)} saved={saved === 'decision_thresholds'} />}
        {active === 'outcomes_measured'   && <OutcomesMeasuredSection   saving={saving} onSave={d => saveSection('outcomes_measured',   d)} saved={saved === 'outcomes_measured'}   />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <a href="/onboarding?step=3" className={ghostBtn}>← Back</a>
        <div className="flex items-center gap-3">
          {pct > 0 && pct < 100 && (
            <span className="text-xs font-sans text-text-muted/70">Your AI is {pct}% trained</span>
          )}
          <form action={completeOnboarding}>
            <button type="submit" disabled={finishing} className={primaryBtn}>
              {pct === 0 ? 'Skip for now →' : 'Finish setup →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function SaveButton({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button type="submit" disabled={saving} className={primaryBtn}>
      {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save section'}
    </button>
  )
}

function PracticeIdentitySection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSave(Object.fromEntries(fd)) }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>What kind of practice is this?</label>
        <input name="practice_type" type="text" className={inputCls} placeholder="e.g. General chiropractic, cash-pay" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Your origin story</label>
        <textarea name="practice_origin_story" rows={3} className={textarea} placeholder="Why did you start this practice? What do patients hear that makes them stay?" />
        <p className={hint}>Shapes AI tone and mission alignment</p>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Practice philosophy</label>
        <textarea name="practice_philosophy" rows={2} className={textarea} placeholder="e.g. Whole-body wellness — we treat the cause, not the symptom" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Who are your typical patients?</label>
        <textarea name="patient_demographics" rows={2} className={textarea} placeholder="e.g. Working adults 30–60 with lower back pain" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>How often do patients typically come in?</label>
        <input name="typical_visit_frequency" type="text" className={inputCls} placeholder="e.g. 3×/week for 4 weeks, then monthly maintenance" />
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function PatientJourneySection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSave(Object.fromEntries(fd)) }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>Describe the typical patient journey</label>
        <textarea name="typical_patient_journey" rows={4} className={textarea} placeholder="From first contact to discharge — what does the journey look like?" />
        <p className={hint}>AI references this when suggesting patient actions</p>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Care plan structure</label>
        <textarea name="typical_care_plan_structure" rows={3} className={textarea} placeholder="e.g. 12-week plan: acute (wks 1–4, 3×/wk), subacute (wks 5–8, 2×/wk), maintenance (wks 9–12, 1×/wk)" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>What does successful recovery look like?</label>
        <textarea name="what_successful_recovery_looks_like" rows={2} className={textarea} placeholder="e.g. 80%+ pain reduction, resumes normal activities, stable signal 2 weeks" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>How do you define a good outcome?</label>
        <textarea name="what_makes_a_good_outcome" rows={2} className={textarea} placeholder="e.g. Completes care plan, avoids surgery, returns to work or sport" />
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function ClinicalVocabSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd        = new FormData(e.currentTarget)
      const preferred = (fd.get('preferred_terms')   as string).split(',').map(s => s.trim()).filter(Boolean)
      const banned    = (fd.get('banned_words')       as string).split(',').map(s => s.trim()).filter(Boolean)
      const signature = (fd.get('signature_phrases')  as string).split('\n').map(s => s.trim()).filter(Boolean)
      onSave({
        communication_style:       fd.get('communication_style'),
        communication_style_notes: fd.get('communication_style_notes'),
        what_you_wish_other_chiropractors_knew: fd.get('what_you_wish_other_chiropractors_knew'),
        clinic_vocabulary: { preferred_terms: preferred, banned_words: banned, signature_phrases: signature },
      })
    }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>Communication style</label>
        <input name="communication_style" type="text" className={inputCls} placeholder="e.g. Warm and personal — we know every patient by first name" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Style rules and banned words</label>
        <textarea name="communication_style_notes" rows={2} className={textarea} placeholder={'e.g. Never use "compliance" — say "staying consistent with care" instead'} />
        <p className={hint}>The AI enforces these in every message it writes</p>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Preferred terms (comma-separated)</label>
        <input name="preferred_terms" type="text" className={inputCls} placeholder="e.g. care partner, recovery journey, whole-person wellness" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Banned words (comma-separated)</label>
        <input name="banned_words" type="text" className={inputCls} placeholder="e.g. compliance, pain management, treatment failure" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Signature phrases (one per line)</label>
        <textarea name="signature_phrases" rows={3} className={textarea} placeholder={"We're in your corner\nSmall wins lead to big recoveries\nYour body knows how to heal"} />
      </div>
      <div className="space-y-1.5">
        <label className={label}>What do you wish other chiropractors knew?</label>
        <textarea name="what_you_wish_other_chiropractors_knew" rows={3} className={textarea} placeholder="Beliefs and approaches that set you apart" />
        <p className={hint}>Shapes the philosophical framing of AI suggestions</p>
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function DecisionThresholdsSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd   = new FormData(e.currentTarget)
      const call = parseInt(fd.get('call_threshold')     as string, 10)
      const text = parseInt(fd.get('text_threshold')     as string, 10)
      const days = parseInt(fd.get('silent_days_urgent') as string, 10)
      const drop = parseInt(fd.get('signal_drop_urgent') as string, 10)
      onSave({
        red_flags: fd.get('red_flags'),
        decision_thresholds: {
          call_threshold:     isNaN(call) ? 50 : call,
          text_threshold:     isNaN(text) ? 60 : text,
          silent_days_urgent: isNaN(days) ? 3  : days,
          signal_drop_urgent: isNaN(drop) ? 20 : drop,
        },
      })
    }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>Red flags — when does a patient need immediate attention?</label>
        <textarea name="red_flags" rows={3} className={textarea} placeholder="e.g. Signal drops 20+ pts in a week, 3+ days without check-in during active plan, pain spike to 8+" />
        <p className={hint}>AI uses these — not generic heuristics</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={label}>Call threshold (score)</label>
          <input name="call_threshold" type="number" min="0" max="100" defaultValue="50" className={inputCls} />
          <p className={hint}>Below this → AI recommends a call</p>
        </div>
        <div className="space-y-1.5">
          <label className={label}>Text threshold (score)</label>
          <input name="text_threshold" type="number" min="0" max="100" defaultValue="60" className={inputCls} />
          <p className={hint}>Below this → AI recommends a text</p>
        </div>
        <div className="space-y-1.5">
          <label className={label}>Silent days = urgent</label>
          <input name="silent_days_urgent" type="number" min="1" max="14" defaultValue="3" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={label}>Signal drop = urgent (pts)</label>
          <input name="signal_drop_urgent" type="number" min="5" max="50" defaultValue="20" className={inputCls} />
        </div>
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function OutcomesMeasuredSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd           = new FormData(e.currentTarget)
      const topComplaints = (fd.get('top_complaints') as string).split(',').map(s => s.trim()).filter(Boolean)
      const avgVisits    = parseInt(fd.get('avg_visits_to_discharge')  as string, 10)
      const satisfaction = parseInt(fd.get('patient_satisfaction_pct') as string, 10)
      onSave({
        common_outcomes_data: {
          avg_visits_to_discharge:  isNaN(avgVisits)    ? null : avgVisits,
          patient_satisfaction_pct: isNaN(satisfaction) ? null : satisfaction,
          top_complaints:           topComplaints,
        },
      })
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={label}>Avg visits to discharge</label>
          <input name="avg_visits_to_discharge" type="number" min="1" max="100" className={inputCls} placeholder="e.g. 10" />
        </div>
        <div className="space-y-1.5">
          <label className={label}>Patient satisfaction %</label>
          <input name="patient_satisfaction_pct" type="number" min="0" max="100" className={inputCls} placeholder="e.g. 92" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Top complaints treated (comma-separated)</label>
        <input name="top_complaints" type="text" className={inputCls} placeholder="e.g. lower back pain, neck pain, headaches" />
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}
