import 'server-only'

// Junction (junction.tryvital.io) — wearable data provider.
// Docs: https://docs.junction.tryvital.io/
// Add JUNCTION_API_KEY, JUNCTION_ENVIRONMENT, JUNCTION_TEAM_ID to .env.local.
// Until then every function returns null so dev continues unblocked.

function getConfig() {
  const apiKey = process.env.JUNCTION_API_KEY
  const env    = process.env.JUNCTION_ENVIRONMENT ?? 'sandbox'
  const teamId = process.env.JUNCTION_TEAM_ID

  if (!apiKey || apiKey.startsWith('placeholder') || !teamId) {
    return null
  }

  const baseUrl =
    env === 'production'
      ? 'https://api.junction.tryvital.io'
      : 'https://api.sandbox.junction.tryvital.io'

  return { apiKey, teamId, baseUrl }
}

// TODO: Call POST /v2/user to create a Junction user linked to this patient.
// Returns the Junction user_id string, or null when Junction is not configured.
// Docs: https://docs.junction.tryvital.io/api-reference/user/create-user
export async function createUser(patientId: string): Promise<string | null> {
  const cfg = getConfig()
  if (!cfg) {
    console.log('Junction not configured — createUser skipped')
    return null
  }

  // TODO: implement
  // POST ${cfg.baseUrl}/v2/user
  // Body: { client_user_id: patientId }
  // Headers: { 'x-vital-api-key': cfg.apiKey }
  // Return: response.user_id
  void patientId
  return null
}

// TODO: Call POST /v2/link/token to get a short-lived token for the in-app
// device-connection widget ("Connect Apple Watch / Oura / WHOOP").
// Returns the link token string, or null when Junction is not configured.
// Docs: https://docs.junction.tryvital.io/api-reference/link/create-link-token
export async function getLinkToken(junctionUserId: string): Promise<string | null> {
  const cfg = getConfig()
  if (!cfg) {
    console.log('Junction not configured — getLinkToken skipped')
    return null
  }

  // TODO: implement
  // POST ${cfg.baseUrl}/v2/link/token
  // Body: { user_id: junctionUserId }
  // Headers: { 'x-vital-api-key': cfg.apiKey }
  // Return: response.link_token
  void junctionUserId
  return null
}

export interface JunctionVitals {
  hrv_rmssd_ms:   number | null  // heart-rate variability (ms)
  rhr_bpm:        number | null  // resting heart rate
  sleep_hours:    number | null  // total sleep duration
  sleep_score:    number | null  // provider sleep score 0-100
  readiness:      number | null  // provider readiness/recovery score 0-100
}

// TODO: Fetch the most recent vitals summary for a Junction user.
// Returns a JunctionVitals object, or null when Junction is not configured
// or the user has no connected devices.
// Docs: https://docs.junction.tryvital.io/api-reference/vitals/hrv
//       https://docs.junction.tryvital.io/api-reference/sleep/get-sleep
export async function fetchLatestVitals(junctionUserId: string): Promise<JunctionVitals | null> {
  const cfg = getConfig()
  if (!cfg) {
    console.log('Junction not configured — fetchLatestVitals skipped')
    return null
  }

  // TODO: implement
  // GET ${cfg.baseUrl}/v2/summary/vitals/${junctionUserId}?start_date=<yesterday>
  // GET ${cfg.baseUrl}/v2/summary/sleep/${junctionUserId}?start_date=<yesterday>
  // Map provider fields → JunctionVitals shape above
  void junctionUserId
  return null
}
