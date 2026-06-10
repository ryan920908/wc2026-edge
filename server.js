require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const AF_KEY = process.env.AF_KEY;

app.use(cors({ origin: [`http://localhost:${PORT}`, 'http://127.0.0.1:' + PORT] }));
app.use(express.static(path.join(__dirname)));

// ── The Odds API 代理 ─────────────────────────────────────────
// GET /api/odds?sport=soccer_fifa_world_cup&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal
app.get('/api/odds', async (req, res) => {
  const sport = req.query.sport || 'soccer_fifa_world_cup';
  const params = new URLSearchParams({
    apiKey: ODDS_API_KEY,
    regions: req.query.regions || 'eu',
    markets: req.query.markets || 'h2h,spreads,totals',
    oddsFormat: req.query.oddsFormat || 'decimal',
  });
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params}`;
  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    // 把剩餘次數 header 透傳給前端
    const rem = upstream.headers.get('x-requests-remaining');
    const used = upstream.headers.get('x-requests-used');
    if (rem) res.set('x-requests-remaining', rem);
    if (used) res.set('x-requests-used', used);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── API-Football 代理 ─────────────────────────────────────────
// GET /api/af/:endpoint  (所有 query params 原封轉發)
app.get('/api/af/:endpoint', async (req, res) => {
  const params = new URLSearchParams(req.query);
  const url = `https://v3.football.api-sports.io/${req.params.endpoint}?${params}`;
  try {
    const upstream = await fetch(url, {
      headers: { 'x-apisports-key': AF_KEY, Accept: 'application/json' },
    });
    const data = await upstream.json();
    // 透傳 rate-limit headers
    ['x-ratelimit-requests-remaining', 'x-ratelimit-requests-limit'].forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.set(h, v);
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`WC2026 Edge server → http://localhost:${PORT}`);
  console.log(`  ODDS_API_KEY: ${ODDS_API_KEY ? '✅ 已載入' : '❌ 未設定'}`);
  console.log(`  AF_KEY:       ${AF_KEY ? '✅ 已載入' : '❌ 未設定'}`);
});
