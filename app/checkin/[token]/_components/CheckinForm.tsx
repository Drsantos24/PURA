'use client'

import { useFormState } from 'react-dom'
import { useState } from 'react'
import { submitCheckin } from '../actions'

const SLEEP_OPTIONS = [
  { label: 'Poor',      value: 0 },
  { label: 'Fair',      value: 3 },
  { label: 'Good',      value: 7 },
  { label: 'Excellent', value: 10 },
]

type Device = 'apple_watch' | 'oura' | 'whoop' | 'garmin' | 'other'

const DEVICES: { id: Device; label: string }[] = [
  { id: 'apple_watch', label: 'Apple Watch' },
  { id: 'oura',        label: 'Oura Ring'   },
  { id: 'whoop',       label: 'WHOOP'       },
  { id: 'garmin',      label: 'Garmin'      },
  { id: 'other',       label: 'Other'       },
]

// Which optional fields each device supports
const DEVICE_FIELDS: Record<Device, Set<string>> = {
  apple_watch: new Set(['hrv', 'rhr', 'deep_sleep', 'rem_sleep', 'steps', 'active_calories']),
  oura:        new Set(['hrv', 'rhr', 'sleep_score', 'readiness', 'deep_sleep', 'rem_sleep', 'steps']),
  whoop:       new Set(['hrv', 'rhr', 'sleep_score', 'readiness', 'deep_sleep', 'rem_sleep', 'steps']),
  garmin:      new Set(['hrv', 'rhr', 'sleep_score', 'readiness', 'steps', 'active_calories']),
  other:       new Set(['hrv', 'rhr', 'sleep_score', 'readiness', 'deep_sleep', 'rem_sleep', 'steps', 'active_calories']),
}

const READINESS_LABEL: Record<Device, string> = {
  apple_watch: 'Readiness score',
  oura:        'Readiness score',
  whoop:       'Recovery score',
  garmin:      'Body Battery',
  other:       'Readiness / recovery score',
}

interface Props {
  token: string
  patientFirstName: string
}

