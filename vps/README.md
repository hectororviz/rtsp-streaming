# VPS streaming (dockerizado, detras de caddy-docker-proxy)

## Requisitos en el VPS
- Docker + plugin compose.
- Red externa `caddy_net` (la que usa tu caddy-docker-proxy):
  `docker network create caddy_net` (si no existe).
- `caddy-docker-proxy` corriendo en `caddy_net` con acceso al socket docker.
- DNS: `streaming`, `api.streaming`, `hls.streaming` → IP del VPS.

## Demo con acceso + backoffice

La web (`streaming.csdsoler.com.ar`) es el portal: landing `/` (qué es,
cómo ver, CTA) + partido en vivo en `/vivo` (alias `/partido` redirige).
`/vivo` exige acceso: sin cookie válida muestra la caja de acceso
(hoy PIN temporal vía `PinForm`, mañana checkout de Mercado Pago sin
cambiar el layout). El backoffice está en `/admin` (token `ADMIN_TOKEN`
del `.env`): crear/editar partidos (rival, inicio/fin, stream-key, PIN) y
preview del HLS. La API solo entrega la URL del stream con cookie de acceso
válida y dentro de la ventana `[starts_at, ends_at]`; fuera de ella el player
muestra "todavía no empezó" o "finalizada". Mercado Pago reutiliza este mismo
contrato (solo cambia el método de acceso).

Player: `hls.js` (`lowLatencyMode`) + fallback nativo Safari, sin escudo
superpuesto en el front (lo agrega el servidor en el stream).

## Primera vez
```bash
cd vps
cp .env.example .env            # completar POSTGRES_PASSWORD
mkdir -p wireguard/config
cp wireguard/wg0.conf.example wireguard/config/wg0.conf  # completar claves
docker compose up -d db mediamtx wireguard
docker compose up -d api web
docker compose ps
curl https://api.streaming.csdsoler.com.ar/healthz
```

## Flujo E2E
1. Puente del club (WireGuard `10.8.0.2`) publica
   `rtsp://club1:<pass>@mediamtx:8554/live/partido1`
   (pass = el de `vps/mediamtx/mediamtx.yml` = `BRIDGE_PUBLISH_PASSWORD` del club).
2. Ver en `https://streaming.csdsoler.com.ar` → reproduce
   `https://hls.streaming.csdsoler.com.ar/live/partido1/index.m3u8`.

## Notas
- `db` NO esta en `caddy_net` ni tiene labels: solo la ve `api` por red `backend`.
- MediaMTX no expone RTSP publico; HLS sale por caddy con HTTPS automatico.
- Placeholder: `api/` (express) y `web/` (nginx estatico) compilan y corren ya;
  se reemplazan por NestJS + React sin tocar el compose (mismos puertos/labels).
- CI (`.github/workflows/docker.yml`) publica en GHCR:
  `rtsp-streaming-api`, `rtsp-streaming-web`, `rtsp-streaming-club-bridge`.
