import 'server-only'

// AI provider: Anthropic Claude (claude-haiku-4-5).
// Used for morning briefing generation — stronger multi-constraint voice adherence than Groq/Llama.
// No-ops gracefully when ANTHROPIC_API_KEY is missing or starts with "placeholder".
// Message drafts remain on Groq (cheaper, sufficient for short 160-char SMS output).

import type {
  DeidentifiedPatient,
  ClinicContext,
  BriefingResult,
} from './gemini'

export type { DeidentifiedPatient, ClinicContext, BriefingResult }

const MODEL = 'claude-haiku-4-5-20251001'

function configured(): boolean {
  const k = process.env.ANTHROPIC_API_KEY
  return !!k && !k.startsWith('placeholder') && !k.startsWith('your_')
}

async function client() {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function extractBannedWords(notes: string): string {
  const banned: string[] = []
  const patterns = [
    /never (?:use|say)\s+["']?([^"'.,\n]+)["']?/gi,
    /avoid\s+(?:the\s+(?:word|phrase)\s+)?["']?([^"'.,\n]+)["']?/gi,
    /do not (?:use|say)\s+["']?([^"'.,\n]+)["']?/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(notes)) !== null) {
      banned.push(m[1].trim())
    }
  }
  return banned.length ? `Banned words/phrases (never use these): ${banned.map(b => `"${b}"`).join(', ')}` : ''
}

function buildVoiceRequirements(ctx: ClinicContext): string {
  const clinicName = ctx.clinic_name ?? 'this clinic'
  const lines: string[] = [
    `You are the AI assistant for ${clinicName}. Every word you write represents this clinic's voice and brand. The following are NON-NEGOTIABLE operating requirements — honor them in every sentence of your output.`,
    '',
  ]

  if (ctx.communication_style) {
    lines.push(`REQUIREMENT 1 — Communication tone: "${ctx.communication_style}".`)
    if (ctx.communication_style_notes) {
      lines.push(`  Style rules (follow verbatim): "${ctx.communication_style_notes}".`)
      const banned = extractBannedWords(ctx.communication_style_notes)
      if (banned) lines.push(`  ${banned}.`)
    }
    lines.push('')
  }

  if (ctx.red_flags) {
    lines.push(`REQUIREMENT 2 — This clinic's specific red flags: "${ctx.red_flags}".`)
    lines.push(`  Use THESE criteria to determine urgency — not generic heuristics.`)
    lines.push('')
  }

  if (ctx.what_successful_recovery_looks_like) {
    lines.push(`REQUIREMENT 3 — This clinic's definition of successful recovery: "${ctx.what_successful_recovery_looks_like}".`)
    lines.push(`  Reference this when discussing patient progress.`)
    lines.push('')
  }

  if (ctx.typical_care_plan_structure) {
    lines.push(`REQUIREMENT 4 — Care plan structure: "${ctx.typical_care_plan_structure}".`)
    lines.push(`  Frame all patient progress against THIS structure.`)
    lines.push('')
  }

  if (ctx.practice_philosophy) {
    lines.push(`REQUIREMENT 5 — Practice philosophy: "${ctx.practice_philosophy}".`)
    lines.push(`  Every suggested action must be consistent with this philosophy.`)
    lines.push('')
  }

  if (ctx.patient_demographics) {
    lines.push(`REQUIREMENT 6 — Typical patients: "${ctx.patient_demographics}". Write with this patient profile in mind.`)
    lines.push('')
  }

  if (ctx.practice_type) lines.push(`Practice type: ${ctx.practice_type}.`)
  if (ctx.typical_visit_frequency) lines.push(`Typical visit frequency: ${ctx.typical_visit_frequency}.`)
  if (ctx.what_makes_a_good_outcome) lines.push(`Good outcome defined as: ${ctx.what_makes_a_good_outcome}.`)

  return lines.join('\n')
}

function formatClinicContext(ctx: ClinicContext | null): string {
  if (!ctx) {
    return [
      'You are a morning briefing assistant for a busy chiropractor.',
      'No clinic profile has been set up yet — provide general chiropractic guidance.',
    ].join('\n')
  }
  return buildVoiceRequirements(ctx)
}

export async function generateBriefingClaude(
  patients: DeidentifiedPatient[],
  clinicCtx: ClinicContext | null = null,
): Promise<BriefingResult> {
  if (!configured()) {
    const callouts = patients
      .filter(p => {
        const sig = p.signal_today ?? p.signal_yesterday
        return sig !== null && sig < 55
      })
      .slice(0, 5)
      .map(p => {
        const sig = p.signal_today ?? p.signal_yesterday
        return {
          patient_ref:      p.ref,
          reason:           `Signal ${sig} — below 55 threshold`,
          suggested_action: 'Review recent check-ins and consider personal outreach',
        }
      })
    return {
      summary:  'AI not configured — add ANTHROPIC_API_KEY to enable morning briefings.',
      callouts,
    }
  }

  const voiceBlock = formatClinicContext(clinicCtx)
  const clinicName = clinicCtx?.clinic_name ?? 'this clinic'

  const prompt = `${voiceBlock}

---

Patient data (de-identified refs only — no real names):
${JSON.stringify(patients, null, 2)}

---

Output format — respond with valid JSON ONLY, no markdown fences, no explanation:
{
  "summary": "<one punchy sentence — how many patients need attention and the single most urgent reason>",
  "callouts": [
    {
      "patient_ref": "<exact ref from input>",
      "reason": "<one line — the concrete signal pattern: reference trend direction, days since last check-in, and where they are in their care journey>",
      "suggested_action": "<one specific, immediate action that reflects ${clinicName}'s care philosophy and plan structure — not a generic 'call today'>"
    }
  ]
}

Rules:
- Rank callouts: steepest signal decline first, then persistent low signal, then silence
- Only flag patients who genuinely need attention — skip stable, engaged patients
- reason must reference the actual numbers/trend (e.g. "dropped 21 pts over 7 days, still checking in")
- suggested_action MUST be specific to this clinic: reference their care plan structure, their recovery definition, or their outreach style — a generic action like "Call today — patient declining" is NOT acceptable
- No medical recommendations, treatment decisions, or diagnosis language

SELF-CHECK before returning: Read your output. Does each suggested_action sound like it came specifically from ${clinicName}, or could it apply to any clinic? If generic — rewrite it with a specific reference to this clinic's care plan or recovery goal.`

  const anthropic = await client()
  const message = await anthropic.messages.create({
    model:       MODEL,
    max_tokens:  700,
    messages:    [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return JSON.parse(text) as BriefingResult
}
