// ============================================================
// PRO CAPITAL DATA — RETELL PROXY SERVER
// Deploys to Railway. Holds the Retell API key server-side.
// The landing page calls /api/retell-token, this server calls
// Retell directly and returns only the access_token to the
// browser. The raw API key never reaches the client.
// ============================================================

const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── ENVIRONMENT VARIABLES (set these in Railway dashboard) ──
// RETELL_API_KEY       = (set in Railway Variables tab — never commit the real key here)
// ALLOWED_ORIGIN       = https://procapitaldata.com
// PORT                 = (Railway sets this automatically)

app.use(express.json());

// Defensive CORS setup — trims any stray whitespace/newlines from the
// env var so a malformed Railway variable can never crash setHeader()
// with ERR_INVALID_CHAR again.
const rawOrigin = process.env.ALLOWED_ORIGIN || 'https://procapitaldata.com';
const cleanOrigin = String(rawOrigin).trim();

console.log('[RETELL PROXY] CORS origin set to:', JSON.stringify(cleanOrigin));

app.use(cors({
  origin: cleanOrigin,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ── HEALTH CHECK — Railway uses this to confirm daemon is alive
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PCM Data Retell Proxy',
    timestamp: new Date().toISOString()
  });
});

// ── RETELL TOKEN ENDPOINT ────────────────────────────────────
// Called by the Commander Dashboard on the landing page.
// Creates a Retell web call and returns the access_token.
// The Retell API key stays here on the server — never exposed.
app.post('/api/retell-token', async (req, res) => {
  const { agent_id } = req.body;

  if (!agent_id) {
    return res.status(400).json({ error: 'agent_id is required' });
  }

  const RETELL_API_KEY = process.env.RETELL_API_KEY;
  if (!RETELL_API_KEY) {
    console.error('[RETELL PROXY] RETELL_API_KEY env var not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ agent_id })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[RETELL PROXY] Retell API error:', errText);
      return res.status(response.status).json({ error: 'Retell API error', detail: errText });
    }

    const data = await response.json();

    // Return ONLY the access_token and call_id to the browser.
    // The raw API key is never included in this response.
    res.json({
      access_token: data.access_token,
      call_id:      data.call_id
    });

    console.log(`[RETELL PROXY] ✅ Web call created — call_id: ${data.call_id}`);

  } catch (err) {
    console.error('[RETELL PROXY] Fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[PCM Data Retell Proxy] Running on port ${PORT}`);
  console.log(`[PCM Data Retell Proxy] Allowed origin: ${process.env.ALLOWED_ORIGIN || 'https://procapitaldata.com'}`);
});
