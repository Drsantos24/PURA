var PURA = {
  SB_URL: 'https://oljhhgodblludybhndgj.supabase.co',
  SB_KEY: 'YOUR_SUPABASE_ANON_KEY',
  AI_KEY: 'YOUR_ANTHROPIC_API_KEY',
  AI_MODEL: 'claude-haiku-4-5-20251001',
  MAIL_KEY: 'YOUR_WEB3FORMS_KEY',
  ADMIN_EMAIL: 'viveapr@gmail.com',
  ADMIN_PASS: 'pura2026santos',
  BASE: 'https://pura-delta.vercel.app'
};

var DC = {
  'harrison-coleman': { slug:'harrison-coleman', cid:'2f881c78-4d01-427a-b0a1-af58776869dc', name:'Dr. Harrison Coleman', first:'Harrison', last:'Coleman', clinic:'Helix Austin', city:'Austin, TX', email:'harrison@helixaustin.com', lang:'en' },
  'yina-cuevas':      { slug:'yina-cuevas',      cid:'fcce7ed3-596b-47db-9483-1ba246344959', name:'Dr. Yina Cuevas',      first:'Yina',     last:'Cuevas',   clinic:'Mana Chiropractic',            city:'Austin, TX', email:'yina@manachiropractic.com',    lang:'en' },
  'david-miranda':    { slug:'david-miranda',    cid:'93b45a3c-68fc-4fcc-94ab-c4cff6403ed4', name:'Dr. David Miranda',    first:'David',    last:'Miranda',  clinic:'Quito Tropical',               city:'Miami, FL',  email:'david@quitotropicalchiro.com', lang:'es' },
  'bryant-ramirez':   { slug:'bryant-ramirez',   cid:'02f13a65-9766-4e35-a6bb-daef1fb29ed6', name:'Bryant Ramirez',       first:'Bryant',   last:'Ramirez',  clinic:'Mycelium Chiropractic',        city:'Austin, TX', email:'bryant@myceliumchiro.com',     lang:'en' },
  'ian-brewer':       { slug:'ian-brewer',       cid:'8d1f6fb4-7a09-4a53-bf56-2f5ee6efb60f', name:'Ian Brewer',           first:'Ian',      last:'Brewer',   clinic:'Anointed Vessel Chiropractic', city:'Austin, TX', email:'ian@anointedvessel.com',      lang:'en' },
  'denis-chang':      { slug:'denis-chang',      cid:'eb0e6a05-b975-4108-945e-51b6df1f9588', name:'Dr. Denis Chang',      first:'Denis',    last:'Chang',    clinic:'Optimize Health Chiropractic', city:'Miami, FL',  email:'denis@optimizehealth.com',    lang:'en' }
};

