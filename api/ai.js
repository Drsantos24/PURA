export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var body = req.body;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  var geminiKey = process.env.GEMINI_API_KEY;
  var anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Try Gemini first (free tier)
  if (geminiKey) {
    try {
      var systemText = (body.system || '').trim();
      var contents = body.messages.map(function(m) {
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        };
      });

      var geminiPayload = { contents: contents };
      if (systemText) {
        geminiPayload.system_instruction = { parts: [{ text: systemText }] };
      }
      geminiPayload.generationConfig = {
        maxOutputTokens: parseInt(body.max_tokens) || 500,
        temperature: 0.7
      };

      var geminiResp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        }
      );

      var geminiData = await geminiResp.json();

      if (!geminiResp.ok) {
        console.error('[ai] Gemini error', geminiResp.status, JSON.stringify(geminiData).slice(0, 300));
        throw new Error('Gemini ' + geminiResp.status);
      }

      var text = geminiData &&
        geminiData.candidates &&
        geminiData.candidates[0] &&
        geminiData.candidates[0].content &&
        geminiData.candidates[0].content.parts &&
        geminiData.candidates[0].content.parts[0] &&
        geminiData.candidates[0].content.parts[0].text;

      if (!text) throw new Error('No text in Gemini response');

      console.log('[ai] Gemini OK, chars:', text.length);
      return res.status(200).json({
        content: [{ type: 'text', text: text }],
        stop_reason: 'end_turn',
        provider: 'gemini'
      });

    } catch (geminiErr) {
      console.error('[ai] Gemini failed:', geminiErr.message, '— trying Anthropic fallback');
    }
  }

  // Fallback: Anthropic
  if (anthropicKey && anthropicKey.startsWith('sk-ant')) {
    try {
      var antPayload = {
        model: body.model || 'claude-haiku-4-5-20251001',
        max_tokens: parseInt(body.max_tokens) || 500,
        messages: body.messages
      };
      if (body.system && body.system.trim()) {
        antPayload.system = body.system.trim();
      }

      var antResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(antPayload)
      });

      var antData = await antResp.json();
      if (!antResp.ok) {
        console.error('[ai] Anthropic error', antResp.status, JSON.stringify(antData).slice(0, 200));
        return res.status(antResp.status).json(antData);
      }

      console.log('[ai] Anthropic OK');
      return res.status(200).json(antData);

    } catch (antErr) {
      console.error('[ai] Anthropic failed:', antErr.message);
      return res.status(500).json({ error: 'AI request failed', detail: antErr.message });
    }
  }

  console.error('[ai] No AI provider available — set GEMINI_API_KEY in Vercel env vars');
  return res.status(503).json({
    error: 'AI service unavailable. Add GEMINI_API_KEY to Vercel environment variables.',
    providers_checked: { gemini: !!geminiKey, anthropic: !!anthropicKey }
  });
}
