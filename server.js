// ============================================================
// PRO CAPITAL DATA — RETELL PROXY SERVER (SDK VERSION)
// Deploys to Railway. Holds the Retell API key server-side.
// Uses the official retell-sdk package instead of raw fetch,
// which handles auth headers exactly as Retell expects.
// ============================================================

const express = require('express');
const cors    = require('cors');
const Retell  = require('retell-sdk').default;
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── ENVIRONMENT VARIABLES (set these in Railway dashboard) ──
// RETELL_API_KEY       = (set in Railway Variables tab — never commit the real key here)
// ALLOWED_ORIGIN       = https://procapitaldata.com
// PORT                 = (Railway sets this automatically)

app.use(express.json());

// Defensive CORS setup — trims any stray whitespace/newlines from the
// env var so a malformed Railway variable can never crash setHeader().
const rawOrigin = process.env.ALLOWED_ORIGIN || 'https://procapitaldata.com';
const cleanOrigin = String(rawOrigin).trim();

console.log('[RETELL PROXY] CORS origin set to:', JSON.stringify(cleanOrigin));

app.use(cors({
  origin: cleanOrigin,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ── RETELL SDK CLIENT ────────────────────────────────────────
const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error('[RETELL PROXY] WARNING: RETELL_API_KEY env var is not set!');
} else {
  // Log only the first 10 chars to confirm which key is loaded,
  // without ever printing the full secret to logs.
  console.log('[RETELL PROXY] Loaded API key starting with:', RETELL_API_KEY.substring(0, 10) + '...');
}

const client = new Retell({
  apiKey: RETELL_API_KEY,
});

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PCM Data Retell Proxy',
    timestamp: new Date().toISOString()
  });
});

// ── RETELL TOKEN ENDPOINT ────────────────────────────────────
app.post('/api/retell-token', async (req, res) => {
  const { agent_id } = req.body;

  if (!agent_id) {
    return res.status(400).json({ error: 'agent_id is required' });
  }

  try {
    const webCallResponse = await client.call.createWebCall({ agent_id });

    res.json({
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id
    });

    console.log(`[RETELL PROXY] ✅ Web call created — call_id: ${webCallResponse.call_id}`);

  } catch (err) {
    console.error('[RETELL PROXY] Retell SDK error:', err.message || err);
    console.error('[RETELL PROXY] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    res.status(500).json({ error: 'Retell API error', detail: err.message || String(err) });
  }
});

// ── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[PCM Data Retell Proxy] Running on port ${PORT}`);
});
