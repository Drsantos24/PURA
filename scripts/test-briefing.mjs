// One-shot test: calls Groq with realistic de-identified patient data,
// evaluates output quality, and shows final result. No DB connection needed.
import Groq from 'groq-sdk'
import { readFileSync } from 'fs'

// Read key from .env.local
const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const groqKey = envRaw.match(/^GROQ_API_KEY=(\S+)/m)?.[1]?.trim()

if (!groqKey || groqKey.startsWith('placeholder')) {
  console.error('GROQ_API_KEY not set in .env.local')
  process.exit(1)
}

const groq = new Groq({ apiKey: groqKey })
const MODEL = 'llama-3.3-70b-versatile'

// Realistic test data — de-identified, no PHI
// Arturo: declining fast, checked in today — urgent
// Paulina: stable but 3 days silent — re-engagement nudge
const patients = [
  {
    ref: 'P-1',
    signal_today: 41,
    signal_yesterday: 48,
    signal_7day_avg: 62,
    trend: 'declining',
    last_checkin: 'today',
    days_without_checkin: 0,
  },
  {
    ref: 'P-2',
    signal_today: null,
    signal_yesterday: 71,
    signal_7day_avg: 69,
    trend: 'stable',
    last_checkin: '3 days ago',
    days_without_checkin: 3,
  },
]

// PHI injected AFTER Groq call — never sent to API
const refToName  = { 'P-1': 'Arturo', 'P-2': 'Paulina' }
const clinicName = 'Santos Ventures Test Clinic'

async function chat(prompt, maxTokens = 600, temp = 0.3) {
  const c = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: temp,
    max_tokens: maxTokens,
  })
  return c.choices[0].message.content?.trim() ?? ''
}

const briefingPrompt = (pts) => `You are a morning briefing assistant for a busy chiropractor. You get de-identified patient data and produce a fast, scannable summary the DC reads in under 10 seconds.

Patient data (de-identified refs only — do not invent names or details):
${JSON.stringify(pts, null, 2)}

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
- Rank callouts by urgency: steepest decline first, then low signal, then gone silent
- Only include patients who genuinely need attention today — skip anyone stable and engaged
- Reason must reference the trend pattern (e.g. "dropped 21 points over the week, checked in today"), not just restate the label
- Suggested action should be specific and immediate (e.g. "Call today — patient is present and declining fast")
- Tone: direct, clinical-warm — like a good MA briefing a DC before morning rounds
- No medical recommendations, treatment decisions, or diagnosis language`

const messagePrompt = (pt) => {
  const declining = pt.trend === 'declining'
  const silent = pt.days_without_checkin !== null && pt.days_without_checkin >= 3

  const situation = declining && !silent
    ? `The patient has been checking in but their recovery has been trending in the wrong direction lately. The DC wants to personally reach out, express genuine concern, and get them in the office this week.`
    : silent
    ? `The patient has gone quiet for ${pt.days_without_checkin} days. The DC wants to warmly re-engage them — ask how they're doing and get a reply or call back, not just an open invite.`
    : `The patient could use a warm check-in to keep them engaged with their care.`

  return `Write a single SMS from a chiropractor to a patient. Situation: ${situation}

Requirements:
- Under 280 characters
- Sound like a real person texting — warm, direct, human
- No metrics, scores, app data, or clinical jargon
- Do NOT say "soon" or "when you're free" — the CTA should feel specific: "this week", "give us a call", "reply and let us know"
- Use [Name] for patient first name, [Clinic] for clinic name
- Output ONLY the SMS text — no quotes, no explanation`
}

async function run() {
  console.log('=== PHI CHECK — this is what goes to Groq (no names) ===')
  console.log(JSON.stringify(patients, null, 2))

  // Briefing
  console.log('\n=== BRIEFING ===')
  const briefingRaw = await chat(briefingPrompt(patients))
  let briefing
  try {
    briefing = JSON.parse(briefingRaw)
  } catch {
    console.error('JSON parse failed:\n', briefingRaw)
    process.exit(1)
  }
  console.log('Summary:', briefing.summary)
  for (const c of briefing.callouts) {
    console.log(`\n[${c.patient_ref}] ${c.reason}`)
    console.log('  →', c.suggested_action)
  }

  // Message drafts
  console.log('\n=== MESSAGE DRAFTS ===')
  for (const p of patients) {
    const raw = await chat(messagePrompt(p), 120, 0.5)
    const final = raw
      .replace(/\[Name\]/g,   refToName[p.ref])
      .replace(/\[Clinic\]/g, clinicName)
    console.log(`\n--- ${refToName[p.ref]} ---`)
    console.log(final)
    console.log(`(${final.length} chars)`)
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })
