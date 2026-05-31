// base62 minus visually ambiguous characters: 0 O 1 l I
const CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generate(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

type SupabaseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown }>
      }
    }
  }
}

export async function generateUniqueShortCode(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate()
    const { data } = await supabase
      .from('patient_checkin_tokens')
      .select('id')
      .eq('short_code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Failed to generate unique short code after 10 attempts')
}
