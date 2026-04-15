export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var body = req.body;
  if (!body || !body.to || !body.subject) {
    return res.status(400).json({ error: 'to and subject required' });
  }

  var formsKey = process.env.WEB3FORMS_KEY;

  if (!formsKey) {
    console.error('[email] WEB3FORMS_KEY not set');
    return res.status(503).json({ error: 'Email service not configured' });
  }

  try {
    var r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: formsKey,
        subject: body.subject,
        from_name: body.fromName || 'PURA Health',
        to: body.to,
        message: body.text || ''
      })
    });

    var d = await r.json();
    console.log('[email] Sent to', body.to, '—', d.success ? 'OK' : 'FAILED');
    return res.status(r.ok ? 200 : 500).json({ success: d.success, method: 'web3forms', result: d });
  } catch (e) {
    console.error('[email] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
