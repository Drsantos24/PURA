'use client'

import { useState } from 'react'

const label      = 'block text-xs font-sans font-medium text-text-muted uppercase tracking-widest'
const hint       = 'text-xs font-sans text-text-muted/70 mt-0.5'
const textarea   = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta resize-none'
const inputCls   = 'w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
const primaryBtn = 'rounded-md bg-magenta px-5 py-2 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'

type SectionKey = 'practice_identity' | 'patient_journey' | 'clinical_vocabulary' | 'decision_thresholds' | 'outcomes_measured'

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'practice_identity',   title: 'Practice Identity' },
  { key: 'patient_journey',     title: 'Patient Journey' },
  { key: 'clinical_vocabulary', title: 'Clinical Vocabulary' },
  { key: 'decision_thresholds', title: 'Decision Thresholds' },
  { key: 'outcomes_measured',   title: 'Outcomes Measured' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ClinicIntakeEditor({ initialProfile }: { initialProfile: any }) {
  const [active, setActive]       = useState<SectionKey>('practice_identity')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState<SectionKey | null>(null)
  const [completed, setCompleted] = useState<Partial<Record<SectionKey, boolean>>>(
    initialProfile?.completed_sections ?? {}
  )

  const pct = Math.round((Object.values(completed).filter(Boolean).length / SECTIONS.length) * 100)

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
      setTimeout(() => setSaved(null), 2500)
    } finally {
      setSaving(false)
    }
  }

  const p = initialProfile ?? {}

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-sans text-text-muted">Training completeness</span>
          <span className="text-xs font-mono text-magenta">{pct}%</span>
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
              active === s.key ? 'bg-magenta/15 text-magenta border border-magenta/30' : 'border border-border text-text-muted hover:text-text-primary',
            ].join(' ')}>
            {completed[s.key] && <span className="mr-1 text-signal-green">✓</span>}
            {s.title}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border/60 bg-surface/30 p-5">
        {active === 'practice_identity' && (
          <SectionForm key="pi" saving={saving} saved={saved === 'practice_identity'} onSave={d => saveSection('practice_identity', d)} fields={[
            { name: 'practice_type',          label: 'Practice type',          type: 'input',    placeholder: 'e.g. General chiropractic, cash-pay',                              defaultValue: p.practice_type },
            { name: 'practice_origin_story',  label: 'Origin story',           type: 'textarea', placeholder: 'Why did you start this practice?',                                 defaultValue: p.practice_origin_story, rows: 4 },
            { name: 'practice_philosophy',    label: 'Practice philosophy',    type: 'textarea', placeholder: 'e.g. Whole-body wellness — treat the cause, not the symptom',      defaultValue: p.practice_philosophy, rows: 2 },
            { name: 'patient_demographics',   label: 'Typical patients',       type: 'textarea', placeholder: 'e.g. Working adults 30–60 with lower back pain',                   defaultValue: p.patient_demographics, rows: 2 },
            { name: 'typical_visit_frequency',label: 'Visit frequency',        type: 'input',    placeholder: 'e.g. 3×/week for 4 weeks, then monthly',                           defaultValue: p.typical_visit_frequency },
          ]} />
        )}
        {active === 'patient_journey' && (
          <SectionForm key="pj" saving={saving} saved={saved === 'patient_journey'} onSave={d => saveSection('patient_journey', d)} fields={[
            { name: 'typical_patient_journey',             label: 'Patient journey',            type: 'textarea', placeholder: 'From first contact to discharge…',                                                    defaultValue: p.typical_patient_journey, rows: 4 },
            { name: 'typical_care_plan_structure',         label: 'Care plan structure',        type: 'textarea', placeholder: 'e.g. 12-week plan: acute (wks 1–4, 3×/wk), subacute (wks 5–8)…',                   defaultValue: p.typical_care_plan_structure, rows: 3 },
            { name: 'what_successful_recovery_looks_like', label: 'Successful recovery',        type: 'textarea', placeholder: 'e.g. 80%+ pain reduction, resumes normal activities, stable signal 2 weeks',        defaultValue: p.what_successful_recovery_looks_like, rows: 2 },
            { name: 'what_makes_a_good_outcome',           label: 'Good outcome definition',    type: 'textarea', placeholder: 'e.g. Completes care plan, avoids surgery, returns to sport',                         defaultValue: p.what_makes_a_good_outcome, rows: 2 },
          ]} />
        )}
        {active === 'clinical_vocabulary' && (
          <VocabSection saving={saving} saved={saved === 'clinical_vocabulary'} onSave={d => saveSection('clinical_vocabulary', d)} initialProfile={p} />
        )}
        {active === 'decision_thresholds' && (
          <ThresholdsSection saving={saving} saved={saved === 'decision_thresholds'} onSave={d => saveSection('decision_thresholds', d)} initialProfile={p} />
        )}
        {active === 'outcomes_measured' && (
          <OutcomesSection saving={saving} saved={saved === 'outcomes_measured'} onSave={d => saveSection('outcomes_measured', d)} initialProfile={p} />
        )}
      </div>
    </div>
  )
}

type FieldDef = {
  name: string; label: string; type: 'input' | 'textarea'
  placeholder?: string; defaultValue?: string | null; rows?: number; hint?: string
}

