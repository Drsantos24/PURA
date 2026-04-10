export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'AI key not configured' });
  }

  try {
    var body = req.body;
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    var data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'AI request failed', detail: e.message });
  }
}
