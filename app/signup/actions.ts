'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export async function signUp(formData: FormData) {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!token || !password) {
    redirect(`/signup?token=${token}&error=Missing+required+fields`)
  }

  if (password !== confirm) {
    redirect(`/signup?token=${token}&error=Passwords+do+not+match`)
  }

  if (password.length < 8) {
    redirect(`/signup?token=${token}&error=Password+must+be+at+least+8+characters`)
  }

  const admin = createAdminClient()

  // 1. Validate invite (not used, not expired)
  const { data: invite, error: inviteError } = await admin
    .from('clinic_invites')
    .select('id, owner_email, clinic_name, used_at, expires_at')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (inviteError || !invite) {
    redirect('/signup?error=This+invite+link+is+invalid+or+has+expired.')
  }

  // 2. Create auth user — auto-confirmed, no verification email needed
  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email: invite.owner_email,
    password,
    email_confirm: true,
  })

  if (createError || !authData.user) {
    redirect(
      `/signup?token=${token}&error=${encodeURIComponent(createError?.message ?? 'Failed to create account')}`
    )
  }

  // 3. Create clinic row (service key bypasses INSERT-restricted RLS)
  const clinicKey = slugify(invite.clinic_name)
  const { error: clinicError } = await admin.from('clinics').insert({
    clinic_name: invite.clinic_name,
    clinic_key: clinicKey,
    owner_email: invite.owner_email,
  })

  if (clinicError) {
    // Rollback: delete the auth user we just created
    await admin.auth.admin.deleteUser(authData.user.id)
    redirect(`/signup?token=${token}&error=${encodeURIComponent(clinicError.message)}`)
  }

  // 4. Create default clinic_settings
  const { data: clinic } = await admin
    .from('clinics')
    .select('id')
    .eq('owner_email', invite.owner_email)
    .single()

  if (clinic) {
    await admin.from('clinic_settings').insert({ clinic_id: clinic.id })
  }

  // 5. Mark invite consumed
  await admin
    .from('clinic_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  // 6. Sign the user in so they land on /dashboard with a live session
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.owner_email,
    password,
  })

  if (signInError) {
    redirect('/login?message=Account+created.+Please+sign+in.')
  }

  redirect('/dashboard')
}
