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
type Mode = 'choose' | 'forms'

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  { key: 'practice_identity',   title: 'Practice Identity',   description: 'Who you are and why you practice.' },
  { key: 'patient_journey',     title: 'Patient Journey',     description: 'How patients move through care with you.' },
  { key: 'clinical_vocabulary', title: 'Clinical Vocabulary', description: "The words that define your clinic's voice." },
  { key: 'decision_thresholds', title: 'Decision Thresholds', description: 'When does a patient need immediate attention?' },
  { key: 'outcomes_measured',   title: 'Outcomes Measured',   description: 'What does success look like in numbers?' },
]

export function Step4Form() {
  const router = useRouter()
  const [mode, setMode]           = useState<Mode>('choose')
  const [active, setActive]       = useState<SectionKey>('practice_identity')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState<SectionKey | null>(null)
  const [completed, setCompleted] = useState<CompletedSections>({})

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

  // ── Path chooser ──────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="font-sans text-sm text-text-primary font-medium">Give your AI a voice</p>
          <p className="font-sans text-xs text-text-muted">
            This is what makes PURA sound like you — not like a generic chatbot.
            A 10-minute conversation here saves you hours of editing later.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => router.push('/onboarding/conversation')}
            className="rounded-lg border-2 border-magenta/30 bg-magenta/5 p-5 text-left space-y-1.5 hover:border-magenta/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="font-sans text-sm font-medium text-text-primary">Have a conversation</p>
              <span className="text-[10px] font-sans bg-magenta/15 text-magenta px-2 py-0.5 rounded uppercase tracking-widest">
                Recommended
              </span>
            </div>
            <p className="font-sans text-xs text-text-muted">
              10-15 minutes. The AI asks adaptive follow-up questions based on your answers.
              Produces richer context than forms.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('forms')}
            className="rounded-lg border border-border p-5 text-left space-y-1.5 hover:border-border/80 transition-colors"
          >
            <p className="font-sans text-sm font-medium text-text-primary">Fill out forms instead</p>
            <p className="font-sans text-xs text-text-muted">
              5 structured sections. Faster but less adaptive. Can be completed in any order.
            </p>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a href="/onboarding?step=3" className={ghostBtn}>← Back</a>
          <form action={completeOnboarding}>
            <button type="submit" className="text-xs font-sans text-text-muted underline underline-offset-2 hover:text-text-primary transition-colors">
              Set up AI later from Settings
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Forms path (v2 sectioned intake) ─────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMode('choose')} className="text-xs font-sans text-text-muted hover:text-text-primary">
            ← Back
          </button>
          <p className="font-sans text-sm text-text-primary font-medium">Clinic AI Profile — Forms</p>
        </div>
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
      </div>

      {/* Tabs */}
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

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => setMode('choose')} className={ghostBtn}>← Back</button>
        <div className="flex items-center gap-3">
          {pct > 0 && pct < 100 && (
            <span className="text-xs font-sans text-text-muted/70">Your AI is {pct}% trained</span>
          )}
          <form action={completeOnboarding}>
            <button type="submit" className={primaryBtn}>
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
      <div className="space-y-1.5"><label className={label}>Practice type</label><input name="practice_type" type="text" className={inputCls} placeholder="e.g. General chiropractic, cash-pay" /></div>
      <div className="space-y-1.5"><label className={label}>Origin story</label><textarea name="practice_origin_story" rows={3} className={textarea} placeholder="Why did you start this practice?" /></div>
      <div className="space-y-1.5"><label className={label}>Practice philosophy</label><textarea name="practice_philosophy" rows={2} className={textarea} placeholder="e.g. Whole-body wellness — treat the cause, not the symptom" /></div>
      <div className="space-y-1.5"><label className={label}>Typical patients</label><textarea name="patient_demographics" rows={2} className={textarea} placeholder="e.g. Working adults 30-60 with lower back pain" /></div>
      <div className="space-y-1.5"><label className={label}>Visit frequency</label><input name="typical_visit_frequency" type="text" className={inputCls} placeholder="e.g. 3x/week for 4 weeks, then monthly" /></div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function PatientJourneySection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSave(Object.fromEntries(fd)) }} className="space-y-4">
      <div className="space-y-1.5"><label className={label}>Patient journey</label><textarea name="typical_patient_journey" rows={4} className={textarea} placeholder="From first contact to discharge..." /><p className={hint}>AI references this when suggesting patient actions</p></div>
      <div className="space-y-1.5"><label className={label}>Care plan structure</label><textarea name="typical_care_plan_structure" rows={3} className={textarea} placeholder="e.g. 12-week plan: acute (wks 1-4), subacute (wks 5-8)..." /></div>
      <div className="space-y-1.5"><label className={label}>Successful recovery</label><textarea name="what_successful_recovery_looks_like" rows={2} className={textarea} placeholder="e.g. 80%+ pain reduction, resumes normal activities" /></div>
      <div className="space-y-1.5"><label className={label}>Good outcome definition</label><textarea name="what_makes_a_good_outcome" rows={2} className={textarea} placeholder="e.g. Completes care plan, avoids surgery" /></div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function ClinicalVocabSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const preferred = (fd.get('preferred_terms') as string).split(',').map(s => s.trim()).filter(Boolean)
      const banned    = (fd.get('banned_words')     as string).split(',').map(s => s.trim()).filter(Boolean)
      const signature = (fd.get('signature_phrases')as string).split('\n').map(s => s.trim()).filter(Boolean)
      onSave({ communication_style: fd.get('communication_style'), communication_style_notes: fd.get('communication_style_notes'), what_you_wish_other_chiropractors_knew: fd.get('what_you_wish_other_chiropractors_knew'), clinic_vocabulary: { preferred_terms: preferred, banned_words: banned, signature_phrases: signature } })
    }} className="space-y-4">
      <div className="space-y-1.5"><label className={label}>Communication style</label><input name="communication_style" type="text" className={inputCls} placeholder="e.g. Warm and personal" /></div>
      <div className="space-y-1.5"><label className={label}>Style rules & banned words</label><textarea name="communication_style_notes" rows={2} className={textarea} placeholder={'e.g. Never use "compliance"'} /><p className={hint}>AI enforces these in every message</p></div>
      <div className="space-y-1.5"><label className={label}>Preferred terms (comma-separated)</label><input name="preferred_terms" type="text" className={inputCls} placeholder="e.g. care partner, recovery journey" /></div>
      <div className="space-y-1.5"><label className={label}>Banned words (comma-separated)</label><input name="banned_words" type="text" className={inputCls} placeholder="e.g. compliance, pain management" /></div>
      <div className="space-y-1.5"><label className={label}>Signature phrases (one per line)</label><textarea name="signature_phrases" rows={3} className={textarea} placeholder={"We're in your corner\nSmall wins lead to big recoveries"} /></div>
      <div className="space-y-1.5"><label className={label}>What you wish others knew</label><textarea name="what_you_wish_other_chiropractors_knew" rows={3} className={textarea} /></div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function DecisionThresholdsSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const call = parseInt(fd.get('call_threshold') as string, 10)
      const text = parseInt(fd.get('text_threshold') as string, 10)
      const days = parseInt(fd.get('silent_days_urgent') as string, 10)
      const drop = parseInt(fd.get('signal_drop_urgent') as string, 10)
      onSave({ red_flags: fd.get('red_flags'), decision_thresholds: { call_threshold: isNaN(call)?50:call, text_threshold: isNaN(text)?60:text, silent_days_urgent: isNaN(days)?3:days, signal_drop_urgent: isNaN(drop)?20:drop } })
    }} className="space-y-4">
      <div className="space-y-1.5"><label className={label}>Red flags</label><textarea name="red_flags" rows={3} className={textarea} placeholder="e.g. Signal drops 20+ pts in a week, 3+ days without check-in" /><p className={hint}>AI uses these — not generic heuristics</p></div>
      <div className="grid grid-cols-2 gap-4">
        {[{name:'call_threshold',label:'Call threshold',hint:'Below this → call',def:50},{name:'text_threshold',label:'Text threshold',hint:'Below this → text',def:60},{name:'silent_days_urgent',label:'Silent days = urgent',hint:'Days without check-in',def:3},{name:'signal_drop_urgent',label:'Signal drop = urgent',hint:'Point drop in 7 days',def:20}].map(f => (
          <div key={f.name} className="space-y-1.5"><label className={label}>{f.label}</label><input name={f.name} type="number" className={inputCls} defaultValue={f.def} /><p className={hint}>{f.hint}</p></div>
        ))}
      </div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}