function SectionForm({ fields, saving, saved, onSave }: {
  fields: FieldDef[]
  saving: boolean; saved: boolean
  onSave: (d: Record<string, unknown>) => void
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSave(Object.fromEntries(fd)) }} className="space-y-4">
      {fields.map(f => (
        <div key={f.name} className="space-y-1.5">
          <label className={label}>{f.label}</label>
          {f.type === 'input'
            ? <input name={f.name} type="text" className={inputCls} placeholder={f.placeholder} defaultValue={f.defaultValue ?? ''} />
            : <textarea name={f.name} rows={f.rows ?? 3} className={textarea} placeholder={f.placeholder} defaultValue={f.defaultValue ?? ''} />
          }
          {f.hint && <p className={hint}>{f.hint}</p>}
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </form>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VocabSection({ saving, saved, onSave, initialProfile: p }: { saving: boolean; saved: boolean; onSave: (d: Record<string, unknown>) => void; initialProfile: any }) {
  const vocab = p.clinic_vocabulary ?? {}
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd        = new FormData(e.currentTarget)
      const preferred = (fd.get('preferred_terms')  as string).split(',').map(s => s.trim()).filter(Boolean)
      const banned    = (fd.get('banned_words')      as string).split(',').map(s => s.trim()).filter(Boolean)
      const signature = (fd.get('signature_phrases') as string).split('\n').map(s => s.trim()).filter(Boolean)
      onSave({
        communication_style:       fd.get('communication_style'),
        communication_style_notes: fd.get('communication_style_notes'),
        what_you_wish_other_chiropractors_knew: fd.get('what_you_wish_other_chiropractors_knew'),
        clinic_vocabulary: { preferred_terms: preferred, banned_words: banned, signature_phrases: signature },
      })
    }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>Communication style</label>
        <input name="communication_style" type="text" className={inputCls} defaultValue={p.communication_style ?? ''} placeholder="e.g. Warm and personal — first names, celebrate wins" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Style rules and banned words</label>
        <textarea name="communication_style_notes" rows={2} className={textarea} defaultValue={p.communication_style_notes ?? ''} placeholder={'e.g. Never use "compliance" — say "staying consistent" instead'} />
        <p className={hint}>AI enforces these in every message</p>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Preferred terms (comma-separated)</label>
        <input name="preferred_terms" type="text" className={inputCls} defaultValue={(vocab.preferred_terms ?? []).join(', ')} placeholder="e.g. care partner, recovery journey" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Banned words (comma-separated)</label>
        <input name="banned_words" type="text" className={inputCls} defaultValue={(vocab.banned_words ?? []).join(', ')} placeholder="e.g. compliance, pain management" />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Signature phrases (one per line)</label>
        <textarea name="signature_phrases" rows={3} className={textarea} defaultValue={(vocab.signature_phrases ?? []).join('\n')} placeholder={"We're in your corner\nSmall wins lead to big recoveries"} />
      </div>
      <div className="space-y-1.5">
        <label className={label}>What you wish other chiropractors knew</label>
        <textarea name="what_you_wish_other_chiropractors_knew" rows={3} className={textarea} defaultValue={p.what_you_wish_other_chiropractors_knew ?? ''} />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </form>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ThresholdsSection({ saving, saved, onSave, initialProfile: p }: { saving: boolean; saved: boolean; onSave: (d: Record<string, unknown>) => void; initialProfile: any }) {
  const dt = p.decision_thresholds ?? {}
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
        decision_thresholds: { call_threshold: isNaN(call)?50:call, text_threshold: isNaN(text)?60:text, silent_days_urgent: isNaN(days)?3:days, signal_drop_urgent: isNaN(drop)?20:drop },
      })
    }} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label}>Red flags</label>
        <textarea name="red_flags" rows={3} className={textarea} defaultValue={p.red_flags ?? ''} placeholder="e.g. Signal drops 20+ pts in a week, 3+ days without check-in" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'call_threshold',     label: 'Call threshold',         hint: 'Below this → call',  def: dt.call_threshold     ?? 50 },
          { name: 'text_threshold',     label: 'Text threshold',         hint: 'Below this → text',  def: dt.text_threshold     ?? 60 },
          { name: 'silent_days_urgent', label: 'Silent days = urgent',   hint: 'Days without check-in', def: dt.silent_days_urgent ?? 3 },
          { name: 'signal_drop_urgent', label: 'Signal drop = urgent',   hint: 'Point drop in 7 days',  def: dt.signal_drop_urgent ?? 20 },
        ].map(f => (
          <div key={f.name} className="space-y-1.5">
            <label className={label}>{f.label}</label>
            <input name={f.name} type="number" className={inputCls} defaultValue={f.def} />
            <p className={hint}>{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </form>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OutcomesSection({ saving, saved, onSave, initialProfile: p }: { saving: boolean; saved: boolean; onSave: (d: Record<string, unknown>) => void; initialProfile: any }) {
  const od = p.common_outcomes_data ?? {}
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const fd           = new FormData(e.currentTarget)
      const topComplaints = (fd.get('top_complaints') as string).split(',').map(s => s.trim()).filter(Boolean)
      const avgVisits    = parseInt(fd.get('avg_visits_to_discharge')  as string, 10)
      const satisfaction = parseInt(fd.get('patient_satisfaction_pct') as string, 10)
      onSave({ common_outcomes_data: { avg_visits_to_discharge: isNaN(avgVisits)?null:avgVisits, patient_satisfaction_pct: isNaN(satisfaction)?null:satisfaction, top_complaints: topComplaints } })
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={label}>Avg visits to discharge</label>
          <input name="avg_visits_to_discharge" type="number" className={inputCls} defaultValue={od.avg_visits_to_discharge ?? ''} placeholder="e.g. 10" />
        </div>
        <div className="space-y-1.5">
          <label className={label}>Patient satisfaction %</label>
          <input name="patient_satisfaction_pct" type="number" className={inputCls} defaultValue={od.patient_satisfaction_pct ?? ''} placeholder="e.g. 92" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={label}>Top complaints treated</label>
        <input name="top_complaints" type="text" className={inputCls} defaultValue={(od.top_complaints ?? []).join(', ')} placeholder="e.g. lower back pain, neck pain, headaches" />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </form>
  )
}
