// Client-side CSV/XLSX parsing + normalization.
// No server import — runs in browser only.

export type ParsedRow = {
  _rowIndex:       number
  first_name:      string
  last_name:       string
  phone_number:    string
  email:           string | null
  chief_complaint: string | null
  date_of_birth:   string | null
  enrollment_date: string | null
  // validation
  status:   'valid' | 'warning' | 'error'
  issues:   string[]
}

// Header aliases → canonical field name
const ALIASES: Record<string, string> = {
  // first_name
  first_name: 'first_name', firstname: 'first_name', first: 'first_name',
  fname: 'first_name', 'first name': 'first_name', given_name: 'first_name',
  // last_name
  last_name: 'last_name', lastname: 'last_name', last: 'last_name',
  lname: 'last_name', 'last name': 'last_name', surname: 'last_name',
  // phone
  phone: 'phone_number', phone_number: 'phone_number', mobile: 'phone_number',
  cell: 'phone_number', 'phone number': 'phone_number', telephone: 'phone_number',
  'mobile number': 'phone_number',
  // email
  email: 'email', email_address: 'email', 'email address': 'email',
  // chief_complaint
  chief_complaint: 'chief_complaint', complaint: 'chief_complaint',
  condition: 'chief_complaint', reason: 'chief_complaint', diagnosis: 'chief_complaint',
  'chief complaint': 'chief_complaint',
  // date_of_birth
  date_of_birth: 'date_of_birth', dob: 'date_of_birth', birthdate: 'date_of_birth',
  birthday: 'date_of_birth', 'date of birth': 'date_of_birth', 'birth date': 'date_of_birth',
  // enrollment_date
  enrollment_date: 'enrollment_date', 'enrollment date': 'enrollment_date',
  start_date: 'enrollment_date', 'start date': 'enrollment_date',
}

function normalizeHeader(h: string): string {
  return h.replace(/['"]/g, '').trim().toLowerCase().replace(/[-_\s]+/g, ' ')
    .replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (digits.length > 11) return `+${digits.slice(-11)}`
  return raw.trim()
}

function isValidPhone(p: string): boolean {
  return /^\+1\d{10}$/.test(p)
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

function normalizeDate(raw: string): string | null {
  if (!raw.trim()) return null
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  // Try M/D/YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const nd = new Date(`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`)
    if (!isNaN(nd.getTime())) return nd.toISOString().slice(0, 10)
  }
  return null
}

export function parseRows(
  rawRows: Record<string, string>[],
  existingPhones: Set<string> = new Set(),
  existingEmails: Set<string> = new Set(),
): ParsedRow[] {
  const seenPhones = new Set<string>()
  const seenEmails = new Set<string>()

  return rawRows.map((raw, i) => {
    // Map headers
    const mapped: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      const norm = normalizeHeader(k)
      // try exact, then alias lookup
      const canonical = ALIASES[norm] ?? ALIASES[k.toLowerCase().trim()] ?? null
      if (canonical) mapped[canonical] = v?.toString()?.trim() ?? ''
    }

    const issues: string[] = []

    // first_name
    const firstName = (mapped.first_name ?? '').trim()
    if (!firstName) issues.push('Missing first name')

    // last_name (warning only)
    const lastName = (mapped.last_name ?? '').trim()

    // phone
    const rawPhone = (mapped.phone_number ?? '').trim()
    const phone    = rawPhone ? normalizePhone(rawPhone) : ''
    if (!rawPhone && !(mapped.email ?? '').trim()) {
      issues.push('Must have phone or email')
    } else if (rawPhone && !isValidPhone(phone)) {
      issues.push(`Phone "${rawPhone}" could not be normalized`)
    } else if (phone && isValidPhone(phone)) {
      if (existingPhones.has(phone)) issues.push(`Phone ${phone} already exists in clinic`)
      if (seenPhones.has(phone)) issues.push(`Duplicate phone in this file`)
      seenPhones.add(phone)
    }

    // email
    const rawEmail = (mapped.email ?? '').trim().toLowerCase()
    const email    = rawEmail || null
    if (email && !isValidEmail(email)) {
      issues.push(`Email "${rawEmail}" looks invalid`)
    } else if (email) {
      if (existingEmails.has(email)) issues.push(`Email ${email} already exists in clinic`)
      if (seenEmails.has(email)) issues.push(`Duplicate email in this file`)
      seenEmails.add(email)
    }

    // dates
    const dob            = normalizeDate(mapped.date_of_birth ?? '')
    const enrollmentDate = normalizeDate(mapped.enrollment_date ?? '')
    if ((mapped.date_of_birth ?? '').trim() && !dob) {
      issues.push(`DOB "${mapped.date_of_birth}" could not be parsed`)
    }

    // Determine status
    const hasBlocker = issues.some(i =>
      i.startsWith('Missing first name') ||
      i.startsWith('Must have phone') ||
      i.includes('could not be normalized') ||
      i.includes('already exists')
    )
    const status: ParsedRow['status'] = hasBlocker
      ? 'error'
      : issues.length > 0 ? 'warning' : 'valid'

    return {
      _rowIndex:       i,
      first_name:      firstName,
      last_name:       lastName,
      phone_number:    phone,
      email,
      chief_complaint: (mapped.chief_complaint ?? '').trim() || null,
      date_of_birth:   dob,
      enrollment_date: enrollmentDate,
      status,
      issues,
    }
  })
}
