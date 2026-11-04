// Placeholder: contrato minimo. Reemplazar por NestJS + PostgreSQL + Mercado Pago.
// Endpoints que el front espera (v1):
//   GET  /healthz
//   GET  /api/matches            -> [{id, title, status, hlsUrl}]
//   POST /api/checkout/:id       -> {checkoutUrl} (501 hasta MP real)
//   POST /payments/webhook       -> validacion server-side MP (501 hasta MP real)
const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const HLS_BASE = process.env.HLS_BASE || "https://hls.streaming.csdsoler.com.ar";

app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "api-placeholder" }));

app.get("/api/matches", (_req, res) => {
  res.json([
    {
      id: "partido1",
      title: "Partido demo (API placeholder)",
      status: "live",
      hlsUrl: `${HLS_BASE}/live/partido1/index.m3u8`,
    },
  ]);
});

app.post("/api/checkout/:id", (req, res) => {
  res.status(501).json({ error: "Mercado Pago no integrado aun (placeholder).", matchId: req.params.id });
});

app.post("/payments/webhook", (_req, res) => {
  res.status(501).json({ error: "Webhook MP no implementado aun (placeholder)." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`[api] escuchando en :${PORT} hls=${HLS_BASE}`));
