import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type MemberRole = 'owner' | 'clinician' | 'assistant'

export type ClinicMember = {
  clinic_id: string
  role: MemberRole
  user_email: string
}

export async function getCurrentClinicMember(): Promise<ClinicMember | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data } = await supabase
    .from('clinic_members')
    .select('clinic_id, role, user_email')
    .eq('user_email', user.email)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return data ?? null
}

export async function requireMember(): Promise<ClinicMember> {
  const member = await getCurrentClinicMember()
  if (!member) throw Object.assign(new Error('Forbidden'), { status: 403 })
  return member
}

export async function requireOwner(): Promise<ClinicMember> {
  const member = await getCurrentClinicMember()
  if (!member || member.role !== 'owner') {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  return member
}

export function canEditPatients(_role: MemberRole)       { return true }
export function canEditClinicSettings(role: MemberRole)  { return role === 'owner' }
export function canInviteMembers(role: MemberRole)       { return role === 'owner' }
export function canDeletePatients(role: MemberRole)      { return role === 'owner' }
