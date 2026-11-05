// API streaming CSD Soler v0.2: partidos + acceso por PIN + backoffice.
// Contrato estable para la fase Mercado Pago (solo cambia el metodo de acceso).
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const HLS_BASE = (process.env.HLS_BASE || "https://hls.streaming.csdsoler.com.ar").replace(/\/$/, "");
const WEB_ORIGIN = (process.env.WEB_ORIGIN || "https://streaming.csdsoler.com.ar").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const SEED_PIN = process.env.SEED_PIN || "1234";
const SEED_RIVAL = process.env.SEED_RIVAL || "Rival a definir";

if (!DATABASE_URL) {
  console.error("FATAL: falta DATABASE_URL");
  process.exit(1);
}
if (!ADMIN_TOKEN) {
  console.error("FATAL: falta ADMIN_TOKEN (ver vps/.env.example)");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.disable("x-powered-by");
app.use(express.json());

// CORS para web en otro subdominio, con cookies.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", WEB_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie || "";
  h.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setGrantCookie(res, token) {
  res.header(
    "Set-Cookie",
    `stream_grant=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${COOKIE_SECURE ? "; Secure" : ""}`
  );
}
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function windowStatus(m, now = new Date()) {
  const s = new Date(m.starts_at);
  const e = new Date(m.ends_at);
  if (now < s) return "upcoming";
  if (now > e) return "ended";
  return "live";
}
const publicMatch = (m) => ({
  id: m.id,
  title: m.title,
  rival: m.rival,
  starts_at: m.starts_at,
  ends_at: m.ends_at,
  status: windowStatus(m),
});
const hlsUrl = (m) => `${HLS_BASE}/live/${m.stream_key}/index.m3u8`;

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'CSD Soler TV',
      rival TEXT NOT NULL DEFAULT 'Rival a definir',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      stream_key TEXT NOT NULL DEFAULT 'test',
      pin_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS grants (
      token TEXT PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_grants_match ON grants(match_id);
  `);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM matches");
  if (rows[0].n === 0) {
    await pool.query(
      `INSERT INTO matches (title, rival, starts_at, ends_at, stream_key, pin_hash)
       VALUES ('CSD Soler vs ' || $2, $2, now() - interval '30 minutes', now() + interval '2 hours', 'test', $1)`,
      [sha256(SEED_PIN), SEED_RIVAL]
    );
    console.log(`[api] seed: partido demo creado (PIN=${SEED_PIN})`);
  }
}

app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "streaming-api", version: "0.2.0" }));

// ---- Publico ----
app.get("/api/matches", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM matches ORDER BY starts_at DESC LIMIT 20");
    res.json(rows.map(publicMatch));
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.get("/api/matches/current", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM matches ORDER BY starts_at DESC LIMIT 20");
    const now = new Date();
    const live = rows.find((m) => windowStatus(m, now) === "live");
    const next = rows.filter((m) => windowStatus(m, now) === "upcoming").pop();
    const m = live || next || rows[0];
    if (!m) return res.status(404).json({ error: "sin partidos" });
    res.json(publicMatch(m));
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.post("/api/access", async (req, res) => {
  const { matchId, pin } = req.body || {};
  if (!matchId || !pin) return res.status(400).json({ error: "matchId y pin requeridos" });
  try {
    const { rows } = await pool.query("SELECT * FROM matches WHERE id = $1", [matchId]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "partido inexistente" });
    if (sha256(pin) !== m.pin_hash) return res.status(403).json({ error: "PIN incorrecto" });
    const token = crypto.randomBytes(24).toString("hex");
    await pool.query("INSERT INTO grants (token, match_id, expires_at) VALUES ($1, $2, $3)", [
      token,
      m.id,
      m.ends_at,
    ]);
    setGrantCookie(res, token);
    res.json({ ok: true, match: publicMatch(m), token });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.get("/api/me", async (req, res) => {
  const { matchId } = req.query;
  const token = parseCookies(req).stream_grant;
  if (!token || !matchId) return res.json({ hasAccess: false });
  try {
    const { rows } = await pool.query(
      "SELECT g.*, m.ends_at FROM grants g JOIN matches m ON m.id = g.match_id WHERE g.token = $1 AND g.match_id = $2 AND g.expires_at > now()",
      [token, matchId]
    );
    res.json({ hasAccess: rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// URL del stream: solo con grant valido y dentro de la ventana.
app.get("/api/matches/:id/stream", async (req, res) => {
  const token = parseCookies(req).stream_grant;
  if (!token) return res.status(401).json({ error: "sin acceso" });
  try {
    const { rows } = await pool.query("SELECT * FROM matches WHERE id = $1", [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "partido inexistente" });
    const g = await pool.query(
      "SELECT 1 FROM grants WHERE token = $1 AND match_id = $2 AND expires_at > now()",
      [token, m.id]
    );
    if (g.rows.length === 0) return res.status(401).json({ error: "sin acceso" });
    const st = windowStatus(m);
    if (st !== "live")
      return res.status(403).json({ error: st === "upcoming" ? "not_started" : "ended", match: publicMatch(m) });
    res.json({ hlsUrl: hlsUrl(m) });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// ---- Admin (x-admin-token) ----
function requireAdmin(req, res, next) {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return res.status(401).json({ error: "admin no autorizado" });
  next();
}
app.get("/api/admin/matches", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query("SELECT id,title,rival,starts_at,ends_at,stream_key,created_at FROM matches ORDER BY starts_at DESC");
  res.json(rows.map((m) => ({ ...m, status: windowStatus(m) })));
});
app.post("/api/admin/matches", requireAdmin, async (req, res) => {
  const { title, rival, starts_at, ends_at, stream_key, pin } = req.body || {};
  if (!rival || !starts_at || !ends_at || !stream_key || !pin)
    return res.status(400).json({ error: "rival, starts_at, ends_at, stream_key y pin requeridos" });
  const { rows } = await pool.query(
    `INSERT INTO matches (title, rival, starts_at, ends_at, stream_key, pin_hash)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,title,rival,starts_at,ends_at,stream_key,created_at`,
    [title || `CSD Soler vs ${rival}`, rival, starts_at, ends_at, stream_key, sha256(pin)]
  );
  res.status(201).json(rows[0]);
});
app.patch("/api/admin/matches/:id", requireAdmin, async (req, res) => {
  const allowed = ["title", "rival", "starts_at", "ends_at", "stream_key"];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      vals.push(req.body[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (req.body.pin) {
    vals.push(sha256(req.body.pin));
    sets.push(`pin_hash = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: "nada para actualizar" });
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE matches SET ${sets.join(", ")} WHERE id = $${vals.length}
     RETURNING id,title,rival,starts_at,ends_at,stream_key,created_at`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: "partido inexistente" });
  res.json(rows[0]);
});
app.delete("/api/admin/matches/:id", requireAdmin, async (req, res) => {
  const r = await pool.query("DELETE FROM matches WHERE id = $1", [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: "partido inexistente" });
  res.json({ ok: true });
});

// Webhook MP (fase siguiente): placeholder con contrato final.
app.post("/payments/webhook", (_req, res) => {
  res.status(501).json({ error: "Mercado Pago no integrado aun (fase PIN)." });
});

initDb()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`[api] :${PORT} web=${WEB_ORIGIN} hls=${HLS_BASE}`)))
  .catch((e) => {
    console.error("FATAL db init:", e.message);
    process.exit(1);
  });
