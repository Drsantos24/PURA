'use client'

import { useState } from 'react'

type CredStatus = {
  provider:             string
  from_number:          string | null
  whatsapp_from_number: string | null
  is_verified:          boolean
  verified_at:          string | null
  last_send_at:         string | null
} | null

type Props = {
  clinicId:           string
  initialCreds:       CredStatus
  sendCountThisMonth: number
}

type Step = 'idle' | 'form' | 'verifying' | 'done'

const PLATFORM_LIMIT = 50

export function SmsSettingsClient({ clinicId, initialCreds, sendCountThisMonth }: Props) {
  const [creds, setCreds]       = useState<CredStatus>(initialCreds)
  const [step, setStep]         = useState<Step>('idle')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  // Form state
  const [accountSid, setAccountSid]   = useState('')
  const [authToken, setAuthToken]     = useState('')
  const [fromNumber, setFromNumber]   = useState(initialCreds?.from_number ?? '')
  const [waNumber, setWaNumber]       = useState(initialCreds?.whatsapp_from_number ?? '')
  const [showToken, setShowToken]     = useState(false)

  // Verification state
  const [verifyPhone, setVerifyPhone] = useState('')
  const [verifyCode, setVerifyCode]   = useState('')
  const [sentCode, setSentCode]       = useState<string | null>(null)

  const usingOwn   = creds?.provider !== 'platform_default' && creds !== null
  const isVerified = creds?.is_verified ?? false

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(null) }
    else         { setSuccess(msg); setError(null) }
    setTimeout(() => { setError(null); setSuccess(null) }, 5000)
  }

  // ── Save credentials ─────────────────────────────────────────────────────────
  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:             'save',
          provider:           'twilio_subaccount',
          accountSid,
          authToken,
          fromNumber,
          whatsappFromNumber: waNumber || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { flash(json.error ?? 'Save failed', true); return }
      setStep('verifying')
    } finally {
      setSaving(false)
    }
  }

  // ── Send verification code ────────────────────────────────────────────────────
  async function handleSendCode() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'send_verification', toPhone: verifyPhone }),
      })
      const json = await res.json()
      if (!res.ok) { flash(json.error ?? 'Failed to send code', true); return }
      setSentCode(json.code)
      flash('Code sent — check your phone.')
    } finally {
      setSaving(false)
    }
  }

  // ── Confirm code ─────────────────────────────────────────────────────────────
  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!sentCode) { flash('Send the code first.', true); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'confirm_verification',
          enteredCode:  verifyCode,
          expectedCode: sentCode,
        }),
      })
      const json = await res.json()
      if (!res.ok) { flash(json.error ?? 'Verification failed', true); return }
      setCreds(prev => ({
        provider:             'twilio_subaccount',
        from_number:          (fromNumber || prev?.from_number) ?? null,
        whatsapp_from_number: (waNumber   || prev?.whatsapp_from_number) ?? null,
        is_verified:          true,
        verified_at:          new Date().toISOString(),
        last_send_at:         prev?.last_send_at ?? null,
      }))
      setStep('done')
      flash('Twilio account verified! Patients will now receive messages from your number.')
    } finally {
      setSaving(false)
    }
  }

  // ── Switch to platform ────────────────────────────────────────────────────────
  async function handleUsePlatform() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'switch_to_platform' }),
      })
      const json = await res.json()
      if (!res.ok) { flash(json.error ?? 'Failed to switch', true); return }
      setCreds(prev => ({
        provider:             'platform_default',
        from_number:          prev?.from_number ?? null,
        whatsapp_from_number: prev?.whatsapp_from_number ?? null,
        is_verified:          false,
        verified_at:          null,
        last_send_at:         prev?.last_send_at ?? null,
      }))
      setStep('idle')
    } finally {
      setSaving(false)
    }
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="space-y-4">

      {/* ── Status strip ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface/20 px-4 py-3 flex flex-wrap gap-6">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Active provider</p>
          <p className="font-mono text-xs text-text-primary mt-0.5">
            {usingOwn && isVerified
              ? `Your Twilio · ${creds?.from_number ?? '—'}`
              : 'PURA platform (shared)'}
          </p>
        </div>
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Status</p>
          <p className={`font-mono text-xs mt-0.5 ${usingOwn && isVerified ? 'text-signal-green' : 'text-amber-400'}`}>
            {usingOwn ? (isVerified ? '✓ Verified' : '⚠ Unverified') : 'Platform default'}
          </p>
        </div>
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Sends this month</p>
          <p className="font-mono text-xs text-text-primary mt-0.5">
            {sendCountThisMonth}
            {!usingOwn && <span className="text-text-muted"> / {PLATFORM_LIMIT}</span>}
          </p>
        </div>
        {creds?.last_send_at && (
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-text-muted">Last send</p>
            <p className="font-mono text-xs text-text-primary mt-0.5">{fmtDate(creds.last_send_at)}</p>
          </div>
        )}
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="font-sans text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-signal-green/30 bg-signal-green/5 px-4 py-3">
          <p className="font-sans text-sm text-signal-green">{success}</p>
        </div>
      )}

      {/* ── Provider cards ─────────────────────────────────────────────────── */}
      {step === 'idle' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Own Twilio account */}
          <div
            className={`rounded-lg border p-5 space-y-3 transition-colors ${
              usingOwn && isVerified
                ? 'border-magenta bg-magenta/5'
                : 'border-border hover:border-magenta/40 cursor-pointer'
            }`}
            onClick={() => !saving && setStep('form')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-sans text-sm font-medium text-text-primary">Use my own Twilio account</p>
                <p className="font-sans text-xs text-text-muted">
                  Unlimited sends. Register your own A2P 10DLC. Messages come from your clinic number.
                </p>
              </div>
              {usingOwn && isVerified && (
                <span className="text-signal-green text-xs shrink-0">✓ Active</span>
              )}
            </div>
            {usingOwn && isVerified ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setStep('form') }}
                className="text-xs font-sans text-magenta hover:underline"
              >
                Edit credentials
              </button>
            ) : (
              <p className="text-xs font-sans text-magenta">Connect →</p>
            )}
          </div>

          {/* Platform default */}
          <div
            className={`rounded-lg border p-5 space-y-3 transition-colors ${
              !usingOwn
                ? 'border-border bg-surface/10'
                : 'border-border hover:border-border/60 cursor-pointer'
            }`}
            onClick={() => usingOwn && !saving && handleUsePlatform()}
          >
            <div className="space-y-1">
              <p className="font-sans text-sm font-medium text-text-primary">Use PURA&apos;s default</p>
              <p className="font-sans text-xs text-text-muted">
                Shared sender. Limited to {PLATFORM_LIMIT} sends/day. No Twilio account needed.
              </p>
            </div>
            {!usingOwn ? (
              <span className="text-xs font-sans text-signal-green">✓ Currently active</span>
            ) : (
              <p className="text-xs font-sans text-text-muted">Switch back →</p>
            )}
          </div>
        </div>
      )}

      {/* ── Credentials form ───────────────────────────────────────────────── */}
      {step === 'form' && (
        <form onSubmit={handleSaveForm} className="rounded-lg border border-border p-5 space-y-4">
          <div className="space-y-0.5">
            <p className="font-sans text-sm font-medium text-text-primary">Twilio credentials</p>
            <p className="font-sans text-xs text-text-muted">
              Find these in your{' '}
              <a href="https://console.twilio.com" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:text-text-primary">Twilio console</a>
              {' → Account info. '}
              <a href="/docs/sms-setup"
                className="underline underline-offset-2 hover:text-text-primary">Setup guide →</a>
            </p>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="font-sans text-xs text-text-muted">Account SID</span>
              <input
                type="text"
                value={accountSid}
                onChange={e => setAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                className="w-full rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-sans text-xs text-text-muted">Auth Token</span>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={authToken}
                  onChange={e => setAuthToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  required
                  className="w-full rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50 pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans text-text-muted hover:text-text-primary"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="font-sans text-xs text-text-muted">From phone (E.164)</span>
              <input
                type="text"
                value={fromNumber}
                onChange={e => setFromNumber(e.target.value)}
                placeholder="+18005551234"
                required
                className="w-full rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-sans text-xs text-text-muted">
                WhatsApp from (E.164){' '}
                <span className="text-text-muted/50">— optional</span>
              </span>
              <input
                type="text"
                value={waNumber}
                onChange={e => setWaNumber(e.target.value)}
                placeholder="+18005551234"
                className="w-full rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50"
              />
              <p className="font-sans text-[10px] text-text-muted">
                Leave blank to reuse the SMS number for WhatsApp.
              </p>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-magenta text-white font-sans text-xs font-medium hover:bg-magenta/80 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save & verify'}
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="px-4 py-2 rounded-md border border-border text-text-muted font-sans text-xs hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Verification flow ──────────────────────────────────────────────── */}
      {step === 'verifying' && (
        <div className="rounded-lg border border-border p-5 space-y-4">
          <div className="space-y-0.5">
            <p className="font-sans text-sm font-medium text-text-primary">Verify connection</p>
            <p className="font-sans text-xs text-text-muted">
              Send a test SMS from your Twilio number to confirm the connection works.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="font-sans text-xs text-text-muted">Send code to</span>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={verifyPhone}
                  onChange={e => setVerifyPhone(e.target.value)}
                  placeholder="+17875551234"
                  className="flex-1 rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50"
                />
                <button
                  type="button"
                  disabled={saving || !verifyPhone}
                  onClick={handleSendCode}
                  className="px-4 py-2 rounded-md border border-border text-text-primary font-sans text-xs hover:border-magenta/40 disabled:opacity-50 transition-colors shrink-0"
                >
                  {saving ? '…' : sentCode ? 'Resend' : 'Send code'}
                </button>
              </div>
            </label>

            {sentCode && (
              <form onSubmit={handleConfirm} className="space-y-3">
                <label className="block space-y-1">
                  <span className="font-sans text-xs text-text-muted">6-digit code</span>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    required
                    className="w-36 rounded-md border border-border bg-surface/30 px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-magenta/50 tracking-widest"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving || verifyCode.length < 6}
                    className="px-4 py-2 rounded-md bg-magenta text-white font-sans text-xs font-medium hover:bg-magenta/80 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Confirming…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="px-4 py-2 rounded-md border border-border text-text-muted font-sans text-xs hover:text-text-primary transition-colors"
                  >
                    ← Edit credentials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Verified state ─────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="rounded-lg border border-signal-green/30 bg-signal-green/5 p-5 space-y-2">
          <p className="font-sans text-sm font-medium text-signal-green">
            ✓ Twilio account connected
          </p>
          <p className="font-sans text-xs text-text-muted">
            Patients will now receive messages from{' '}
            <span className="font-mono">{creds?.from_number}</span>.
            Register your A2P 10DLC at{' '}
            <a
              href="https://console.twilio.com/us1/develop/sms/regulatory-compliance"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text-primary"
            >
              Twilio Regulatory Compliance
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => setStep('idle')}
            className="text-xs font-sans text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
          >
            Back to SMS settings
          </button>
        </div>
      )}

    </div>
  )
}
