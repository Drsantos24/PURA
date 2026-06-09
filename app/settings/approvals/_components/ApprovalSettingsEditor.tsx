'use client'

import { useState } from 'react'

type Setting = {
  id:                     string
  category:               string
  requires_approval:      boolean
  auto_approve_for_roles: string[]
}

type TeamMember = { user_email: string; role: string }

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  outbound_message:  { label: 'Outbound Messages',   description: 'SMS and messages sent to patients' },
  care_plan_change:  { label: 'Care Plan Changes',    description: 'Modifications to patient care plans' },
  intake_edit:       { label: 'Profile Edits',        description: 'Changes to clinic AI profile settings' },
  patient_invite:    { label: 'Patient Invitations',  description: 'Adding new patients to the roster' },
  patient_data_edit: { label: 'Patient Data Edits',   description: 'Changes to patient records' },
}

export function ApprovalSettingsEditor({
  initialSettings, clinicId, teamMembers = [],
}: {
  initialSettings: Setting[]
  clinicId:        string
  teamMembers?:    TeamMember[]
}) {
  const [settings, setSettings] = useState<Setting[]>(initialSettings)
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)

  async function toggle(setting: Setting) {
    const updated = { ...setting, requires_approval: !setting.requires_approval }
    setSaving(setting.category)
    await fetch('/api/approvals/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: setting.category,
        requires_approval: updated.requires_approval,
        auto_approve_for_roles: updated.auto_approve_for_roles,
      }),
    })

    setSettings(prev => prev.map(s => s.category === setting.category ? updated : s))
    setSaving(null)
    setSaved(setting.category)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div className="space-y-3">
      {settings.map(s => {
        const meta = CATEGORY_META[s.category]
        return (
          <div key={s.id} className="rounded-lg border border-border bg-surface/30 p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <p className="font-sans text-sm font-medium text-text-primary">
                  {meta?.label ?? s.category}
                </p>
                <p className="font-sans text-xs text-text-muted">{meta?.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(s)}
                disabled={saving === s.category}
                className={[
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                  s.requires_approval ? 'bg-magenta' : 'bg-border',
                  saving === s.category ? 'opacity-50' : '',
                ].join(' ')}
                aria-pressed={s.requires_approval}
              >
                <span className={[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  s.requires_approval ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-sans uppercase tracking-widest ${s.requires_approval ? 'text-magenta' : 'text-text-muted'}`}>
                {saved === s.category ? '✓ Saved' : s.requires_approval ? 'Requires your approval' : 'Auto-approved'}
              </span>
            </div>
          </div>
        )
      })}

      <p className="text-xs font-sans text-text-muted/60 pt-2">
        When approval is required, team member actions create a request in your{' '}
        <a href="/approvals" className="underline underline-offset-2">Approval Inbox</a>{' '}
        before the action fires.
      </p>
    </div>
  )
}
