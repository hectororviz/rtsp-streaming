# VPS streaming (dockerizado, detras de caddy-docker-proxy)

## Requisitos en el VPS
- Docker + plugin compose.
- Red externa `caddy_net` (la que usa tu caddy-docker-proxy):
  `docker network create caddy_net` (si no existe).
- `caddy-docker-proxy` corriendo en `caddy_net` con acceso al socket docker.
- DNS: `streaming`, `api.streaming`, `hls.streaming` → IP del VPS.

## Demo con acceso + backoffice

La web es el portal: landing `/` (info, próximo partido, CTA) + partido en vivo
en `/vivo` (alias `/partido` redirige). `/vivo` exige acceso: sin cookie válida
muestra la caja de acceso. En el home, "Ver en vivo" abre un modal con dos
pestañas: PIN funcional y Mercado Pago (pendiente, placeholder). El PIN y la
compra son válidos por el día del partido (el grant expira a las 23:59 de
America/Argentina del día del partido).

El backoffice está en `/admin` (token `ADMIN_TOKEN` del `.env`) con dos
pestañas:

- **Partidos**: crear fechas (rival, inicio/fin, stream-key). El PIN se genera
  solo al crear, se muestra siempre en la tabla y se puede regenerar.
- **Personalización**: nombre del sitio, descripción, escudo (PNG/JPG/WebP/SVG
  ≤ 512KB) y colores primario/secundario. Se sirve en `GET /api/settings` y la
  web lo aplica en vivo (header, título, favicon, acentos).

Player: `hls.js` (`lowLatencyMode`) + fallback nativo Safari, sin escudo
superpuesto en el front (lo agrega el servidor en el stream).

## Endpoints de personalización

- `GET /api/settings` → `{ site_name, tagline, shield, color_primary, color_secondary }` (público).
- `PUT /api/admin/settings` (header `x-admin-token`) → actualiza parcial;
  valida nombre (1-60), tagline (≤120), colores `#rrggbb` y escudo data-URL
  (PNG/JPG/WebP/SVG ≤ ~512KB).

## Web UI / maquetación

Rutas: `/` landing, `/vivo` (alias `/partido`), `/admin`.
Verificado con Playwright en 360 / 390 / 1280 sin `overflow-x`.

- Header sticky de 56px con `safe-area-inset`; hero con `text-wrap: balance`.
- Landing: CTA full-width en móvil, 3 cards en desktop, preview 16/9 con
  hover scale en el botón play.
- `/vivo`: player 16/9 centrado (`.player--narrow`, sin inline styles),
  acciones en grid 2-col (1-col en ≤380px).
- `/admin`: login con `.btn--red` e input `.input--token` (sin
  `letter-spacing` de PIN); tabla dentro de `.tbl-wrap` con scroll
  horizontal en móvil; botones con `.btn--sm` / `.btn--danger` / `.linklike`;
  link `← Volver al sitio` (solo navegación, sin lógica).
- Solo se tocaron clases/wrappers y `styles.css`; sin cambios de lógica,
  API ni contrato de acceso.

## Actualizar (solo VPS)

```bash
./vps/update.sh [rama]   # default: main
```

Baja los cambios de GitHub (`pull --ff-only`), hace `compose pull` + `up -d`
y chequea `/healthz`, `/` y `/vivo`. Solo toca el VPS, nunca `club-bridge`.
Si hay cambios locales sin commitear, aborta antes de tocar nada.

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
