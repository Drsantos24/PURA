import 'server-only'

export async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || accountSid.startsWith('placeholder') || !authToken || !from) {
    console.log('SMS skipped (Twilio not configured)')
    return false
  }

  try {
    const twilio = (await import('twilio')).default
    const client = twilio(accountSid, authToken)
    await client.messages.create({ to, from, body })
    return true
  } catch (err) {
    console.error('SMS send failed:', err)
    return false
  }
}
