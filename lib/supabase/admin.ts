import 'server-only'
import { createClient } from '@supabase/supabase-js'

// This module is SERVER-SIDE ONLY.
// Never import it from a Client Component or any file that ships to the browser.
// The `server-only` guard above will cause a build error if you try.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
