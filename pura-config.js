// pura-config.js
// PURA Health — Shared configuration
// Replace placeholder values before going live. See KEYS.md.

const PURA_CONFIG = {
  SUPABASE_URL: 'https://oljhhgodblludybhndgj.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY',
  // TO UPGRADE: Move ANTHROPIC_API_KEY to a Cloudflare Worker proxy
  // when scaling beyond beta. See KEYS.md for instructions.
  WEB3FORMS_KEY: 'YOUR_WEB3FORMS_KEY',
  ADMIN_EMAIL: 'viveapr@gmail.com',
  BASE_URL: 'https://pura-delta.vercel.app',
  AI_MODEL: 'claude-haiku-4-5-20251001'
};

const DC_PROFILES = {
  'harrison-coleman': {
    slug: 'harrison-coleman',
    clinic_id: '2f881c78-4d01-427a-b0a1-af58776869dc',
    name: 'Dr. Harrison Coleman', first: 'Harrison', last: 'Coleman',
    clinic: 'Helix Austin', city: 'Austin, TX',
    email: 'harrison@helixaustin.com', lang: 'en'
  },
  'yina-cuevas': {
    slug: 'yina-cuevas',
    clinic_id: 'fcce7ed3-596b-47db-9483-1ba246344959',
    name: 'Dr. Yina Cuevas', first: 'Yina', last: 'Cuevas',
    clinic: 'Mana Chiropractic', city: 'Austin, TX',
    email: 'yina@manachiropractic.com', lang: 'en'
  },
  'david-miranda': {
    slug: 'david-miranda',
    clinic_id: '93b45a3c-68fc-4fcc-94ab-c4cff6403ed4',
    name: 'Dr. David Miranda', first: 'David', last: 'Miranda',
    clinic: 'Quito Tropical', city: 'Miami, FL',
    email: 'david@quitotropicalchiro.com', lang: 'es'
  },
  'bryant-ramirez': {
    slug: 'bryant-ramirez',
    clinic_id: '02f13a65-9766-4e35-a6bb-daef1fb29ed6',
    name: 'Bryant Ramirez', first: 'Bryant', last: 'Ramirez',
    clinic: 'Mycelium Chiropractic', city: 'Austin, TX',
    email: 'bryant@myceliumchiro.com', lang: 'en'
  },
  'ian-brewer': {
    slug: 'ian-brewer',
    clinic_id: '8d1f6fb4-7a09-4a53-bf56-2f5ee6efb60f',
    name: 'Ian Brewer', first: 'Ian', last: 'Brewer',
    clinic: 'Anointed Vessel Chiropractic', city: 'Austin, TX',
    email: 'ian@anointedvessel.com', lang: 'en'
  },
  'denis-chang': {
    slug: 'denis-chang',
    clinic_id: 'eb0e6a05-b975-4108-945e-51b6df1f9588',
    name: 'Dr. Denis Chang', first: 'Denis', last: 'Chang',
    clinic: 'Optimize Health Chiropractic', city: 'Miami, FL',
    email: 'denis@optimizehealth.com', lang: 'en'
  }
};

// PURA Signal formula — authoritative version
function calcPURASignal(pain, sleepQuality, sleepHours, energy, stress, functional, mood) {
  const sleepNorm = Math.min(10, (parseFloat(sleepHours) / 8) * 10);
  const painInv   = 11 - parseInt(pain);
  const stressInv = 11 - parseInt(stress);
  return Math.round((
    (painInv / 10)                   * 0.25 +
    (parseInt(sleepQuality) / 10)    * 0.20 +
    (sleepNorm / 10)                 * 0.15 +
    (parseInt(energy) / 10)          * 0.15 +
    (stressInv / 10)                 * 0.10 +
    (parseInt(functional) / 10)      * 0.10 +
    (parseInt(mood) / 10)            * 0.05
  ) * 100);
}

function signalColor(s) {
  return s >= 80 ? '#22c55e' : s >= 65 ? '#6ee7b7' : s >= 40 ? '#f59e0b' : '#ef4444';
}
function signalLabel(s) {
  return s >= 80 ? 'Thriving' : s >= 65 ? 'On Track' : s >= 40 ? 'Needs Attention' : 'Alert';
}
function signalEmoji(s) {
  return s >= 80 ? '✅' : s >= 65 ? '🟢' : s >= 40 ? '⚠️' : '🚨';
}

// Supabase REST helpers
async function dbInsert(table, data) {
  try {
    const r = await fetch(`${PURA_CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': PURA_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${PURA_CONFIG.SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    return await r.json();
  } catch(e) { console.error('DB insert error:', e); return null; }
}

async function dbSelect(table, params = '') {
  try {
    const r = await fetch(`${PURA_CONFIG.SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': PURA_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${PURA_CONFIG.SUPABASE_ANON_KEY}`
      }
    });
    return await r.json();
  } catch(e) { console.error('DB select error:', e); return []; }
}

async function dbUpdate(table, id, data) {
  try {
    const r = await fetch(`${PURA_CONFIG.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': PURA_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${PURA_CONFIG.SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    return await r.json();
  } catch(e) { console.error('DB update error:', e); return null; }
}

// Claude AI helper — uses Haiku model, handles errors gracefully
async function askAI(systemPrompt, userPrompt, maxTokens = 500) {
  const dcKey = sessionStorage.getItem('dc_anthropic_key');
  const apiKey = dcKey || PURA_CONFIG.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY') return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: PURA_CONFIG.AI_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const d = await r.json();
    if (d.error) { console.error('AI error:', d.error); return null; }
    return d.content[0].text;
  } catch(e) { console.error('AI call error:', e); return null; }
}

async function chatWithAI(systemPrompt, messages, maxTokens = 400) {
  const dcKey = sessionStorage.getItem('dc_anthropic_key');
  const apiKey = dcKey || PURA_CONFIG.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY') return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: PURA_CONFIG.AI_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
      })
    });
    const d = await r.json();
    if (d.error) return null;
    return d.content[0].text;
  } catch(e) { return null; }
}

// Web3Forms email helper
async function sendEmail({ to, subject, body, fromName = 'PURA Health' }) {
  if (!PURA_CONFIG.WEB3FORMS_KEY || PURA_CONFIG.WEB3FORMS_KEY === 'YOUR_WEB3FORMS_KEY') {
    console.log('Email not sent — WEB3FORMS_KEY not set');
    return;
  }
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: PURA_CONFIG.WEB3FORMS_KEY,
        subject, from_name: fromName, to, message: body
      })
    });
  } catch(e) { console.error('Email error:', e); }
}

async function sendAdminCopy(subject, body) {
  await sendEmail({ to: PURA_CONFIG.ADMIN_EMAIL, subject: `[PURA Admin] ${subject}`, body });
}

function getDCSlug() {
  return new URLSearchParams(window.location.search).get('dc') || '';
}
function getDC() {
  return DC_PROFILES[getDCSlug()] || null;
}
function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function getDateDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
