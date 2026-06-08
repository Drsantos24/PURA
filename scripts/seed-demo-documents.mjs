#!/usr/bin/env node
// seed-demo-documents.mjs
// Seeds 3 sample clinic documents for Vitality Spine & Wellness,
// generates embeddings via OpenAI, and stores chunks for RAG.

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim()

const SUPABASE_URL  = get('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY   = get('SUPABASE_SERVICE_ROLE_KEY')
const OPENAI_KEY    = get('OPENAI_API_KEY')
const ANTHROPIC_KEY = get('ANTHROPIC_API_KEY')
const CLINIC_ID     = '95386a93-a473-438d-bb25-c23bcf2d72df'
const OWNER_USER_ID = 'b6ca053f-ffc9-4a42-8bb7-8e16479bd40a' // demo@purahealth.app

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1) }

const db       = createClient(SUPABASE_URL, SERVICE_KEY)
const openai   = OPENAI_KEY && !OPENAI_KEY.startsWith('placeholder') ? new OpenAI({ apiKey: OPENAI_KEY }) : null
const anthropic = ANTHROPIC_KEY && !ANTHROPIC_KEY.startsWith('placeholder') ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null

// ── Document texts ────────────────────────────────────────────────

const DOCUMENTS = [
  {
    document_type: 'care_plan_template',
    file_name:     'Vitality_Spine_12Visit_Care_Plan.txt',
    text: `VITALITY SPINE & WELLNESS — 12-VISIT CARE PLAN TEMPLATE
==========================================================

OVERVIEW
--------
Our standard care plan runs 12 visits over 10–12 weeks. It is divided into three phases:
Acute (visits 1–4), Subacute (visits 5–8), and Maintenance/Graduation (visits 9–12).
Every plan is personalized at the visit-6 re-evaluation. The goal is never just pain relief —
it is functional restoration: the patient returns to the activities that matter to them.

PHASE 1 — ACUTE CARE (Visits 1–4, Weeks 1–2, 3×/week)
-------------------------------------------------------
Visits 1–4 focus on stabilization, not resolution. Most patients enter this phase at pain
levels 6–8/10. We are not trying to eliminate pain in 4 visits; we are establishing the
nervous system's baseline and beginning the reorganization process.

Milestone: By visit 4, patient should report pain reduction of at least 20%, improved sleep
quality score, and ability to perform one activity of daily living they couldn't at intake.

Visit 1: Full functional assessment, PURA onboarding, explanation of the 3-phase plan.
Visit 2: Soft tissue work, initial adjustment. Assign movement practice (walking 15 min/day).
Visit 3: Progress check. Adjust technique based on response. Review sleep and stress scores.
Visit 4: First mini re-evaluation. Document baseline metrics. Confirm Phase 2 trajectory.

PHASE 2 — SUBACUTE CARE (Visits 5–8, Weeks 3–6, 2×/week)
----------------------------------------------------------
This is where the real work happens. Frequency drops to allow the nervous system to integrate
changes between visits. Patients who rush back to 3×/week at this stage often stall.

Milestone: By visit 8, patient should report 50%+ pain reduction, functional ability score
of 6+ on the PURA index, and consistent sleep hours of 7+.

Visit 5: Technique refinement. Introduce rehab exercises specific to chief complaint.
Visit 6: MANDATORY RE-EVALUATION. Full reassessment using intake metrics. Decision point:
  — 50%+ improvement → continue to Phase 3 on current schedule
  — 30–49% improvement → extend Phase 2 by 2 visits, identify blocking factors
  — <30% improvement → diagnostic review, consider co-management or imaging referral
Visit 7: Adjust plan based on re-evaluation. Focus on patient-identified functional goals.
Visit 8: Pre-graduation assessment. Set patient expectations for Phase 3.

PHASE 3 — MAINTENANCE / GRADUATION (Visits 9–12, Weeks 7–12, 1×/week then PRN)
---------------------------------------------------------------------------------
This phase transitions the patient from "patient" to "wellness participant." The goal is
not continued treatment — it is building resilience and self-management skills.

Milestone: By visit 12, patient achieves their stated functional goal from intake. Functional
ability score 7+. Pain level 2 or below. Ready for monthly maintenance or self-directed care.

Visit 9: Review progress. Introduce long-term movement practice (not just pain-triggered care).
Visit 10: Advanced functional work. Introduce maintenance mindset: "We come in to maintain
  what we've built, not because we're broken."
Visit 11: Pre-discharge conversation. Discuss maintenance schedule (1×/month recommended).
Visit 12: GRADUATION VISIT. Document outcomes. Take progress photo (optional). Celebrate.
  If patient is not at goal: honest conversation. Extend plan or co-manage as needed.

KEY LANGUAGE GUIDELINES FOR STAFF
-----------------------------------
- Never say "compliance" — say "staying consistent with care" or "keeping your momentum"
- Never say "treatment failed" — say "we need to adjust our approach"
- Never say "pain management" — say "recovery" or "restoring function"
- Use "care partner" not "provider"
- Use "movement practice" not "exercises" — it's a lifestyle, not a prescription
- Celebrate milestones explicitly: "You hit your visit 6 milestone — that's real progress."

WHEN TO ESCALATE
-----------------
- Signal drop >18 points in 7 days: call the patient, do not text
- 3+ days without check-in during active plan: warm outreach within 24 hours
- Pain spike to 8+ after previous stabilization: same-day call
- Patient reports new neurological symptoms: same-day or urgent referral

OUTCOMES WE MEASURE
---------------------
- Pain level (0–10)
- Sleep quality and hours
- Functional ability score (PURA index, 0–100)
- Days without interruption to normal activity
- Patient-stated goal achievement (yes/no at discharge)
`,
  },
  {
    document_type: 'patient_letter_template',
    file_name:     'Vitality_Spine_New_Patient_Welcome_Letter.txt',
    text: `VITALITY SPINE & WELLNESS
Welcome to Your Recovery Journey
----------------------------------

Dear [Patient First Name],

Welcome to Vitality Spine & Wellness. We are genuinely glad you're here.

We know that deciding to start care — especially if you've been in pain for a while — takes
courage. Maybe you've tried other things. Maybe you're skeptical. That's okay. Our job isn't
to convince you of anything. Our job is to show you, visit by visit, that your body is capable
of more than you might believe right now.

Here's what you should know about how we work:

WE ARE YOUR CARE PARTNERS, NOT YOUR TREATERS.
Recovery isn't something we do to you — it's something we do with you. That means we need
you to show up (physically and mentally), check in each day through the PURA app, and tell us
honestly when something isn't working. We can adjust. We can't guess.

YOUR PLAN IS 12 VISITS. HERE'S WHY.
Lasting change in the nervous system and musculoskeletal system takes time. Quick fixes exist,
but they don't last. Our 12-visit plan is built around the science of how long it takes the
body to reorganize, strengthen, and stabilize. We'll do a formal re-evaluation at visit 6
so you can see your own progress in real numbers.

WHAT WE ASK OF YOU:
— Check in on the PURA app each morning. It takes 90 seconds and tells us a lot.
— Keep your scheduled appointments, especially in weeks 1–4. Consistency is the treatment.
— Tell us what's working and what isn't. There are no wrong answers here.
— Rest between visits. Recovery happens between adjustments, not during them.

WHAT YOU CAN EXPECT FROM US:
— We will know your name, your goals, and your story.
— We will explain everything before we do it.
— We will not keep you longer than necessary or shorter than beneficial.
— We will celebrate your wins — even the small ones — because small wins lead to big recoveries.
— We will be honest with you, even when the honest answer is "we need more time" or
  "we should bring in another perspective."

A WORD ON WHAT WE DON'T SAY HERE:
You'll notice we don't use words like "pain management" or "compliance." That's intentional.
Pain management implies you'll always have pain and we're just keeping it in check. We think
bigger than that. And compliance is a word that belongs in a contract, not a care relationship.
You're not complying with us — you're investing in yourself, and we're investing in you.

Your first check-in link will arrive by text before your next visit. If you have any questions,
reply to that message or call the front desk. We're in your corner.

See you soon,

The Team at Vitality Spine & Wellness
`,
  },
  {
    document_type: 'sop',
    file_name:     'Vitality_Spine_Clinical_Philosophy.txt',
    text: `VITALITY SPINE & WELLNESS — CLINICAL PHILOSOPHY & CARE PRINCIPLES
====================================================================

This document describes the clinical philosophy of Vitality Spine & Wellness.
It is written for staff, AI tools, and anyone who needs to understand why we do things
the way we do — especially how we talk about care, patients, and outcomes.

CORE BELIEF: WHOLE-PERSON OVER SYMPTOM-FIRST
---------------------------------------------
We do not treat backs. We treat people who happen to have back pain.
The presenting complaint is a signal — it tells us where to start, not where to stop.

Every patient who walks through our door carries a nervous system shaped by their sleep,
their stress, their work, their relationships, and their history of movement or lack of it.
Our adjustments work on a system that is embedded in a life. Treating the spine in isolation
is like fixing one wire in an overloaded circuit and calling it done.

This means we ask about sleep in every visit. It means we care about stress levels not because
we're being holistic for its own sake, but because cortisol directly impairs tissue healing.
It means we think about a patient's commute, their posture at work, their exercise habits —
because the hour they spend in our office is a small fraction of the 167 hours they spend
doing everything else.

WHAT SUCCESSFUL RECOVERY LOOKS LIKE
-------------------------------------
A successful discharge is not a patient who reports 0/10 pain. It is a patient who:
- Has returned to the activity or function they identified as their goal at intake
- Has a PURA functional ability score of 7+ (out of 10)
- Understands their own patterns: what provokes symptoms, what relieves them
- Has a movement practice they can sustain independently
- Knows when to come back and why (maintenance vs. acute episode)

We celebrate this. We document it. We tell them explicitly: "You did this."

ON THE WORD "COMPLIANCE"
-------------------------
We do not use this word. Ever.

Compliance implies a power dynamic in which the clinician sets terms and the patient
either meets them or doesn't — and failure to comply is the patient's fault.

That is not how we think about care. When a patient misses appointments or stops checking in,
our first question is: what's making it hard? Life got in the way. Pain made it scary.
They didn't understand why it mattered. That is information, not failure.

Instead we say:
- "Staying consistent with care" (not "compliant")
- "Keeping your momentum" (not "completing the protocol")
- "We need to adjust our approach" (not "treatment isn't working")
- "What's getting in the way?" (not "you missed three visits")

THE ROLE OF THE PURA INDEX
----------------------------
The PURA signal is a daily functional health score built from check-in data: pain, sleep,
energy, stress, functional ability, and mood. It is not a diagnostic tool. It is a conversation
starter and an early warning system.

When a patient's signal drops, our response is curiosity, not alarm.
- First question: "Is this a blip or a trend?"
- Second question: "What changed in their life this week?"
- Third question: "What do they need from us right now — more visits, a different approach, or just to feel heard?"

We never lead with the number. We lead with the relationship.
"We noticed things haven't been tracking as well this week — we wanted to check in."
Not: "Your PURA score dropped 22 points."

CARE PLAN PHILOSOPHY
---------------------
Our 12-visit structure is not arbitrary. Research on motor control re-education and
central sensitization consistently shows that meaningful, lasting change requires
sustained stimulus over 8–12 weeks. Four visits is enough to mask symptoms.
Twelve visits is enough to reorganize the system.

The visit-6 re-evaluation is sacred. It is the moment we have an honest conversation
based on real data. We do not rubber-stamp continuations. If a patient is not progressing,
we say so, we explain why, and we adjust — together.

HOW WE TALK ABOUT PATIENT OUTREACH
-------------------------------------
When we reach out to patients — by text, by call, by any channel — we lead with care,
not administration.

Wrong: "This is a reminder that you have an appointment on Thursday."
Right: "Hi [Name], just wanted to check in — we haven't heard from you in a few days
and we want to make sure you're doing okay. Give us a call or reply and let us know."

Wrong: "Your compliance with the care plan has been inconsistent."
Right: "We know life gets busy — we're here whenever you're ready to pick up where we left off."

We are in the business of relationships. Every message we send is an opportunity to
reinforce that this clinic is different — that someone here actually knows who you are
and cares whether you get better.

LANGUAGE WE USE AND AVOID
--------------------------
Use:
- "Recovery journey" (not "treatment course")
- "Care partner" (not "provider" or "treater")
- "Movement practice" (not "home exercises" or "therapeutic exercise program")
- "Staying consistent with care" (not "compliance")
- "We adjust our approach" (not "treatment failed")
- "Check in with us" (not "report symptoms")
- "Milestone" (not "benchmark" or "KPI")

Avoid:
- "Compliance" / "non-compliant"
- "Pain management" (implies permanence)
- "Treatment failure"
- "Protocol" (implies the patient is interchangeable)
- "Objective findings" in patient-facing language
- Any phrasing that positions the patient as a passive recipient of care

OUR PROMISE TO EVERY PATIENT
------------------------------
We will remember your name.
We will know your story.
We will tell you the truth.
We will celebrate your wins.
We are in your corner.
`,
  },
]

