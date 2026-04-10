export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.startsWith('sk-ant')) {
    console.error('[ai] ANTHROPIC_API_KEY missing or malformed');
    return res.status(500).json({ error: 'AI key not configured' });
  }

  var body = req.body;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    console.error('[ai] Bad request body:', JSON.stringify(body));
    return res.status(400).json({ error: 'messages array required' });
  }

  var payload = {
    model: body.model || 'claude-haiku-4-5-20251001',
    max_tokens: body.max_tokens || 500,
    messages: body.messages
  };
  if (body.system && typeof body.system === 'string' && body.system.trim()) {
    payload.system = body.system.trim();
  }

  console.log('[ai] Sending to Anthropic — model:', payload.model, 'messages:', payload.messages.length);

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    var data = await response.json();

    if (!response.ok) {
      console.error('[ai] Anthropic error', response.status, JSON.stringify(data));
    } else {
      console.log('[ai] OK — stop_reason:', data.stop_reason);
    }

    return res.status(response.status).json(data);
  } catch (e) {
    console.error('[ai] Fetch failed:', e.message);
    return res.status(500).json({ error: 'AI request failed', detail: e.message });
  }
}
