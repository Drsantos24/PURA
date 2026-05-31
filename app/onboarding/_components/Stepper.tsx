const STEPS = ['Clinic Profile', 'Patient List', 'Preferences'] as const

export function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-10 space-y-3">
      <p className="text-center font-mono text-xs text-text-muted uppercase tracking-widest">
        Step {current} of {STEPS.length}
      </p>
      <div className="flex gap-2">
        {STEPS.map((label, i) => {
          const step = i + 1
          const done   = step < current
          const active = step === current
          return (
            <div key={step} className="flex-1 space-y-2">
              <div
                className={`h-1 rounded-full transition-colors ${
                  active ? 'bg-magenta' : done ? 'bg-magenta/35' : 'bg-border'
                }`}
              />
              <p className={`text-center text-xs font-sans ${
                active ? 'text-text-primary' : 'text-text-muted'
              }`}>
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
