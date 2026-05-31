#!/usr/bin/env node
// reset-demo.mjs — Resets Vitality Spine & Wellness to pristine demo state.
// Run: node scripts/reset-demo.mjs
// Takes ~30s (Groq call for fresh briefing + drafts)

import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = (key) => envRaw.match(new RegExp(`^${key}=(\\S+)`, 'm'))?.[1]

const SUPABASE_URL     = get('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY      = get('SUPABASE_SERVICE_ROLE_KEY')
const GROQ_KEY         = get('GROQ_API_KEY')
const CLINIC_ID        = '95386a93-a473-438d-bb25-c23bcf2d72df'
const DEMO_LIVE_PID    = '154af0a9-d55f-41cc-95bb-47917fe556c6'  // Demo Live - Joshua
const CLINIC_NAME      = 'Vitality Spine & Wellness'

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env vars'); process.exit(1) }
if (!GROQ_KEY || GROQ_KEY.startsWith('placeholder')) { console.error('Missing GROQ_API_KEY'); process.exit(1) }

const db   = createClient(SUPABASE_URL, SERVICE_KEY)
const groq = new Groq({ apiKey: GROQ_KEY })
const MODEL = 'llama-3.3-70b-versatile'

// ── Patient roster ────────────────────────────────────────────────────────────
// 25 regular + Demo Live Joshua. UUIDs match what was inserted during seeding.
const PATIENTS = [
  // id, first_name, group, offset
  { id:'d8d3b5e4-9194-4941-b9c6-f115fa373f2f', name:'Marcus',   group:'recovery',  off: 0 },
  { id:'57822141-204f-4a00-a857-13bfa418d613', name:'Priya',    group:'recovery',  off: 1 },
  { id:'fac3211e-3773-4871-8efb-d58fe1949403', name:'Tyler',    group:'recovery',  off:-1 },
  { id:'340015e0-8da4-4b60-99de-3506562cfa41', name:'Lucia',    group:'recovery',  off: 1 },
  { id:'3a757d8c-65c8-408e-9921-9b538b55ca40', name:'James',    group:'recovery',  off: 0 },
  { id:'f947e199-e7b4-4dd0-9589-32e0a4d9a7ba', name:'Natalie',  group:'recovery',  off:-1 },
  { id:'5b589cc6-2cd5-45c8-8154-ecece293832e', name:'Ethan',    group:'recovery',  off: 1 },
  { id:'8654e6d8-797d-40f7-9170-de60f9f08993', name:'Amara',    group:'recovery',  off: 0 },
  { id:'9d5b633f-3ec5-4e30-92e3-10dc85eff1a9', name:'Richard',  group:'stable',    off: 0 },
  { id:'68f75639-e451-4651-bf0a-a1f2697186ee', name:'Sofia',    group:'stable',    off: 1 },
  { id:'01e9454e-403f-4f49-8f60-218517e4d14d', name:'Derek',    group:'stable',    off:-1 },
  { id:'628d27e2-50ca-4855-bd5d-35b647d7c62f', name:'Hannah',   group:'stable',    off: 1 },
  { id:'0e9c48b6-b63f-4b54-bdcf-c3b3a2c83521', name:'Omar',     group:'stable',    off:-1 },
  { id:'49c9ab24-c230-4c0d-b802-d1a1d03fdeab', name:'Caitlin',  group:'stable',    off: 0 },
  { id:'18e5c554-ac5a-40fc-bd0d-3dcdc6c9c69d', name:'Victor',   group:'declining', off: 0 },
  { id:'116da1ba-59f4-4ba1-92ab-5114c3ade811', name:'Isabelle', group:'declining', off: 1 },
  { id:'085b8bda-ff58-4b4c-b552-4090f8a00544', name:'Andre',    group:'declining', off:-1 },
  { id:'6f21bd4f-6cc8-4e4a-aa47-db7558ef5a1e', name:'Grace',    group:'declining', off: 1 },
  { id:'3fd7716b-5e06-4180-a524-54c309f75a5f', name:'Noah',     group:'declining', off: 0 },
  { id:'08c89ebf-0266-4b9a-bfae-898c549247a8', name:'Dani',     group:'volatile',  off: 0 },
  { id:'c944a788-7dd8-459d-ab42-9a5ef1e19a69', name:'Leon',     group:'volatile',  off: 2 },
  { id:'38726a74-3ea4-4cd8-9968-b16f09898ec7', name:'Yuki',     group:'volatile',  off:-1 },
  { id:'5455c29a-fb67-4615-bd35-c4929db554ba', name:'Brianna',  group:'droppedoff',off: 0 },
  { id:'2c034122-c5d4-4d30-b437-4d9c2d0e6635', name:'Carlos',   group:'droppedoff',off: 1 },
  { id:'597d95cb-1205-41d7-856d-c165205465fb', name:'Maya',     group:'droppedoff',off:-1 },
  // Demo Live patient (declining trajectory, real phone)
  { id: DEMO_LIVE_PID,                         name:'Joshua',   group:'demo_live', off: 0 },
]

// ── Check-in value generators (match the original DO block exactly) ───────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function checkinValues(group, dayOffset, patientIdx, off) {
  const df = dayOffset / 20
  const i  = patientIdx + 1
  switch (group) {
    case 'recovery': {
      const n = ((i + dayOffset * 3) % 3) - 1
      return {
        pain: clamp(Math.round(7 - 5*df) + n + off, 0, 10),
        sq:   clamp(Math.round(5 + 3*df) - n,       0, 10),
        sh:   clamp(5.5 + 2.0*df + n*0.4,           4.5, 9.0),
        en:   clamp(Math.round(4 + 4*df) + n,        0, 10),
        st:   clamp(Math.round(7 - 5*df) + n - off,  0, 10),
        fn:   clamp(Math.round(4 + 4*df) - n,        0, 10),
        md:   clamp(Math.round(4 + 4*df) + n,        0, 10),
      }
    }
    case 'stable': {
      const n = ((i * 7 + dayOffset * 4) % 5) - 2
      return {
        pain: clamp(3 + n + off, 1, 5),
        sq:   clamp(7 - n,       5, 10),
        sh:   clamp(7.0 + n*0.3, 6.0, 8.5),
        en:   clamp(7 + n,       5, 10),
        st:   clamp(3 + n,       1, 6),
        fn:   clamp(7 + n - off, 5, 10),
        md:   clamp(7 + n,       5, 10),
      }
    }
    case 'declining': {
      const n = ((i + dayOffset * 5) % 3) - 1
      return {
        pain: clamp(Math.round(3 + 2*df) + n + off, 1, 10),
        sq:   clamp(Math.round(7 - 2*df) + n,       1, 10),
        sh:   clamp(7.0 - 1.0*df + n*0.3,           4.5, 8.5),
        en:   clamp(Math.round(7 - 3*df) + n,        1, 10),
        st:   clamp(Math.round(3 + 3*df) + n,        1, 10),
        fn:   clamp(Math.round(7 - 3*df) + n,        1, 10),
        md:   clamp(Math.round(7 - 2*df) + n - off,  1, 10),
      }
    }
    case 'volatile': {
      const n = ((dayOffset + off + i) % 7)
      if (n <= 1)      return { pain:7, sq:4, sh:5.5, en:3, st:7, fn:4, md:4 }
      else if (n <= 3) return { pain:4, sq:6, sh:6.5, en:5, st:5, fn:5, md:6 }
      else if (n <= 5) return { pain:2, sq:8, sh:7.5, en:8, st:2, fn:8, md:8 }
      else             return { pain:5, sq:5, sh:6.0, en:4, st:6, fn:5, md:5 }
    }
    case 'demo_live': {
      // Declining trajectory for Joshua
      return {
        pain: clamp(Math.round(3 + 3*df),   1, 10),
        sq:   clamp(Math.round(8 - 3*df),   1, 10),
        sh:   clamp(7.5 - 1.5*df,           5.0, 8.5),
        en:   clamp(Math.round(8 - 4*df),   1, 10),
        st:   clamp(Math.round(3 + 4*df),   1, 10),
        fn:   clamp(Math.round(8 - 4*df),   1, 10),
        md:   clamp(Math.round(8 - 3*df),   1, 10),
      }
    }
    case 'droppedoff': {
      // Only generates up to dayOffset 15 — caller handles the cutoff
      const n = ((i * 4 + dayOffset * 3) % 5) - 2
      return {
        pain: clamp(4 + n + off, 1, 8),
        sq:   clamp(6 - n,       4, 9),
        sh:   clamp(7.0 + n*0.3, 5.5, 8.0),
        en:   clamp(6 + n,       3, 9),
        st:   clamp(4 + n,       1, 7),
        fn:   clamp(6 + n,       4, 9),
        md:   clamp(6 + n,       4, 9),
      }
    }
    default: return { pain:5, sq:5, sh:6.5, en:5, st:5, fn:5, md:5 }
  }
}

