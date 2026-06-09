import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

export type QuestionCategory =
  | 'identity' | 'philosophy' | 'vocabulary'
  | 'decision_thresholds' | 'patient_journey' | 'outcomes' | 'follow_up'

export type Exchange = {
  exchange_order:    number
  question_text:     string
  question_category: QuestionCategory
  answer_text:       string | null
}

export type ExtractedInsights = {
  key_phrases:  string[]
  clinic_values: string[]
  vocabulary:   { preferred?: string[]; banned?: string[] }
  numeric_thresholds: Record<string, number>
  summary:      string
}

const OPENING_QUESTIONS: Array<{ question: string; category: QuestionCategory }> = [
  {
    question: "Tell me about your practice — not the clinical details yet, but why you opened it. What problem were you trying to solve that other chiropractors weren't?",
    category: 'identity',
  },
  {
    question: "Describe the patient who represents your best work. Not their diagnosis — who are they as a person, and what did success look like for them at the end of their care with you?",
    category: 'patient_journey',
  },
  {
    question: "What do you wish patients understood about chiropractic care before they walked through your door for the first time?",
    category: 'philosophy',
  },
]

function claude(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function configured(): boolean {
  const k = process.env.ANTHROPIC_API_KEY
  return !!k && !k.startsWith('placeholder')
}

export async function generateOpeningQuestion(clinicId: string): Promise<{
  question: string
  category: QuestionCategory
}> {
  // Check if there's an existing incomplete conversation — resume from there
  const service = createServiceClient()
  const { data: conv } = await service
    .from('intake_conversations')
    .select('id, total_exchanges')
    .eq('clinic_id', clinicId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (conv && conv.total_exchanges > 0) {
    // Resuming — generate context-aware continuation
    const { data: exchanges } = await service
      .from('intake_exchanges')
      .select('question_text, question_category, answer_text')
      .eq('conversation_id', conv.id)
      .order('exchange_order', { ascending: true })

    return generateFollowUpQuestion(exchanges as Exchange[] ?? [])
  }

  // Fresh start — pick from openers deterministically by clinic_id hash
  const idx = clinicId.charCodeAt(0) % OPENING_QUESTIONS.length
  return OPENING_QUESTIONS[idx]
}

export async function generateFollowUpQuestion(
  previousExchanges: Exchange[]
): Promise<{ question: string; category: QuestionCategory }> {
  if (!configured()) {
    return {
      question: "What words or phrases do your team members use when talking about patients that you'd want an AI to adopt — and are there any clinical terms you want to avoid in patient communications?",
      category: 'vocabulary',
    }
  }

  const recent = previousExchanges.slice(-5)
  const coveredCategories = new Set(previousExchanges.map(e => e.question_category))
  const allCategories: QuestionCategory[] = ['identity', 'philosophy', 'vocabulary', 'decision_thresholds', 'patient_journey', 'outcomes']
  const uncovered = allCategories.filter(c => !coveredCategories.has(c) && c !== 'follow_up')

  const exchangeText = recent
    .filter(e => e.answer_text)
    .map(e => `Q (${e.question_category}): ${e.question_text}\nA: ${e.answer_text}`)
    .join('\n\n')

  const nextCategory = uncovered.length > 0 ? uncovered[0] : 'follow_up'

  const prompt = `You are doing a deep intake interview with a chiropractor about their practice to train an AI assistant. Read their previous answers carefully.

PREVIOUS EXCHANGES:
${exchangeText || '(No answers yet)'}

NEXT FOCUS CATEGORY: ${nextCategory}
${uncovered.length === 0 ? '(All categories covered — ask a follow-up to deepen any previous answer)' : ''}

Ask ONE specific follow-up question that:
1. References something concrete the DC actually said (use their words)
2. Draws out clinical specificity — numbers, examples, contrarian views, specific patient types
3. Never asks multiple questions in one
4. Feels like a real clinical conversation, not a form

Output ONLY the question text — no preamble, no explanation. The question should be 1-3 sentences maximum.`

  const msg = await claude().messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages:   [{ role: 'user', content: prompt }],
  })

  const question = msg.content[0].type === 'text' ? msg.content[0].text.trim() : OPENING_QUESTIONS[0].question

  return { question, category: nextCategory as QuestionCategory }
}

export async function extractInsights(
  answerText: string,
  questionCategory: QuestionCategory,
  questionText: string
): Promise<ExtractedInsights> {
  const fallback: ExtractedInsights = {
    key_phrases: [], clinic_values: [], vocabulary: {}, numeric_thresholds: {},
    summary: answerText.slice(0, 120),
  }

  if (!configured() || !answerText.trim()) return fallback

  const prompt = `Extract structured insights from this chiropractor's intake answer.

Question (${questionCategory}): ${questionText}
Answer: ${answerText}

Output valid JSON only — no markdown, no explanation:
{
  "key_phrases": ["<2-5 word phrase that captures a core belief or approach>"],
  "clinic_values": ["<single value or principle, e.g. 'whole-person care', 'patient autonomy'>"],
  "vocabulary": {
    "preferred": ["<word/phrase the DC uses positively, should be used in AI output>"],
    "banned": ["<word/phrase the DC rejects or avoids>"]
  },
  "numeric_thresholds": { "<metric>": <number> },
  "summary": "<one sentence capturing the single most important thing this answer reveals>"
}`

  try {
    const msg = await claude().messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw  = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return JSON.parse(text) as ExtractedInsights
  } catch {
    return fallback
  }
}

export function assessDepth(exchanges: Exchange[]): number {
  if (exchanges.length === 0) return 0

  const answered = exchanges.filter(e => e.answer_text && e.answer_text.trim().length > 20)
  const coverageCategories = new Set(answered.map(e => e.question_category))
  const allCategories = ['identity', 'philosophy', 'vocabulary', 'decision_thresholds', 'patient_journey', 'outcomes']

  const coverageScore = (coverageCategories.size / allCategories.length) * 40
  const depthScore    = Math.min(answered.length * 5, 40)
  const avgLength     = answered.reduce((s, e) => s + (e.answer_text?.length ?? 0), 0) / Math.max(answered.length, 1)
  const richnessScore = Math.min((avgLength / 300) * 20, 20)

  return Math.round(coverageScore + depthScore + richnessScore)
}