export function CheckinForm({ token }: Props) {
  const [state, action] = useFormState(submitCheckin, { error: null })

  const [pain,       setPain]       = useState(0)
  const [sleepQ,     setSleepQ]     = useState<number>(7)
  const [sleepHours, setSleepHours] = useState('7')
  const [energy,     setEnergy]     = useState(5)
  const [stress,     setStress]     = useState(5)
  const [functional, setFunctional] = useState(5)
  const [mood,       setMood]       = useState(5)

  const [wearableOpen, setWearableOpen] = useState(false)
  const [device,       setDevice]       = useState<Device | null>(null)

  const show = (field: string) => device !== null && DEVICE_FIELDS[device].has(field)

  return (
    <form action={action} className="space-y-8 pb-28">
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <div className="rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm font-sans text-danger">
          {state.error}
        </div>
      )}

      {/* ── Pain ── */}
      <SliderField name="pain_level" label="Pain" value={pain} onChange={setPain}
        hint="0 = no pain, 10 = worst imaginable" />

      {/* ── Sleep quality ── */}
      <div className="space-y-2">
        <FieldLabel>Sleep quality</FieldLabel>
        <p className={hint}>How well did you sleep last night?</p>
        <input type="hidden" name="sleep_quality" value={sleepQ} />
        <div className="grid grid-cols-4 gap-2">
          {SLEEP_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setSleepQ(opt.value)}
              className={`py-3 rounded-md text-sm font-sans font-medium transition-colors ${
                sleepQ === opt.value
                  ? 'bg-magenta text-background'
                  : 'bg-surface border border-border text-text-muted hover:border-magenta/50 hover:text-text-primary'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sleep hours ── */}
      <div className="space-y-2">
        <FieldLabel>Sleep hours</FieldLabel>
        <p className={hint}>Total hours slept</p>
        <input name="sleep_hours" type="number" min={0} max={12} step={0.5} required
          value={sleepHours} onChange={e => setSleepHours(e.target.value)} className={inputCls} />
      </div>

      {/* ── Energy ── */}
      <SliderField name="energy_level" label="Energy" value={energy} onChange={setEnergy}
        hint="0 = exhausted, 10 = very energetic" />

      {/* ── Stress ── */}
      <SliderField name="stress_level" label="Stress" value={stress} onChange={setStress}
        hint="0 = calm, 10 = overwhelmed" />

      {/* ── Functional ability ── */}
      <SliderField name="functional_ability" label="Functional ability" value={functional}
        onChange={setFunctional} hint="0 = couldn't do my normal activities, 10 = fully functional" />

      {/* ── Mood ── */}
      <SliderField name="mood" label="Mood" value={mood} onChange={setMood}
        hint="0 = very low, 10 = very positive" />

      {/* ── Wearable data ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <button type="button" onClick={() => setWearableOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-sans text-text-muted hover:text-text-primary transition-colors">
          <span>Got data from a wearable today? <span className="text-text-muted/60">(optional, share whatever you have)</span></span>
          <span className="text-xs ml-2 shrink-0">{wearableOpen ? '▲' : '▼'}</span>
        </button>

        {wearableOpen && (
          <div className="border-t border-border px-4 pb-5 pt-4 space-y-5">
            <p className="text-xs font-sans text-text-muted/60">
              Skip everything here if you don't track this — it won't affect your check-in.
            </p>

            {/* Device picker */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {DEVICES.map(d => (
                <button key={d.id} type="button" onClick={() => setDevice(prev => prev === d.id ? null : d.id)}
                  className={`py-2 px-2 rounded-md text-xs font-sans font-medium transition-colors leading-tight ${
                    device === d.id
                      ? 'bg-magenta text-background'
                      : 'bg-surface border border-border text-text-muted hover:border-magenta/50 hover:text-text-primary'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>

            {device && (
              <div className="space-y-3">
                {show('hrv') && (
                  <WearableField name="hrv_manual" label="HRV" unit="ms" placeholder="e.g. 45" />
                )}
                {show('rhr') && (
                  <WearableField name="rhr_manual" label="Resting heart rate" unit="bpm" placeholder="e.g. 58" />
                )}
                {show('sleep_score') && (
                  <WearableField name="sleep_score" label="Sleep score" unit="0–100" placeholder="e.g. 78" />
                )}
                {show('readiness') && (
                  <WearableField name="readiness_score" label={READINESS_LABEL[device]} unit="0–100" placeholder="e.g. 72" />
                )}
                {show('deep_sleep') && (
                  <WearableField name="deep_sleep_minutes" label="Deep sleep" unit="min" placeholder="e.g. 90" />
                )}
                {show('rem_sleep') && (
                  <WearableField name="rem_sleep_minutes" label="REM sleep" unit="min" placeholder="e.g. 110" />
                )}
                {show('steps') && (
                  <WearableField name="total_steps" label="Total steps yesterday" unit="steps" placeholder="e.g. 8400" />
                )}
                {show('active_calories') && (
                  <WearableField name="active_calories" label="Active calories yesterday" unit="kcal" placeholder="e.g. 420" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Note ── */}
      <div className="space-y-2">
        <FieldLabel>Anything else your doctor should know? <span className="normal-case font-normal text-text-muted/60">(optional)</span></FieldLabel>
        <textarea name="patient_note" rows={3} placeholder="Type here…"
          className={`${inputCls} resize-none`} />
      </div>

      {/* ── Sticky submit ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
        <button type="submit"
          className="w-full rounded-xl bg-magenta py-4 text-base font-semibold font-sans text-background transition-opacity hover:opacity-90 active:opacity-80">
          Submit check-in
        </button>
      </div>
    </form>
  )
}

/* ── Sub-components ── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-sans font-medium text-text-muted uppercase tracking-widest">{children}</p>
  )
}

function SliderField({ name, label, value, onChange, hint: hintText }: {
  name: string; label: string; value: number
  onChange: (v: number) => void; hint: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-2xl text-text-primary tabular-nums">{value}</span>
      </div>
      <p className={hint}>{hintText}</p>
      <input name={name} type="range" min={0} max={10} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className="w-full h-3 rounded-full appearance-none cursor-pointer accent-magenta bg-border" />
      <div className="flex justify-between text-xs font-mono text-text-muted/60 select-none">
        <span>0</span><span>10</span>
      </div>
    </div>
  )
}

function WearableField({ name, label, unit, placeholder }: {
  name: string; label: string; unit: string; placeholder: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block text-xs font-sans text-text-muted mb-1">{label}</label>
        <input name={name} type="number" min={0} placeholder={placeholder}
          className={inputCls} />
      </div>
      <span className="text-xs font-mono text-text-muted/60 pt-5 shrink-0">{unit}</span>
    </div>
  )
}

const hint     = 'text-xs font-sans text-text-muted'
const inputCls = 'w-full rounded-md border border-border bg-surface px-4 py-3 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta'
