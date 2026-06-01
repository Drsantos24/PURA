'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function acceptInvite(formData: FormData) {
  const token    = formData.get('token')    as string
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (!token || !password) redirect(`/accept-invite?token=${token}&error=Missing+required+fields`)
  if (password !== confirm) redirect(`/accept-invite?token=${token}&error=Passwords+do+not+match`)
  if (password.length < 8)  redirect(`/accept-invite?token=${token}&error=Password+must+be+at+least+8+characters`)

  const admin = createAdminClient()

  // Validate invite
  const { data: invite, error: inviteErr } = await admin
    .from('clinic_member_invites')
    .select('id, invited_email, role, clinic_id, expires_at, used_at')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (inviteErr || !invite) redirect('/accept-invite?error=Invalid+or+expired+invite')

  // Create auth user
  const { data: authData, error: createErr } = await admin.auth.admin.createUser({
    email:         invite.invited_email,
    password,
    email_confirm: true,
  })

  if (createErr || !authData.user) {
    redirect(`/accept-invite?token=${token}&error=${encodeURIComponent(createErr?.message ?? 'Failed to create account')}`)
  }

  // Insert clinic_member row
  const { error: memberErr } = await admin
    .from('clinic_members')
    .insert({
      clinic_id:        invite.clinic_id,
      user_email:       invite.invited_email,
      role:             invite.role,
      invited_by_email: null,
      status:           'active',
      accepted_at:      new Date().toISOString(),
    })

  if (memberErr) {
    await admin.auth.admin.deleteUser(authData.user.id)
    redirect(`/accept-invite?token=${token}&error=${encodeURIComponent(memberErr.message)}`)
  }

  // Mark invite consumed
  await admin
    .from('clinic_member_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Sign in immediately
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.invited_email,
    password,
  })

  if (signInErr) redirect('/login?message=Account+created.+Please+sign+in.')
  redirect('/dashboard')
}
