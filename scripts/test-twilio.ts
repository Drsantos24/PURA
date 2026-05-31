import { config } from 'dotenv'
config({ path: '.env.local' })

// Re-implement sendSMS inline to get verbose output
async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER

  console.log('SID length:', accountSid?.length, '| starts AC:', accountSid?.startsWith('AC'))
  console.log('Token length:', authToken?.length)
  console.log('From:', from)

  if (!accountSid || accountSid.startsWith('placeholder') || !authToken || !from) {
    console.log('RESULT: Would no-op — credentials missing or placeholder')
    return
  }

  try {
    const twilio = (await import('twilio')).default
    const client = twilio(accountSid, authToken)
    const msg = await client.messages.create({
      to:   '+17874628720',
      from,
      body: 'PURA test ping — if this arrives, Twilio is wired correctly.',
    })
    console.log('RESULT: SUCCESS')
    console.log('Message SID:', msg.sid)
    console.log('Status:', msg.status)
  } catch (err: unknown) {
    console.log('RESULT: ERROR')
    if (err && typeof err === 'object' && 'message' in err) {
      console.log('Message:', (err as { message: string }).message)
    }
    if (err && typeof err === 'object' && 'code' in err) {
      console.log('Code:', (err as { code: unknown }).code)
    }
    if (err && typeof err === 'object' && 'moreInfo' in err) {
      console.log('More info:', (err as { moreInfo: unknown }).moreInfo)
    }
  }
}

main()
