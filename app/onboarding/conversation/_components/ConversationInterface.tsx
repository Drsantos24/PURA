'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Exchange = {
  exchange_order:    number
  question_text:     string
  question_category: string
  answer_text:       string | null
}

type State = {
  conversationId: string
  exchanges:      Exchange[]
  nextQuestion:   { question: string; category: string }
  depthScore:     number
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Who you are',
  philosophy: 'Your philosophy',
  vocabulary: 'Your voice',
  decision_thresholds: 'Red flags',
  patient_journey: 'Patient journey',
  outcomes: 'Outcomes',
  follow_up: 'Follow-up',
}

const primaryBtn = 'rounded-md bg-magenta px-5 py-2.5 text-sm font-medium font-sans text-background transition-opacity hover:opacity-90 disabled:opacity-40'
const ghostBtn   = 'rounded-md border border-border px-4 py-2 text-xs font-sans text-text-muted hover:border-text-muted transition-colors'

export function ConversationInterface({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const [state, setState]         = useState<State | null>(null)
  const [answer, setAnswer]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/intake')
      .then(r => r.json())
      .then(d => { setState(d); setLoading(false) })
  }, [clinicId])

  useEffect(() => {
    if (!loading) textareaRef.current?.focus()
  }, [loading, state?.nextQuestion?.question])

  async function submit(skip = false) {
    if (!state) return
    setSubmitting(true)
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: state.conversationId,
        question:       state.nextQuestion.question,
        category:       state.nextQuestion.category,
        answer:         skip ? '' : answer,
        skip,
      }),
    })
    const data = await res.json()
    setState(prev => prev ? {
      ...prev,
      exchanges:    [...prev.exchanges, {
        exchange_order:    prev.exchanges.length,
        question_text:     prev.nextQuestion.question,
        question_category: prev.nextQuestion.category,
        answer_text:       skip ? null : answer,
      }],
      nextQuestion: data.nextQuestion,
      depthScore:   data.depthScore,
    } : null)
    setAnswer('')
    setSubmitting(false)
  }

  async function finish() {
    if (!state) return
    await fetch('/api/intake', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: state.conversationId }),
    })
    router.push('/onboarding/documents')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-magenta/30 border-t-magenta animate-spin" />
      </div>
    )
  }

  if (!state) return null

  const answered = state.exchanges.filter(e => e.answer_text)
  const pct = state.depthScore

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-sans text-text-muted">AI training progress</span>
          <span className="text-xs font-mono text-magenta font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-magenta rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Current question */}
      <div className="rounded-lg border border-border bg-surface/50 p-6 space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-sans text-text-muted uppercase tracking-widest">
            {CATEGORY_LABELS[state.nextQuestion.category] ?? state.nextQuestion.category}
          </span>
          <p className="font-serif text-xl text-text-primary leading-relaxed">
            {state.nextQuestion.question}
          </p>
        </div>

        <textarea
          ref={textareaRef}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && answer.trim()) submit()
          }}
          rows={5}
          placeholder="Type your answer here..."
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-magenta focus:outline-none focus:ring-1 focus:ring-magenta resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button type="button" onClick={() => submit(true)} className={ghostBtn} disabled={submitting}>
              Skip
            </button>
            <button type="button" onClick={finish} className={ghostBtn}>
              Done for now
            </button>
          </div>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!answer.trim() || submitting}
            className={primaryBtn}
          >
            {submitting ? 'Thinking...' : 'Send'}
          </button>
        </div>
        <p className="text-[10px] font-sans text-text-muted/60 text-right">
          {answer.trim() ? 'Cmd+Enter to send' : ''}
        </p>
      </div>

      {/* Conversation history */}
      {answered.length > 0 && (
        <div className="rounded-md border border-border/50">
          <button
            type="button"
            onClick={() => setHistoryOpen(h => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-sans text-text-muted hover:text-text-primary transition-colors"
          >
            <span>{answered.length} exchange{answered.length !== 1 ? 's' : ''} covered</span>
            <span>{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div className="border-t border-border/50 divide-y divide-border/30 max-h-96 overflow-y-auto">
              {answered.map((ex, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-sans text-text-muted uppercase tracking-widest">
                    {CATEGORY_LABELS[ex.question_category] ?? ex.question_category}
                  </p>
                  <p className="text-xs font-sans text-text-muted">{ex.question_text}</p>
                  <p className="text-xs font-sans text-text-primary">{ex.answer_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Encouragement nudge */}
      {pct < 40 && answered.length > 0 && (
        <p className="text-xs font-sans text-text-muted text-center">
          Keep going — richer answers make your AI significantly more accurate.
        </p>
      )}
      {pct >= 80 && (
        <p className="text-xs font-sans text-signal-green text-center">
          Excellent coverage. Your AI has strong context to work with.
        </p>
      )}
    </div>
  )
}
