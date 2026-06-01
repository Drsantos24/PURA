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

function formatClinicContext(ctx: ClinicContext | null): string {
  if (!ctx) return 'CLINIC CONTEXT: No clinic profile has been set up yet. Provide general chiropractic guidance.'

  const lines = [
    `CLINIC CONTEXT (operational details about this practice — not patient data):`,
    ctx.practice_type                       ? `- Practice type: ${ctx.practice_type}` : null,
    ctx.patient_demographics                ? `- Typical patients: ${ctx.patient_demographics}` : null,
    ctx.typical_visit_frequency             ? `- Visit frequency: ${ctx.typical_visit_frequency}` : null,
    ctx.typical_care_plan_structure         ? `- Care plan structure: ${ctx.typical_care_plan_structure}` : null,
    ctx.what_successful_recovery_looks_like ? `- Successful recovery looks like: ${ctx.what_successful_recovery_looks_like}` : null,
    ctx.what_makes_a_good_outcome           ? `- Good outcome defined as: ${ctx.what_makes_a_good_outcome}` : null,
    ctx.red_flags                           ? `- Red flags to watch for: ${ctx.red_flags}` : null,
    ctx.practice_philosophy                 ? `- Practice philosophy: ${ctx.practice_philosophy}` : null,
    ctx.communication_style                 ? `- Communication style: ${ctx.communication_style}${ctx.communication_style_notes ? ` — ${ctx.communication_style_notes}` : ''}` : null,
  ].filter(Boolean)

  return lines.join('\n')
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

  const contextBlock = formatClinicContext(clinicCtx)

  const prompt = `You are a morning briefing assistant for a busy chiropractor. You get de-identified patient data and produce a fast, scannable summary the DC reads in under 10 seconds.

${contextBlock}

Patient data (de-identified refs only — no real names in this data):
${JSON.stringify(patients, null, 2)}

Respond with valid JSON only — no markdown fences, no explanation, exactly this shape:
{
  "summary": "<one punchy sentence: how many patients need attention and why>",
  "callouts": [
    {
      "patient_ref": "<ref from input, exact match>",
      "reason": "<one line — the concrete signal pattern that flags this patient>",
      "suggested_action": "<one line — what the DC should do right now: call, text, schedule visit>"
    }
  ]
}

Priorities:
- Use the clinic context to make your guidance specific to this practice (e.g. reference their care plan milestones, their red-flag definitions, their communication style)
- Rank callouts by urgency: steepest decline first, then low signal, then gone silent
- Only include patients who genuinely need attention today — skip anyone stable and engaged
- Reason must reference the trend pattern (e.g. "dropped 21 points over the week, checked in today"), not just restate the label
- Suggested action should be specific and immediate (e.g. "Call today — patient is present and declining fast")
- Tone should match the practice's communication style from the clinic context
- No medical recommendations, treatment decisions, or diagnosis language`

  const groq = await client()
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 600,
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
    ? `The patient has been checking in but their recovery has been trending in the wrong direction lately. The DC wants to personally reach out, express genuine concern, and get them in the office this week.`
    : silent
    ? `The patient has gone quiet for ${patient.days_without_checkin} days. The DC wants to warmly re-engage them — ask how they're doing and get a reply or call back, not just an open invite.`
    : `The patient could use a warm check-in to keep them engaged with their care.`

  const contextBlock = formatClinicContext(clinicCtx)

  const prompt = `Write a single SMS from a chiropractor to a patient.

${contextBlock}

Situation: ${situation}

Requirements:
- Under 280 characters
- Sound like a real person texting — warm, direct, human
- Match the communication style from the clinic context exactly (e.g. if warm: use first name, acknowledge effort; if formal: more professional tone)
- No metrics, scores, app data, or clinical jargon
- Do NOT say "soon" or "when you're free" — the CTA should feel specific: "this week", "give us a call", "reply and let us know"
- Use [Name] for patient first name, [Clinic] for clinic name
- Output ONLY the SMS text — no quotes, no explanation`

  const groq = await client()
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 120,
  })
  return completion.choices[0].message.content?.trim() ?? ''
}
