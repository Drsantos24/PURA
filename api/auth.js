export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var SB_URL = process.env.SUPABASE_URL || 'https://oljhhgodblludybhndgj.supabase.co';
  var SB_KEY = process.env.SUPABASE_ANON_KEY;
  var ADMIN_EMAIL = 'viveapr@gmail.com';
  var MAX_ATTEMPTS = 5;
  var LOCKOUT_MINUTES = 30;

  var body = req.body;
  var slug = body.slug;
  var pin = body.pin;
  var ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  var ua = req.headers['user-agent'] || 'unknown';

  if (!slug || !pin) {
    return res.status(400).json({ error: 'slug and pin required' });
  }

  if (!SB_KEY) {
    console.error('[auth] SUPABASE_ANON_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  var sbHeaders = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  async function sbGet(table, params) {
    var r = await fetch(SB_URL + '/rest/v1/' + table + '?' + params, { headers: sbHeaders });
    return r.json();
  }
  async function sbPost(table, data) {
    var r = await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbHeaders, body: JSON.stringify(data) });
    return r.json();
  }
  async function sbPatch(table, filter, data) {
    var r = await fetch(SB_URL + '/rest/v1/' + table + '?' + filter, { method: 'PATCH', headers: sbHeaders, body: JSON.stringify(data) });
    return r.json();
  }

  // 1. Check lockout
  var lockouts = await sbGet('login_lockouts', 'slug=eq.' + slug + '&select=locked_until,failed_attempts');
  if (lockouts && lockouts[0] && lockouts[0].locked_until) {
    var lockedUntil = new Date(lockouts[0].locked_until);
    if (lockedUntil > new Date()) {
      var minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
      await sbPost('login_attempts', { slug: slug, ip_address: ip, user_agent: ua, success: false });
      await sbPost('security_events', { event_type: 'login_blocked_lockout', slug: slug, ip_address: ip, severity: 'warn', details: { minutes_remaining: minutesLeft } });
      console.log('[auth] Blocked locked slug:', slug, 'minutes left:', minutesLeft);
      return res.status(429).json({ error: 'Account locked. Try again in ' + minutesLeft + ' minutes.', locked: true, minutes: minutesLeft });
    }
  }

  // 2. Verify PIN via Supabase RPC (bcrypt)
  var verifyResp = await fetch(SB_URL + '/rest/v1/rpc/verify_dc_pin', {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify({ p_slug: slug, p_pin: pin })
  });
  var isValid = await verifyResp.json();

  // 3. Log the attempt
  await sbPost('login_attempts', { slug: slug, ip_address: ip, user_agent: ua, success: isValid === true });

  if (!isValid) {
    // Count recent failures in lockout window
    var since = new Date(Date.now() - LOCKOUT_MINUTES * 60000).toISOString();
    var attempts = await sbGet('login_attempts', 'slug=eq.' + slug + '&success=eq.false&attempted_at=gte.' + since + '&select=id');
    var failCount = Array.isArray(attempts) ? attempts.length : 0;

    console.log('[auth] Failed login for', slug, '— fail count:', failCount);

    if (failCount >= MAX_ATTEMPTS) {
      var lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
      var existing = await sbGet('login_lockouts', 'slug=eq.' + slug + '&select=id');
      if (existing && existing[0]) {
        await sbPatch('login_lockouts', 'slug=eq.' + slug, { locked_until: lockUntil, failed_attempts: failCount, updated_at: new Date().toISOString() });
      } else {
        await sbPost('login_lockouts', { slug: slug, locked_until: lockUntil, failed_attempts: failCount });
      }

      await sbPost('security_events', { event_type: 'account_locked', slug: slug, ip_address: ip, user_agent: ua, severity: 'critical', details: { failed_attempts: failCount, locked_until: lockUntil } });

      var formsKey = process.env.WEB3FORMS_KEY;
      if (formsKey) {
        await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_key: formsKey,
            subject: 'PURA SECURITY ALERT: Account locked — ' + slug,
            from_name: 'PURA Security',
            to: ADMIN_EMAIL,
            message: 'ACCOUNT LOCKED AFTER ' + failCount + ' FAILED ATTEMPTS\n\nSlug: ' + slug + '\nIP: ' + ip + '\nUser Agent: ' + ua + '\nLocked until: ' + lockUntil + '\n\nThis may be a brute force attack. Review immediately at:\nhttps://pura-delta.vercel.app/admin.html'
          })
        });
      }

      console.log('[auth] Account locked:', slug, 'until', lockUntil);
      return res.status(429).json({ error: 'Too many failed attempts. Account locked for ' + LOCKOUT_MINUTES + ' minutes.', locked: true, minutes: LOCKOUT_MINUTES });
    }

    var remaining = MAX_ATTEMPTS - failCount;
    await sbPost('security_events', { event_type: 'login_failed', slug: slug, ip_address: ip, severity: 'warn', details: { attempts_remaining: remaining } });
    return res.status(401).json({ error: 'Incorrect PIN. ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining.', attempts_remaining: remaining });
  }

  // 4. Success — clear lockout, create session
  var existingLock = await sbGet('login_lockouts', 'slug=eq.' + slug + '&select=id');
  if (existingLock && existingLock[0]) {
    await sbPatch('login_lockouts', 'slug=eq.' + slug, { locked_until: null, failed_attempts: 0, updated_at: new Date().toISOString() });
  }

  var token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  var expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  var authRows = await sbGet('dc_auth', 'slug=eq.' + slug + '&select=id,clinic_id,login_count');
  var rec = authRows && authRows[0] ? authRows[0] : {};

  await sbPatch('dc_auth', 'slug=eq.' + slug, {
    session_token: token,
    session_expires: expires,
    last_login: new Date().toISOString(),
    login_count: (rec.login_count || 0) + 1
  });

  await sbPost('security_events', { event_type: 'login_success', slug: slug, ip_address: ip, severity: 'info', details: { login_count: (rec.login_count || 0) + 1 } });

  console.log('[auth] Login success:', slug);

  return res.status(200).json({ success: true, token: token, expires: expires, clinic_id: rec.clinic_id });
}
