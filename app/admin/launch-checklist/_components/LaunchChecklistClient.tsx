'use client'

import { useState } from 'react'

type Item = { id: string; category: string; label: string; auto: boolean }

const CATEGORY_LABELS: Record<string, string> = {
  finance:  'Finance & Credits',
  ops:      'Operations',
  infra:    'Infrastructure',
  legal:    'Legal & Compliance',
  security: 'Security',
  launch:   'Launch Verification',
}

export function LaunchChecklistClient({
  items, initialState,
}: {
  items:        Item[]
  initialState: Record<string, boolean>
}) {
  const [state,  setState]  = useState<Record<string, boolean>>(initialState)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const doneCount  = items.filter(i => state[i.id]).length
  const totalCount = items.length
  const allDone    = doneCount === totalCount

  async function toggle(id: string) {
    const next = { ...state, [id]: !state[id] }
    setState(next)
    setSaving(true)
    await fetch('/api/admin/launch-checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: next }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const categories = Array.from(new Set(items.map(i => i.category)))

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-sans text-text-muted">
            {doneCount} / {totalCount} complete
            {saving ? ' · saving…' : saved ? ' · saved ✓' : ''}
          </span>
          <span className="text-xs font-mono text-magenta font-medium">
            {Math.round((doneCount / totalCount) * 100)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-signal-green' : 'bg-magenta'}`}
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Ready banner */}
      {allDone && (
        <div className="rounded-lg border-2 border-signal-green bg-signal-green/10 p-6 text-center space-y-2">
          <p className="font-serif text-3xl text-signal-green">BETA LAUNCH READY</p>
          <p className="font-sans text-sm text-signal-green/80">All items complete. Ship it.</p>
        </div>
      )}

      {/* Categories */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat)
        const catDone  = catItems.filter(i => state[i.id]).length
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-sans text-text-muted uppercase tracking-widest font-medium">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <span className="text-[10px] font-sans text-text-muted">{catDone}/{catItems.length}</span>
            </div>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
              {catItems.map(item => (
                <label key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!state[item.id]}
                    onChange={() => toggle(item.id)}
                    className="rounded border-border text-magenta focus:ring-magenta/30 cursor-pointer"
                  />
                  <span className={`text-sm font-sans transition-colors ${
                    state[item.id] ? 'text-text-muted line-through' : 'text-text-primary'
                  }`}>
                    {item.label}
                  </span>
                  {state[item.id] && (
                    <span className="ml-auto text-signal-green text-xs">✓</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
