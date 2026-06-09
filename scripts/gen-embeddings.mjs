#!/usr/bin/env node
// Generates embeddings for the 6 known chunks and prints SQL UPDATE statements.
// Avoids Supabase JS (Node 26 ByteString issue) -- outputs SQL to stdout.
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = (k) => env.match(new RegExp('^' + k + '=(.+)', 'm'))?.[1]?.trim()
const openai = new OpenAI({ apiKey: get('OPENAI_API_KEY') })

// Chunk texts from SQL -- sanitized to ASCII for safe transport
const CHUNKS = [
  { id: '085e2e28-2560-4513-a274-f0687936a157', text: 'VITALITY SPINE & WELLNESS -- Welcome to Your Recovery Journey. Dear [Patient First Name], Welcome to Vitality Spine & Wellness. We are genuinely glad you are here. We know that deciding to start care takes courage. Our job is to show you, visit by visit, that your body is capable of more than you might believe right now. WE ARE YOUR CARE PARTNERS, NOT YOUR TREATERS. Recovery is not something we do to you -- it is something we do with you. YOUR PLAN IS 12 VISITS. Lasting change in the nervous system takes time. We will do a formal re-evaluation at visit 6. WHAT WE ASK OF YOU: Check in on the PURA app each morning. Keep your scheduled appointments -- consistency is the treatment. Tell us what is working and what is not. WHAT YOU CAN EXPECT FROM US: We will know your name, your goals, and your story. We will celebrate your wins -- small wins lead to big recoveries. We are in your corner.' },
  { id: 'f9325fdc-84fe-4c25-a3fd-1259bb31b00d', text: 'You will notice we do not use words like pain management or compliance. That is intentional. Pain management implies you will always have pain. We think bigger than that. Compliance is a word that belongs in a contract, not a care relationship. You are not complying with us -- you are investing in yourself, and we are investing in you. Your first check-in link will arrive by text before your next visit. We are in your corner. The Team at Vitality Spine & Wellness.' },
  { id: 'b357f31c-d768-48f2-b9bf-3dd694dada53', text: 'VITALITY SPINE & WELLNESS -- CLINICAL PHILOSOPHY & CARE PRINCIPLES. CORE BELIEF: WHOLE-PERSON OVER SYMPTOM-FIRST. We do not treat backs. We treat people who happen to have back pain. Every patient carries a nervous system shaped by their sleep, stress, work, and relationships. WHAT SUCCESSFUL RECOVERY LOOKS LIKE: A successful discharge is a patient who has returned to the activity they identified as their goal, has a PURA functional ability score of 7+, understands their own patterns, and has a movement practice they can sustain. ON THE WORD COMPLIANCE: We do not use this word. Ever. Instead: staying consistent with care, keeping your momentum, we need to adjust our approach. When a patient misses appointments, our first question is: what made it hard? THE ROLE OF THE PURA INDEX: When a signal drops, our response is curiosity, not alarm. We never lead with the number. We lead with the relationship.' },
  { id: '3bf1004b-d1fb-4753-a978-3edf125106ad', text: 'HOW WE TALK ABOUT PATIENT OUTREACH: When we reach out, we lead with care, not administration. Wrong: This is a reminder that you have an appointment on Thursday. Right: Hi [Name], just wanted to check in -- we have not heard from you in a few days and we want to make sure you are doing okay. Wrong: Your compliance with the care plan has been inconsistent. Right: We know life gets busy -- we are here whenever you are ready to pick up where we left off. LANGUAGE WE USE: recovery journey, care partner, movement practice, staying consistent with care, milestone. LANGUAGE WE AVOID: compliance, non-compliant, pain management, treatment failure. OUR PROMISE: We will remember your name. We will know your story. We will tell you the truth. We will celebrate your wins. We are in your corner.' },
  { id: '1b73a7a8-255e-450e-bfe6-0ccef9d965b1', text: 'VITALITY SPINE & WELLNESS -- 12-VISIT CARE PLAN TEMPLATE. Our standard care plan runs 12 visits over 10-12 weeks in three phases: Acute (visits 1-4), Subacute (visits 5-8), Maintenance/Graduation (visits 9-12). PHASE 1 ACUTE CARE visits 1-4 weeks 1-2 3x per week: Milestone by visit 4 -- at least 20% pain reduction, improved sleep quality, ability to perform one ADL they could not at intake. PHASE 2 SUBACUTE CARE visits 5-8 weeks 3-6 2x per week: Milestone by visit 8 -- 50%+ pain reduction, functional ability score 6+, sleep hours 7+. Visit 6 MANDATORY RE-EVALUATION: 50%+ improvement continue to Phase 3; 30-49% extend Phase 2 by 2 visits; under 30% improvement diagnostic review consider co-management or imaging referral. KEY LANGUAGE: Never say compliance -- say staying consistent with care. Never say treatment failed -- say we need to adjust our approach. Use care partner not provider. Use movement practice not exercises. Celebrate milestones explicitly.' },
  { id: '740c7748-3ba8-4f68-908c-566555055939', text: 'PHASE 3 MAINTENANCE GRADUATION visits 9-12 weeks 7-12 1x per week: Milestone by visit 12 -- patient achieves their stated functional goal, functional ability score 7+, pain level 2 or below. Visit 12 GRADUATION VISIT: Document outcomes, celebrate. If not at goal: honest conversation, extend plan or co-manage. WHEN TO ESCALATE: Signal drop over 18 points in 7 days -- call the patient, do not text. 3+ days without check-in during active plan -- warm outreach within 24 hours. Pain spike to 8+ after previous stabilization -- same-day call. OUTCOMES WE MEASURE: pain level, sleep quality and hours, functional ability score PURA index 0-100, days without interruption to normal activity, patient-stated goal achievement at discharge. Consistency is the treatment. Small wins lead to big recoveries.' },
]

console.error(`Generating ${CHUNKS.length} embeddings...`)
const res = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: CHUNKS.map(c => c.text),
})
console.error(`Done. ${res.data.length} embeddings, ${res.data[0].embedding.length} dims each.`)

// Output SQL UPDATE statements
for (let i = 0; i < CHUNKS.length; i++) {
  const vec = '[' + res.data[i].embedding.join(',') + ']'
  process.stdout.write(
    `UPDATE clinic_document_chunks SET embedding = '${vec}' WHERE id = '${CHUNKS[i].id}';\n`
  )
}