function calcSignal(pain, sleepQ, sleepH, energy, stress, func, mood) {
  var sh = Math.min(10, parseFloat(sleepH) / 8 * 10);
  return Math.round(((11 - parseInt(pain)) / 10 * 0.25 + parseInt(sleepQ) / 10 * 0.20 + sh / 10 * 0.15 + parseInt(energy) / 10 * 0.15 + (11 - parseInt(stress)) / 10 * 0.10 + parseInt(func) / 10 * 0.10 + parseInt(mood) / 10 * 0.05) * 100);
}
function sigColor(s) { return s >= 80 ? '#22c55e' : s >= 65 ? '#6ee7b7' : s >= 40 ? '#f59e0b' : '#ef4444'; }
function sigLabel(s) { return s >= 80 ? 'Thriving' : s >= 65 ? 'On Track' : s >= 40 ? 'Needs Attention' : 'Alert'; }
function sigBg(s)    { return s >= 80 ? 'rgba(34,197,94,0.12)' : s >= 65 ? 'rgba(110,231,183,0.12)' : s >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'; }

async function dbGet(table, params) {
  try {
    var url = PURA.SB_URL + '/rest/v1/' + table + (params ? '?' + params : '');
    var r = await fetch(url, { headers: { 'apikey': PURA.SB_KEY, 'Authorization': 'Bearer ' + PURA.SB_KEY } });
    return await r.json();
  } catch(e) { console.error('dbGet error', e); return []; }
}
async function dbPost(table, body) {
  try {
    var r = await fetch(PURA.SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { 'apikey': PURA.SB_KEY, 'Authorization': 'Bearer ' + PURA.SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    return await r.json();
  } catch(e) { console.error('dbPost error', e); return null; }
}
async function dbPatch(table, filter, body) {
  try {
    var r = await fetch(PURA.SB_URL + '/rest/v1/' + table + '?' + filter, {
      method: 'PATCH',
      headers: { 'apikey': PURA.SB_KEY, 'Authorization': 'Bearer ' + PURA.SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    return await r.json();
  } catch(e) { console.error('dbPatch error', e); return null; }
}

async function sendMail(to, subject, body, fromName) {
  if (!PURA.MAIL_KEY || PURA.MAIL_KEY === 'YOUR_WEB3FORMS_KEY') return false;
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_key: PURA.MAIL_KEY, subject: subject, from_name: fromName || 'PURA Health', to: to, message: body })
    });
    return true;
  } catch(e) { return false; }
}
function mailAdmin(subject, body) { return sendMail(PURA.ADMIN_EMAIL, '[PURA Admin] ' + subject, body, 'PURA System'); }

async function askAI(system, user, maxT) {
  var key = sessionStorage.getItem('dc_ai_key') || PURA.AI_KEY;
  if (!key || key === 'YOUR_ANTHROPIC_API_KEY') return null;
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: PURA.AI_MODEL, max_tokens: maxT || 500, system: system, messages: [{ role: 'user', content: user }] })
    });
    var d = await r.json();
    return (d && d.content && d.content[0]) ? d.content[0].text : null;
  } catch(e) { return null; }
}
async function chatAI(system, messages, maxT) {
  var key = sessionStorage.getItem('dc_ai_key') || PURA.AI_KEY;
  if (!key || key === 'YOUR_ANTHROPIC_API_KEY') return null;
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: PURA.AI_MODEL, max_tokens: maxT || 400, system: system, messages: messages })
    });
    var d = await r.json();
    return (d && d.content && d.content[0]) ? d.content[0].text : null;
  } catch(e) { return null; }
}

async function runAlerts(checkin, dc) {
  var rows = await dbGet('alert_thresholds', 'dc_slug=eq.' + dc.slug);
  var t = (rows && rows[0]) ? rows[0] : { signal_low_threshold:50, pain_high_threshold:7, stress_high_threshold:8, signal_high_threshold:85 };
  var sig = checkin.pura_index;
  var alerts = [];
  if (sig <= t.signal_low_threshold) alerts.push({ type:'alert_drop', msg:'PURA Signal critically low: ' + sig + '/100', urgent:true });
  if (checkin.pain_level >= t.pain_high_threshold) alerts.push({ type:'alert_pain', msg:'Pain level elevated: ' + checkin.pain_level + '/10', urgent:true });
  if (checkin.stress_level >= t.stress_high_threshold) alerts.push({ type:'alert_stress', msg:'Stress elevated: ' + checkin.stress_level + '/10', urgent:false });
  if (sig >= t.signal_high_threshold) alerts.push({ type:'alert_high', msg:'Excellent PURA Signal: ' + sig + '/100', urgent:false });
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    var pn = checkin.patient_first_name + ' ' + checkin.patient_last_name;
    var prefix = a.urgent ? 'URGENT PURA ALERT' : 'PURA Note';
    var subj = prefix + ': ' + pn + ' -- ' + a.msg;
    var emailBody = 'Patient: ' + pn + '\nPURA Signal: ' + sig + '/100 (' + sigLabel(sig) + ')\nAlert: ' + a.msg + '\n\nMetrics:\n  Pain: ' + checkin.pain_level + '/10\n  Sleep Quality: ' + checkin.sleep_quality + '/10\n  Sleep Hours: ' + checkin.sleep_hours + '\n  Energy: ' + checkin.energy_level + '/10\n  Stress: ' + checkin.stress_level + '/10\n\nNotes: "' + (checkin.patient_note || 'None') + '"\n\nView portal: ' + PURA.BASE + '/portal.html?dc=' + dc.slug;
    await dbPost('alerts', { clinic_id: dc.cid, alert_type: a.type, alert_message: a.msg, pura_index_current: sig, status: 'pending' });
    await sendMail(dc.email, subj, emailBody, 'PURA Health Alerts');
    await dbPost('notifications', { clinic_id: dc.cid, dc_slug: dc.slug, type: a.type, subject: subj, body: emailBody, sent_to: [dc.email, PURA.ADMIN_EMAIL], trigger_value: sig });
    await mailAdmin('Alert: ' + dc.clinic, emailBody);
  }
  return alerts;
}

