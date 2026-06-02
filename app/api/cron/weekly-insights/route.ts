import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAggregation } from '@/lib/learning/aggregator'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await runWeeklyAggregation()

    const founderEmail = process.env.FOUNDER_EMAIL
    // Log the weekly summary — wire up an email provider here when ready
    console.log('[PURA Weekly Insights]', {
      to:      founderEmail,
      subject: `PURA learned this week (${summary.weekStart})`,
      body:    [
        `Total feedback events: ${summary.totalFeedback} across ${summary.clinicsContributing} clinic(s)`,
        `Approval rate: ${Math.round(summary.approvalRate * 100)}%`,
        `Edit rate:     ${Math.round(summary.editRate * 100)}%`,
        `Dismiss rate:  ${Math.round(summary.dismissalRate * 100)}%`,
        `Ignored rate:  ${Math.round(summary.ignoredRate * 100)}%`,
        summary.avgEditDistance != null ? `Avg edit distance: ${summary.avgEditDistance} chars` : null,
        '',
        'Patterns identified:',
        ...summary.patterns.map(p => `  • ${p}`),
        '',
        `Insights written to pura_learning_insights: ${summary.insightsWritten}`,
        `Review at: ${process.env.NEXT_PUBLIC_APP_URL}/admin/learning`,
      ].filter(Boolean).join('\n'),
    })

    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[weekly-insights] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