// ── Chunking ──────────────────────────────────────────────────────
function chunkText(text, chunkChars = 2000, overlapChars = 200) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    start += chunkChars - overlapChars
  }
  return chunks
}

async function generateSummary(text, fileName) {
  if (!anthropic) return null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `Summarize this clinic document in 2–3 sentences, focusing on its AI value for patient communications. File: ${fileName}\n\n${text.slice(0, 4000)}` }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : null
  } catch { return null }
}

async function main() {
  console.log('━━━ Vitality Spine Document Seed ━━━\n')

  // Get owner user ID from clinic_members
  const { data: memberRow } = await db.from('clinic_members').select('user_email').eq('clinic_id', CLINIC_ID).eq('role', 'owner').maybeSingle()
  // Fall back to hardcoded constant if lookup fails
  const ownerUserId = OWNER_USER_ID

  // Strip all non-ASCII characters that cause Node 26 fetch ByteString errors
  function sanitize(t) {
    // Replace common typographic chars by codepoint, then strip remaining non-ASCII
    return t
      .split(‘’).map(c => {
        const code = c.charCodeAt(0)
        if (code === 8212 || code === 8211) return ‘-’ // em/en dash
        if (code === 8216 || code === 8217) return “’” // smart single quotes
        if (code === 8220 || code === 8221) return ‘”’ // smart double quotes
        if (code === 8230) return ‘...’                // ellipsis
        if (code > 127) return ‘’                      // strip any other non-ASCII
        return c
      }).join(‘’)
  }

  for (const doc of DOCUMENTS) {
    doc.text = sanitize(doc.text)
    console.log(`Processing: ${doc.file_name}`)

    // Clear existing
    const { data: existing } = await db.from('clinic_documents').select('id').eq('clinic_id', CLINIC_ID).eq('file_name', doc.file_name)
    for (const e of (existing ?? [])) {
      await db.from('clinic_document_chunks').delete().eq('document_id', e.id)
      await db.from('clinic_documents').delete().eq('id', e.id)
    }

    const rawSummary = await generateSummary(doc.text, doc.file_name)
    const summary = rawSummary ? sanitize(rawSummary) : null
    console.log(`  Summary: ${summary ? summary.slice(0, 80) + '...' : '(no Anthropic key)'}`)

    const { data: inserted, error: insErr } = await db.from('clinic_documents').insert({
      clinic_id:     CLINIC_ID,
      owner_user_id: ownerUserId,
      document_type: doc.document_type,
      file_name:     doc.file_name,
      original_text: doc.text,
      summary,
    }).select('id').single()

    if (insErr || !inserted) { console.error('  Insert error:', insErr?.message); continue }
    console.log(`  Document ID: ${inserted.id}`)

    const chunks = chunkText(doc.text)
    console.log(`  Chunks: ${chunks.length}`)

    if (openai) {
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks.map(c => c.replace(/\n/g, ' ')),
      })
      const rows = chunks.map((chunk_text, i) => ({
        document_id: inserted.id,
        clinic_id:   CLINIC_ID,
        chunk_text,
        embedding:   JSON.stringify(res.data[i].embedding),
        chunk_index: i,
      }))
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await db.from('clinic_document_chunks').insert(rows.slice(i, i+50))
        if (error) console.error('  Chunk insert error:', error.message)
      }
      console.log(`  ✓ ${chunks.length} chunks embedded and stored`)
    } else {
      console.log('  ⚠ OPENAI_API_KEY not set — chunks stored without embeddings')
      const rows = chunks.map((chunk_text, i) => ({
        document_id: inserted.id, clinic_id: CLINIC_ID, chunk_text, chunk_index: i,
      }))
      for (let i = 0; i < rows.length; i += 50) {
        await db.from('clinic_document_chunks').insert(rows.slice(i, i+50))
      }
    }
    console.log()
  }

  // Verify
  const { count: docCount } = await db.from('clinic_documents').select('*', { count: 'exact', head: true }).eq('clinic_id', CLINIC_ID)
  const { count: chunkCount } = await db.from('clinic_document_chunks').select('*', { count: 'exact', head: true }).eq('clinic_id', CLINIC_ID)
  console.log(`━━━ Done ━━━`)
  console.log(`Documents: ${docCount}`)
  console.log(`Chunks:    ${chunkCount}`)
  console.log(`Embeddings: ${openai ? 'YES (RAG active)' : 'NO (add OPENAI_API_KEY to enable)'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
