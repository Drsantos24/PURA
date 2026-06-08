import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_SECTIONS = ['practice_identity', 'patient_journey', 'clinical_vocabulary', 'decision_thresholds', 'outcomes_measured'] as const
type Section = typeof VALID_SECTIONS[number]

const SECTION_FIELDS: Record<Section, string[]> = {
  practice_identity: [
    'practice_type', 'practice_origin_story', 'practice_philosophy',
    'patient_demographics', 'typical_visit_frequency',
  ],
  patient_journey: [
    'typical_patient_journey', 'typical_care_plan_structure',
    'what_successful_recovery_looks_like', 'what_makes_a_good_outcome',
  ],
  clinical_vocabulary: [
    'communication_style', 'communication_style_notes',
    'what_you_wish_other_chiropractors_knew',
    'clinic_vocabulary',
  ],
  decision_thresholds: ['red_flags', 'decision_thresholds'],
  outcomes_measured:   ['common_outcomes_data'],
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const body = await req.json()
  const section = body.section as Section | undefined

  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
  }

  const fields = SECTION_FIELDS[section]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { last_substantive_edit: new Date().toISOString() }

  for (const field of fields) {
    if (field in body) {
      const val = body[field]
      // jsonb fields
      if (['clinic_vocabulary', 'decision_thresholds', 'common_outcomes_data'].includes(field)) {
        update[field] = typeof val === 'string' ? null : val
      } else {
        update[field] = typeof val === 'string' && val.trim() ? val.trim() : null
      }
    }
  }

  // Fetch existing completed_sections
  const { data: existing } = await supabase
    .from('clinic_profiles')
    .select('completed_sections')
    .eq('clinic_id', member.clinic_id)
    .maybeSingle()

  const completedSections = (existing?.completed_sections as Record<string, boolean>) ?? {}

  // Mark section complete if any field has content
  const hasContent = fields.some(f => update[f] != null && update[f] !== '')
  completedSections[section] = hasContent

  update.completed_sections = completedSections

  const { error } = await supabase
    .from('clinic_profiles')
    .upsert({ clinic_id: member.clinic_id, ...update }, { onConflict: 'clinic_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const totalSections = VALID_SECTIONS.length
  const doneSections  = Object.values(completedSections).filter(Boolean).length
  const pct           = Math.round((doneSections / totalSections) * 100)

  return NextResponse.json({ ok: true, section, completedSections, trainingPct: pct })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_email', user.email!)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 })

  const { data } = await supabase
    .from('clinic_profiles')
    .select('*')
    .eq('clinic_id', member.clinic_id)
    .maybeSingle()

  return NextResponse.json({ profile: data ?? null, role: member.role })
}
