import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  generateOpeningQuestion,
  generateFollowUpQuestion,
  extractInsights,
  assessDepth,
  type Exchange,
} from '@/lib/intake/questions'
import { syncInsightsToProfile } from '@/lib/intake/sync'

// GET /api/intake — returns current conversation state + next question
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const service = createServiceClient()

  // Find or create conversation
  let { data: conv } = await service
    .from('intake_conversations')
    .select('id, total_exchanges')
    .eq('clinic_id', member.clinic_id)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv) {
    const { data: newConv } = await service
      .from('intake_conversations')
      .insert({ clinic_id: member.clinic_id })
      .select('id, total_exchanges')
      .single()
    conv = newConv
  }

  if (!conv) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })

  // Fetch existing exchanges
  const { data: exchanges } = await service
    .from('intake_exchanges')
    .select('exchange_order, question_text, question_category, answer_text')
    .eq('conversation_id', conv.id)
    .order('exchange_order', { ascending: true })

  const typedExchanges = (exchanges ?? []) as Exchange[]
  const depth = assessDepth(typedExchanges)

  // Generate next question
  const lastAnswered = typedExchanges.filter(e => e.answer_text)
  const nextQ = lastAnswered.length === 0
    ? await generateOpeningQuestion(member.clinic_id)
    : await generateFollowUpQuestion(typedExchanges)

  // Check if there's already an unanswered question waiting
  const unanswered = typedExchanges.find(e => !e.answer_text)

  return NextResponse.json({
    conversationId: conv.id,
    exchanges: typedExchanges,
    nextQuestion: unanswered
      ? { question: unanswered.question_text, category: unanswered.question_category, exchangeId: null }
      : { question: nextQ.question, category: nextQ.category, exchangeId: null },
    depthScore: depth,
    totalExchanges: typedExchanges.length,
  })
}

// POST /api/intake — submit an answer + get next question
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members').select('clinic_id, role')
    .eq('user_email', user.email!).eq('status', 'active').limit(1).maybeSingle()
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const body = await req.json()
  const { conversationId, question, category, answer, skip } = body

  const service = createServiceClient()

  // Save the exchange
  const { data: exchanges } = await service
    .from('intake_exchanges')
    .select('exchange_order')
    .eq('conversation_id', conversationId)
    .order('exchange_order', { ascending: false })
    .limit(1)

  const nextOrder = ((exchanges?.[0]?.exchange_order ?? -1) + 1)

  let insights = null
  if (!skip && answer?.trim()) {
    insights = await extractInsights(answer, category, question)
    await syncInsightsToProfile(member.clinic_id, insights, category)
  }

  await service.from('intake_exchanges').insert({
    conversation_id:      conversationId,
    exchange_order:       nextOrder,
    question_text:        question,
    question_category:    category,
    answer_text:          skip ? null : answer,
    ai_extracted_insights: insights,
  })

  // Update conversation count
  await service.from('intake_conversations')
    .update({ total_exchanges: nextOrder + 1 })
    .eq('id', conversationId)

  // Fetch all exchanges so far for next question generation
  const { data: allExchanges } = await service
    .from('intake_exchanges')
    .select('exchange_order, question_text, question_category, answer_text')
    .eq('conversation_id', conversationId)
    .order('exchange_order', { ascending: true })

  const typed = (allExchanges ?? []) as Exchange[]
  const depth = assessDepth(typed)

  // Generate next question (skip generates an alternative)
  const nextQ = await generateFollowUpQuestion(typed)

  return NextResponse.json({
    ok: true,
    insights,
    nextQuestion: { question: nextQ.question, category: nextQ.category },
    depthScore: depth,
    totalExchanges: typed.length,
  })
}

// PATCH /api/intake — mark conversation complete
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json()
  const service = createServiceClient()
  await service.from('intake_conversations')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', conversationId)

  return NextResponse.json({ ok: true })
}
