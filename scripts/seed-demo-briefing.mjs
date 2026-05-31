// Generates demo briefing + message drafts for Vitality Spine & Wellness.
// Outputs INSERT SQL that gets pasted into Supabase MCP.
import Groq from 'groq-sdk'
import { readFileSync } from 'fs'

const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const groqKey = envRaw.match(/^GROQ_API_KEY=(\S+)/m)?.[1]
if (!groqKey || groqKey.startsWith('placeholder')) { console.error('No GROQ_API_KEY'); process.exit(1) }

const groq = new Groq({ apiKey: groqKey })
const MODEL = 'llama-3.3-70b-versatile'
const CLINIC_ID = '95386a93-a473-438d-bb25-c23bcf2d72df'

// De-identified payload — all 25 patients, refs only
const patients = [
  { ref:'P-01', signal_today:39,  signal_yesterday:51,  signal_7day_avg:59, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-02', signal_today:39,  signal_yesterday:39,  signal_7day_avg:59, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-03', signal_today:45,  signal_yesterday:47,  signal_7day_avg:50, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-04', signal_today:48,  signal_yesterday:50,  signal_7day_avg:53, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-05', signal_today:49,  signal_yesterday:45,  signal_7day_avg:50, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-06', signal_today:52,  signal_yesterday:48,  signal_7day_avg:53, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-07', signal_today:53,  signal_yesterday:56,  signal_7day_avg:56, trend:'declining', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-08', signal_today:null,signal_yesterday:null, signal_7day_avg:63, trend:'stable',   last_checkin:'5 days ago', days_without_checkin:5 },
  { ref:'P-09', signal_today:null,signal_yesterday:null, signal_7day_avg:63, trend:'stable',   last_checkin:'5 days ago', days_without_checkin:5 },
  { ref:'P-10', signal_today:null,signal_yesterday:null, signal_7day_avg:65, trend:'stable',   last_checkin:'5 days ago', days_without_checkin:5 },
  { ref:'P-11', signal_today:60,  signal_yesterday:60,  signal_7day_avg:59, trend:'volatile',  last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-12', signal_today:67,  signal_yesterday:68,  signal_7day_avg:69, trend:'stable',   last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-13', signal_today:68,  signal_yesterday:74,  signal_7day_avg:70, trend:'stable',   last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-14', signal_today:73,  signal_yesterday:71,  signal_7day_avg:73, trend:'stable',   last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-15', signal_today:73,  signal_yesterday:71,  signal_7day_avg:73, trend:'stable',   last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-16', signal_today:77,  signal_yesterday:77,  signal_7day_avg:71, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-17', signal_today:78,  signal_yesterday:76,  signal_7day_avg:76, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-18', signal_today:78,  signal_yesterday:78,  signal_7day_avg:76, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-19', signal_today:78,  signal_yesterday:78,  signal_7day_avg:72, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-20', signal_today:78,  signal_yesterday:78,  signal_7day_avg:72, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-21', signal_today:81,  signal_yesterday:80,  signal_7day_avg:74, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-22', signal_today:81,  signal_yesterday:80,  signal_7day_avg:74, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-23', signal_today:82,  signal_yesterday:82,  signal_7day_avg:76, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-24', signal_today:87,  signal_yesterday:87,  signal_7day_avg:81, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
  { ref:'P-25', signal_today:87,  signal_yesterday:87,  signal_7day_avg:81, trend:'improving', last_checkin:'today',      days_without_checkin:0 },
]

// Ref → real patient info (for re-identification after Groq call)
const refMap = {
  'P-01':{ id:'08c89ebf-0266-4b9a-bfae-898c549247a8', name:'Dani' },
  'P-02':{ id:'38726a74-3ea4-4cd8-9968-b16f09898ec7', name:'Yuki' },
  'P-03':{ id:'116da1ba-59f4-4ba1-92ab-5114c3ade811', name:'Isabelle' },
  'P-04':{ id:'3fd7716b-5e06-4180-a524-54c309f75a5f', name:'Noah' },
  'P-05':{ id:'6f21bd4f-6cc8-4e4a-aa47-db7558ef5a1e', name:'Grace' },
  'P-06':{ id:'18e5c554-ac5a-40fc-bd0d-3dcdc6c9c69d', name:'Victor' },
  'P-07':{ id:'085b8bda-ff58-4b4c-b552-4090f8a00544', name:'Andre' },
  'P-08':{ id:'2c034122-c5d4-4d30-b437-4d9c2d0e6635', name:'Carlos' },
  'P-09':{ id:'5455c29a-fb67-4615-bd35-c4929db554ba', name:'Brianna' },
  'P-10':{ id:'597d95cb-1205-41d7-856d-c165205465fb', name:'Maya' },
  'P-11':{ id:'c944a788-7dd8-459d-ab42-9a5ef1e19a69', name:'Leon' },
  'P-12':{ id:'628d27e2-50ca-4855-bd5d-35b647d7c62f', name:'Hannah' },
  'P-13':{ id:'68f75639-e451-4651-bf0a-a1f2697186ee', name:'Sofia' },
  'P-14':{ id:'9d5b633f-3ec5-4e30-92e3-10dc85eff1a9', name:'Richard' },
  'P-15':{ id:'49c9ab24-c230-4c0d-b802-d1a1d03fdeab', name:'Caitlin' },
  'P-16':{ id:'57822141-204f-4a00-a857-13bfa418d613', name:'Priya' },
  'P-17':{ id:'01e9454e-403f-4f49-8f60-218517e4d14d', name:'Derek' },
  'P-18':{ id:'0e9c48b6-b63f-4b54-bdcf-c3b3a2c83521', name:'Omar' },
  'P-19':{ id:'3a757d8c-65c8-408e-9921-9b538b55ca40', name:'James' },
  'P-20':{ id:'8654e6d8-797d-40f7-9170-de60f9f08993', name:'Amara' },
  'P-21':{ id:'5b589cc6-2cd5-45c8-8154-ecece293832e', name:'Ethan' },
  'P-22':{ id:'340015e0-8da4-4b60-99de-3506562cfa41', name:'Lucia' },
  'P-23':{ id:'d8d3b5e4-9194-4941-b9c6-f115fa373f2f', name:'Marcus' },
  'P-24':{ id:'f947e199-e7b4-4dd0-9589-32e0a4d9a7ba', name:'Natalie' },
  'P-25':{ id:'fac3211e-3773-4871-8efb-d58fe1949403', name:'Tyler' },
}

async function chat(prompt, maxTokens=800, temp=0.3) {
  const c = await groq.chat.completions.create({
    model: MODEL,
    messages:[{ role:'user', content:prompt }],
    temperature: temp, max_tokens: maxTokens,
  })
  return c.choices[0].message.content?.trim() ?? ''
}

function esc(s) { return s.replace(/'/g, "''") }

async function run() {
  // ── Briefing ─────────────────────────────────────────────────────────────
  const briefingPrompt = `You are a morning briefing assistant for a busy chiropractor at Vitality Spine & Wellness.

Patient cohort (25 patients, de-identified refs only — do not invent names or details):
${JSON.stringify(patients, null, 2)}

Produce a morning briefing. Respond with valid JSON only — no markdown fences:
{
  "summary": "<one punchy sentence: how many need attention and the key story today>",
  "callouts": [
    {
      "patient_ref": "<exact ref>",
      "reason": "<one line — concrete signal pattern, not just the label>",
      "suggested_action": "<one line — specific immediate action>"
    }
  ]
}

Rules:
- Up to 5 callouts, ranked: red-zone declining first, then dropped-off silent patients, then volatile
- Reason must cite the actual trend (e.g. "dropped 20 points vs 7-day avg, in red zone today")
- Action should be specific: "Call today", "Send check-in text", "Schedule urgent visit"
- Skip patients who are stable or improving — they don't need attention today
- Tone: direct clinical-warm, like a good MA briefing a DC before morning rounds
- No medical recommendations or diagnosis language`

  console.log('\n=== CALLING GROQ: BRIEFING ===')
  const briefingRaw = await chat(briefingPrompt)
  let briefing
  try { briefing = JSON.parse(briefingRaw) }
  catch { console.error('Briefing JSON parse failed:\n', briefingRaw); process.exit(1) }

  console.log('\nSUMMARY:', briefing.summary)
  console.log('\nCALLOUTS:')
  for (const c of briefing.callouts) {
    console.log(`  [${c.patient_ref}] ${c.reason}`)
    console.log(`   → ${c.suggested_action}`)
  }

  // Build stored callouts (re-identify refs → patient IDs)
  const storedCallouts = briefing.callouts
    .filter(c => refMap[c.patient_ref])
    .map(c => ({ patient_id: refMap[c.patient_ref].id, reason: c.reason, suggested_action: c.suggested_action }))

  // ── Message drafts ────────────────────────────────────────────────────────
  // Draft for: red zone (<55) + dropped off (>3 days)
  const draftTargets = patients.filter(p => {
    const sig = p.signal_today ?? p.signal_yesterday
    const redZone = sig !== null && sig < 55
    const bigDrop = sig !== null && p.signal_7day_avg !== null && (p.signal_7day_avg - sig) >= 15
    const droppedOff = p.days_without_checkin !== null && p.days_without_checkin >= 3
    return redZone || bigDrop || droppedOff
  })

  const drafts = []
  for (const p of draftTargets) {
    const info = refMap[p.ref]
    if (!info) continue

    const declining = p.trend === 'declining'
    const silent = p.days_without_checkin >= 3
    const situation = declining && !silent
      ? `The patient has been checking in but their recovery has been trending in the wrong direction for weeks — their score is now critically low. The DC wants to reach out personally, express genuine concern, and get them in this week.`
      : silent
      ? `The patient has been silent for ${p.days_without_checkin} days with no check-in. The DC wants to warmly re-engage — ask how they're doing and invite a reply or call, not just an open invite.`
      : `The patient's scores have dropped sharply vs their recent average. The DC wants to check in and encourage them.`

    const msgPrompt = `Write a single SMS from a chiropractor to a patient. Situation: ${situation}

Requirements:
- Under 280 characters
- Sound like a real person texting — warm, direct, human
- No numbers, scores, metrics, or clinical jargon
- Do NOT say "soon" or "when you're free" — use a specific CTA: "this week", "give us a call", "reply and let us know"
- Use [Name] for patient first name, [Clinic] for clinic name
- Output ONLY the SMS text — no quotes, no explanation`

    const rawDraft = await chat(msgPrompt, 120, 0.5)
    const finalDraft = rawDraft
      .replace(/\[Name\]/g, info.name)
      .replace(/\[Clinic\]/g, 'Vitality Spine & Wellness')

    drafts.push({ patient_id: info.id, ref: p.ref, name: info.name, body: finalDraft })
    console.log(`\n--- Draft: ${info.name} (${p.ref}) ---`)
    console.log(finalDraft)
    console.log(`(${finalDraft.length} chars)`)
  }

  // ── Output SQL for insertion ──────────────────────────────────────────────
  console.log('\n\n=== SQL TO INSERT INTO SUPABASE ===\n')

  const calloutsJson = JSON.stringify(storedCallouts).replace(/'/g, "''")
  console.log(`-- BRIEFING`)
  console.log(`INSERT INTO briefings (clinic_id, summary_text, patient_callouts)`)
  console.log(`VALUES ('${CLINIC_ID}', '${esc(briefing.summary)}', '${calloutsJson}')`)
  console.log(`RETURNING id;\n`)

  console.log(`-- MESSAGE DRAFTS`)
  for (const d of drafts) {
    console.log(`INSERT INTO message_drafts (clinic_id, patient_id, body_text, status)`)
    console.log(`VALUES ('${CLINIC_ID}', '${d.patient_id}', '${esc(d.body)}', 'pending');`)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