function OutcomesMeasuredSection({ saving, onSave, saved }: { saving: boolean; onSave: (d: Record<string, unknown>) => void; saved: boolean }) {
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const topComplaints = (fd.get('top_complaints') as string).split(',').map(s => s.trim()).filter(Boolean)
      const avgVisits     = parseInt(fd.get('avg_visits_to_discharge')  as string, 10)
      const satisfaction  = parseInt(fd.get('patient_satisfaction_pct') as string, 10)
      onSave({ common_outcomes_data: { avg_visits_to_discharge: isNaN(avgVisits)?null:avgVisits, patient_satisfaction_pct: isNaN(satisfaction)?null:satisfaction, top_complaints: topComplaints } })
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><label className={label}>Avg visits to discharge</label><input name="avg_visits_to_discharge" type="number" className={inputCls} placeholder="e.g. 10" /></div>
        <div className="space-y-1.5"><label className={label}>Patient satisfaction %</label><input name="patient_satisfaction_pct" type="number" className={inputCls} placeholder="e.g. 92" /></div>
      </div>
      <div className="space-y-1.5"><label className={label}>Top complaints treated</label><input name="top_complaints" type="text" className={inputCls} placeholder="e.g. lower back pain, neck pain" /></div>
      <div className="flex justify-end"><SaveButton saving={saving} saved={saved} /></div>
    </form>
  )
}
