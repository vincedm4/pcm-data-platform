const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://procapitaldata.com',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PCM Data Retell Proxy', timestamp: new Date().toISOString() });
});

app.post('/api/retell-token', async (req, res) => {
  const { agent_id } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });
  const RETELL_API_KEY = process.env.RETELL_API_KEY;
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'Server configuration error' });
  try {
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Retell API error', detail: errText });
    }
    const data = await response.json();
    res.json({ access_token: data.access_token, call_id: data.call_id });
    console.log(`[RETELL PROXY] Call created — call_id: ${data.call_id}`);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[PCM Data Retell Proxy] Running on port ${PORT}`);
});