// ── Groq helpers ──────────────────────────────────────────────────────────────
async function chat(prompt, maxTokens = 800, temp = 0.3) {
  const c = await groq.chat.completions.create({
    model: MODEL, messages:[{ role:'user', content:prompt }],
    temperature: temp, max_tokens: maxTokens,
  })
  return c.choices[0].message.content?.trim() ?? ''
}

function esc(s) { return s.replace(/'/g, "''") }

// ── De-identified patient snapshot for Groq ───────────────────────────────────
// (Built fresh from the deterministic data, so always consistent)
function buildDeidentified() {
  const today = new Date(); today.setHours(0,0,0,0)
  const signals = {}

  // Compute today's values
  PATIENTS.forEach((p, idx) => {
    const maxDay = p.group === 'droppedoff' ? 15 : 20
    const v = checkinValues(p.group, maxDay, idx, p.off)
    const sleepNorm = Math.min(v.sh / 8, 1) * 10
    const raw = (10-v.pain)*0.25 + v.sq*0.20 + sleepNorm*0.15 + v.en*0.15 + (10-v.st)*0.10 + v.fn*0.10 + v.md*0.05
    signals[p.id] = Math.round(raw * 10)
  })

  // Build refs
  return PATIENTS.map((p, idx) => {
    const ref = `P-${String(idx+1).padStart(2,'0')}`
    const sig = signals[p.id]
    const isDropped = p.group === 'droppedoff'
    const sevenDaySigs = []
    for (let d = 14; d <= 20; d++) {
      const v = checkinValues(p.group, d, idx, p.off)
      const sn = Math.min(v.sh/8,1)*10
      const r = (10-v.pain)*0.25+v.sq*0.20+sn*0.15+v.en*0.15+(10-v.st)*0.10+v.fn*0.10+v.md*0.05
      sevenDaySigs.push(Math.round(r*10))
    }
    const avg7 = Math.round(sevenDaySigs.reduce((a,b)=>a+b,0)/sevenDaySigs.length)
    const trend = p.group === 'recovery' ? 'improving'
      : p.group === 'declining' || p.group === 'demo_live' ? 'declining'
      : p.group === 'volatile' ? 'volatile'
      : 'stable'
    return {
      ref,
      patient_id: p.id,
      first_name: p.name,
      signal_today:         isDropped ? null : sig,
      signal_yesterday:     isDropped ? null : sig,
      signal_7day_avg:      avg7,
      trend,
      last_checkin:         isDropped ? '5 days ago' : 'today',
      days_without_checkin: isDropped ? 5 : 0,
    }
  })
}

// ── Main reset ────────────────────────────────────────────────────────────────
async function reset() {
  console.log('━━━ PURA Demo Reset — Vitality Spine & Wellness ━━━\n')

  // 1. Clear existing data
  console.log('1/5  Clearing check-in history, briefings, drafts…')
  const [r1, r2, r3] = await Promise.all([
    db.from('daily_checkins').delete().eq('clinic_id', CLINIC_ID),
    db.from('briefings').delete().eq('clinic_id', CLINIC_ID),
    db.from('message_drafts').delete().eq('clinic_id', CLINIC_ID),
  ])
  // pura_index_history is cleared automatically when daily_checkins are deleted?
  // No — we need to delete it too (no cascade on delete)
  await db.from('pura_index_history').delete().eq('clinic_id', CLINIC_ID)

  if (r1.error || r2.error || r3.error) {
    console.error('Delete errors:', r1.error?.message, r2.error?.message, r3.error?.message)
    process.exit(1)
  }
  console.log('     ✓ Cleared\n')

  // 2. Re-seed 21 days of check-in data
  console.log('2/5  Re-seeding 21 days of check-in history for 26 patients…')
  const today = new Date()
  const checkins = []
  PATIENTS.forEach((p, idx) => {
    const maxDay = p.group === 'droppedoff' ? 15 : 20
    for (let d = 0; d <= maxDay; d++) {
      const v = checkinValues(p.group, d, idx, p.off)
      const checkinDate = new Date(today)
      checkinDate.setDate(today.getDate() - (20 - d))
      const dateStr = checkinDate.toISOString().slice(0, 10)
      checkins.push({
        patient_id:         p.id,
        clinic_id:          CLINIC_ID,
        pain_level:         v.pain,
        sleep_quality:      v.sq,
        sleep_hours:        parseFloat(v.sh.toFixed(1)),
        energy_level:       v.en,
        stress_level:       v.st,
        functional_ability: v.fn,
        mood:               v.md,
        checkin_date:       dateStr,
        created_at:         `${dateStr}T08:00:00+00:00`,
      })
    }
  })

  // Batch insert in chunks of 100
  for (let i = 0; i < checkins.length; i += 100) {
    const { error } = await db.from('daily_checkins').insert(checkins.slice(i, i+100))
    if (error) { console.error('Checkin insert error:', error.message); process.exit(1) }
  }
  console.log(`     ✓ Inserted ${checkins.length} check-ins (trigger auto-generated pura_index_history)\n`)

  // 3. Build de-identified snapshot and call Groq for briefing
  console.log('3/5  Generating AI morning briefing via Groq…')
  const deidentified = buildDeidentified()
  const forGroq = deidentified.map(({ patient_id: _, first_name: __, ...rest }) => rest)

  const briefingPrompt = `You are a morning briefing assistant for a busy chiropractor at Vitality Spine & Wellness.

Patient cohort (26 patients, de-identified refs only — do not use names):
${JSON.stringify(forGroq, null, 2)}

Produce a morning briefing. Respond with valid JSON only — no markdown fences, no explanation:
{
  "summary": "<one punchy sentence: total patients needing attention and the key story — no ref codes>",
  "callouts": [
    {
      "patient_ref": "<exact ref from input>",
      "reason": "<one line: concrete signal pattern, cite trend>",
      "suggested_action": "<one line: immediate action — Call today, Text now, Schedule visit>"
    }
  ]
}

Rules:
- Up to 5 callouts ranked: red-zone declining first, then dropped-off silent, then volatile
- Summary must NOT mention P-01 or any ref codes — write it as a natural clinical sentence
- Skip stable and improving patients — they are fine
- Tone: direct clinical-warm, like a good MA briefing a DC`

  const briefingRaw = await chat(briefingPrompt)
  let briefing
  try { briefing = JSON.parse(briefingRaw) }
  catch { console.error('Briefing JSON parse failed:\n', briefingRaw); process.exit(1) }

  // Re-identify callouts (replace ref → real patient_id)
  const refToId = Object.fromEntries(deidentified.map(p => [p.ref, p.patient_id]))
  const storedCallouts = briefing.callouts
    .filter(c => refToId[c.patient_ref])
    .map(c => ({ patient_id: refToId[c.patient_ref], reason: c.reason, suggested_action: c.suggested_action }))

  const { error: bErr } = await db.from('briefings').insert({
    clinic_id:        CLINIC_ID,
    summary_text:     briefing.summary,
    patient_callouts: storedCallouts,
  })
  if (bErr) { console.error('Briefing insert error:', bErr.message); process.exit(1) }
  console.log('     ✓ Briefing stored')
  console.log(`     Summary: "${briefing.summary}"`)
  console.log(`     ${storedCallouts.length} callouts\n`)

  // 4. Generate message drafts for at-risk patients
  console.log('4/5  Generating AI message drafts…')
  const calloutIds = new Set(storedCallouts.map(c => c.patient_id))
  const draftTargets = deidentified.filter(p => {
    const sig = p.signal_today ?? p.signal_yesterday
    const redZone   = sig !== null && sig < 55
    const bigDrop   = sig !== null && p.signal_7day_avg !== null && (p.signal_7day_avg - sig) >= 15
    const droppedOff = p.days_without_checkin !== null && p.days_without_checkin >= 3
    const isCallout = calloutIds.has(p.patient_id)
    return redZone || bigDrop || droppedOff || isCallout
  })

  const drafts = []
  for (const p of draftTargets) {
    const declining  = p.trend === 'declining'
    const silent     = p.days_without_checkin >= 3
    const situation  = declining && !silent
      ? `The patient has been checking in but recovery is trending in the wrong direction for weeks — critically low score now. DC wants to reach out personally, express genuine concern, get them in this week.`
      : silent
      ? `Patient silent for ${p.days_without_checkin} days. DC wants to warmly re-engage — ask how they are, invite reply or call.`
      : `Patient's scores dropped sharply vs recent average. DC wants to check in and encourage.`

    const msgPrompt = `Write a single SMS from a chiropractor to a patient. Situation: ${situation}

Requirements:
- Under 280 characters
- Warm, direct, human — not clinical
- No numbers, scores, metrics, or jargon
- Do NOT use "soon" or "when you're free" — use specific CTA: "this week", "give us a call", "reply and let us know"
- Use [Name] for patient first name, [Clinic] for clinic name
- Output ONLY the SMS text — no quotes, no explanation`

    const raw = await chat(msgPrompt, 120, 0.5)
    const body = raw
      .replace(/\[Name\]/g,   p.first_name)
      .replace(/\[Clinic\]/g, CLINIC_NAME)
    drafts.push({ patient_id: p.patient_id, body })
  }

  if (drafts.length > 0) {
    const { error: dErr } = await db.from('message_drafts').insert(
      drafts.map(d => ({ clinic_id: CLINIC_ID, patient_id: d.patient_id, body_text: d.body, status: 'pending' }))
    )
    if (dErr) { console.error('Draft insert error:', dErr.message); process.exit(1) }
  }
  console.log(`     ✓ ${drafts.length} message drafts stored (all pending)\n`)

  // 5. Verify
  console.log('5/5  Verification…')
  const [
    { count: ptCount },
    { count: ciCount },
    { count: brCount },
    { count: mdCount },
  ] = await Promise.all([
    db.from('patients').select('*', { count:'exact', head:true }).eq('clinic_id', CLINIC_ID),
    db.from('daily_checkins').select('*', { count:'exact', head:true }).eq('clinic_id', CLINIC_ID),
    db.from('briefings').select('*', { count:'exact', head:true }).eq('clinic_id', CLINIC_ID),
    db.from('message_drafts').select('*', { count:'exact', head:true }).eq('clinic_id', CLINIC_ID).eq('status','pending'),
  ])
  console.log(`     Patients:        ${ptCount}`)
  console.log(`     Check-ins:       ${ciCount}`)
  console.log(`     Briefings:       ${brCount}`)
  console.log(`     Pending drafts:  ${mdCount}`)

  console.log('\n━━━ Reset complete — demo is ready ✓ ━━━\n')
  console.log('Login: demo@purahealth.app / demo-pura-2026')
  console.log('Live SMS patient: Demo Live - Joshua (tap his draft to send to +17874628720)')
}

reset().catch(e => { console.error(e); process.exit(1) })
