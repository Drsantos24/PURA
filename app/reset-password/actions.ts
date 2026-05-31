'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (password !== confirm) {
    redirect('/reset-password?error=Passwords+do+not+match')
  }

  if (password.length < 8) {
    redirect('/reset-password?error=Password+must+be+at+least+8+characters')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  redirect('/dashboard')
}