async function refreshDC(dc) {
  var rows = await dbGet('clinics', 'id=eq.' + dc.cid + '&select=name,owner_name,email,city,state,phone,instagram,website');
  if (rows && rows[0]) {
    if (rows[0].name) dc.clinic = rows[0].name;
    if (rows[0].owner_name) dc.name = rows[0].owner_name;
    if (rows[0].email) dc.email = rows[0].email;
    if (rows[0].city && rows[0].state) dc.city = rows[0].city + ', ' + rows[0].state;
    dc.phone = rows[0].phone || '';
    dc.instagram = rows[0].instagram || '';
  }
  return dc;
}

function getSession() { return sessionStorage.getItem('pura_sess'); }
function getSessSlug() { return sessionStorage.getItem('pura_slug'); }
function setSession(slug, token) { sessionStorage.setItem('pura_sess', token); sessionStorage.setItem('pura_slug', slug); }
function clearSession() { sessionStorage.removeItem('pura_sess'); sessionStorage.removeItem('pura_slug'); }
function getDCSlug() { return new URLSearchParams(window.location.search).get('dc') || ''; }
function getDC() { return DC[getDCSlug()] || null; }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
function relTime(d) { if (!d) return 'Never'; var diff = Math.floor((Date.now() - new Date(d)) / 86400000); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff + ' days ago'; }
function fmtDate() { return new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }); }
function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function toast(msg, type) {
  var t = document.createElement('div');
  var bg = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#22c55e';
  t.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:9999;background:' + bg + ';color:#08080a;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);');
  t.textContent = msg; document.body.appendChild(t); setTimeout(function() { t.remove(); }, 3000);
}
function demoPts() {
  return [
    { id:'d1', first_name:'Maria',  last_name:'R.', pura_index:82, pain_level:3, sleep_quality:8, sleep_hours:7.5, energy_level:8, stress_level:4, functional_ability:8, mood:8, device_type:'Apple Watch', patient_note:'Feeling great after last adjustment', last_checkin_date:todayISO(), isDemo:true },
    { id:'d2', first_name:'James',  last_name:'T.', pura_index:61, pain_level:6, sleep_quality:5, sleep_hours:5.5, energy_level:5, stress_level:7, functional_ability:6, mood:5, device_type:'Whoop',        patient_note:'Stressful week',                    last_checkin_date:daysAgo(1), isDemo:true },
    { id:'d3', first_name:'Sofia',  last_name:'M.', pura_index:91, pain_level:1, sleep_quality:9, sleep_hours:8.5, energy_level:9, stress_level:2, functional_ability:9, mood:9, device_type:'Oura Ring',    patient_note:'',                                  last_checkin_date:todayISO(), isDemo:true },
    { id:'d4', first_name:'Robert', last_name:'K.', pura_index:45, pain_level:8, sleep_quality:4, sleep_hours:4.5, energy_level:3, stress_level:8, functional_ability:4, mood:4, device_type:'Garmin',       patient_note:'Flare-up after yard work',          last_checkin_date:daysAgo(3), isDemo:true },
    { id:'d5', first_name:'Ana',    last_name:'L.', pura_index:78, pain_level:4, sleep_quality:7, sleep_hours:7.0, energy_level:7, stress_level:5, functional_ability:7, mood:7, device_type:'Apple Watch',  patient_note:'',                                  last_checkin_date:todayISO(), isDemo:true },
    { id:'d6', first_name:'David',  last_name:'P.', pura_index:67, pain_level:5, sleep_quality:6, sleep_hours:6.5, energy_level:6, stress_level:6, functional_ability:7, mood:7, device_type:'Whoop',        patient_note:'Slight improvement this week',      last_checkin_date:daysAgo(1), isDemo:true }
  ];
}
