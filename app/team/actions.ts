'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function inviteTeamMember(formData: FormData) {
  const owner  = await requireOwner()
  const email  = (formData.get('email') as string).trim().toLowerCase()
  const role   = formData.get('role') as 'clinician' | 'assistant'

  if (!email || !['clinician', 'assistant'].includes(role)) {
    redirect('/team?err=Invalid+email+or+role')
  }

  const supabase = await createClient()

  // Check if already an active member
  const { data: existing } = await supabase
    .from('clinic_members')
    .select('id, status')
    .eq('clinic_id', owner.clinic_id)
    .eq('user_email', email)
    .maybeSingle()

  if (existing?.status === 'active') redirect('/team?err=Already+an+active+member')

  const service = createServiceClient()
  const { data: invite, error } = await service
    .from('clinic_member_invites')
    .insert({
      clinic_id:        owner.clinic_id,
      invited_email:    email,
      role,
      invited_by_email: owner.user_email,
    })
    .select('token')
    .single()

  if (error) redirect(`/team?err=${encodeURIComponent(error.message)}`)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url     = `${baseUrl}/accept-invite?token=${invite.token}`
  redirect(`/team?invite_url=${encodeURIComponent(url)}`)
}

export async function revokeMember(memberId: string) {
  await requireOwner()
  const supabase = await createClient()
  await supabase
    .from('clinic_members')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', memberId)
  revalidatePath('/team')
  redirect('/team')
}

export async function revokeInvite(inviteId: string) {
  await requireOwner()
  const service = createServiceClient()
  await service
    .from('clinic_member_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', inviteId)
  revalidatePath('/team')
  redirect('/team')
}
