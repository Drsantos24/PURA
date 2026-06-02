import 'server-only'

// AI provider: Groq (llama-3.3-70b-versatile).
// Single point of contact — no other file imports groq-sdk directly.
// No-ops gracefully when GROQ_API_KEY is missing or starts with "placeholder".

export type DeidentifiedPatient = {
  ref:                  string           // "P-1", "P-2", etc. — no real names
  signal_today:         number | null
  signal_yesterday:     number | null
  signal_7day_avg:      number | null
  trend:                'improving' | 'stable' | 'declining' | 'no_data'
  last_checkin:         string | null    // "today" | "yesterday" | "3 days ago" | null
  days_without_checkin: number | null
}

export type BriefingCallout = {
  patient_ref:      string
  reason:           string
  suggested_action: string
}

export type BriefingResult = {
  summary:   string
  callouts:  BriefingCallout[]
}

// Operational clinic context — NOT PHI. Safe to send to AI in full.
export type ClinicContext = {
  clinic_name:                         string | null
  practice_type:                       string | null
  typical_care_plan_structure:         string | null
  what_successful_recovery_looks_like: string | null
  communication_style:                 string | null
  communication_style_notes:           string | null
  red_flags:                           string | null
  practice_philosophy:                 string | null
  patient_demographics:                string | null
  typical_visit_frequency:             string | null
  what_makes_a_good_outcome:           string | null
}

// Extract explicit "never use X" / "avoid X" bans from style notes
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
    lines.push(`  Use THESE criteria to determine urgency — not generic heuristics. A patient is a red flag only if they match this clinic's definition.`)
    lines.push('')
  }

  if (ctx.what_successful_recovery_looks_like) {
    lines.push(`REQUIREMENT 3 — This clinic's definition of successful recovery: "${ctx.what_successful_recovery_looks_like}".`)
    lines.push(`  Reference this when discussing patient progress. Frame declining patients against how far they are from this goal.`)
    lines.push('')
  }

  if (ctx.typical_care_plan_structure) {
    lines.push(`REQUIREMENT 4 — Care plan structure: "${ctx.typical_care_plan_structure}".`)
    lines.push(`  Frame all patient progress against THIS structure. Suggested actions should reference care plan milestones where relevant.`)
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

  if (ctx.practice_type) {
    lines.push(`Practice type: ${ctx.practice_type}.`)
  }
  if (ctx.typical_visit_frequency) {
    lines.push(`Typical visit frequency: ${ctx.typical_visit_frequency}.`)
  }
  if (ctx.what_makes_a_good_outcome) {
    lines.push(`Good outcome defined as: ${ctx.what_makes_a_good_outcome}.`)
  }

  return lines.filter(l => l !== undefined).join('\n')
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

function configured(): boolean {
  const k = process.env.GROQ_API_KEY
  return !!k && !k.startsWith('placeholder') && !k.startsWith('your_')
}

async function client() {
  const { default: Groq } = await import('groq-sdk')
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

const MODEL = 'llama-3.3-70b-versatile'

export async function generateBriefing(
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
      summary:  'AI not configured — add GROQ_API_KEY to enable morning briefings.',
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

  const groq = await client()
  const completion = await groq.chat.completions.create({
    model:       MODEL,
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens:  700,
  })
  const text = completion.choices[0].message.content?.trim() ?? ''
  return JSON.parse(text) as BriefingResult
}

export async function generateMessageDraft(
  patient: DeidentifiedPatient,
  clinicCtx: ClinicContext | null = null,
): Promise<string> {
  if (!configured()) {
    const notIn = patient.days_without_checkin && patient.days_without_checkin > 1
      ? `We haven't heard from you in a few days. `
      : ''
    return `Hi [Name], just wanted to check in — we noticed things haven't been tracking as well lately. ${notIn}Would love to find a time this week for a quick visit or call. We're here for you! — [Clinic]`
  }

  const declining = patient.trend === 'declining'
  const silent = patient.days_without_checkin !== null && patient.days_without_checkin >= 3

  const situation = declining && !silent
    ? `The patient has been checking in but their recovery is trending in the wrong direction. The DC wants to personally reach out, express genuine concern, and get them in the office this week.`
    : silent
    ? `The patient has gone quiet for ${patient.days_without_checkin} days. The DC wants to warmly re-engage them — ask how they're doing and get a real reply or a call back, not just an open invitation.`
    : `The patient could use a warm check-in to keep them engaged with their care.`

  const voiceBlock = formatClinicContext(clinicCtx)
  const clinicName = clinicCtx?.clinic_name ?? 'this clinic'

  const prompt = `${voiceBlock}

---

Situation: ${situation}
${clinicCtx?.typical_care_plan_structure ? `\nCare plan context: ${clinicCtx.typical_care_plan_structure}` : ''}

Write a single SMS from ${clinicName} to a patient. Requirements:
- Under 280 characters total
- Sound like a real person texting — match the communication tone in REQUIREMENT 1 exactly
- If the style is warm: use [Name], acknowledge their effort, be personal
- If style notes say never use certain words — do not use them
- No metrics, scores, app data, or clinical jargon
- CTA must feel specific and immediate: "this week", "give us a call today", "reply and let us know how you're doing" — not "soon" or "when you're free"
- Use [Name] for patient first name, [Clinic] for clinic name
- Output ONLY the SMS text — no quotes, no explanation, no label`

  const groq = await client()
  const completion = await groq.chat.completions.create({
    model:       MODEL,
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens:  120,
  })
  return completion.choices[0].message.content?.trim() ?? ''
}
