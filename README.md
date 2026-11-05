# rtsp-streaming — plataforma de transmisión en vivo del club

Un partido, una cámara Full HD, hasta ~20 espectadores en el navegador con acceso pago.
Arquitectura: `DVR(RTSP) → club-bridge → WireGuard → VPS (MediaMTX → HLS) → web`.

```
 Cámara → DVR ──RTSP──▶ club-bridge (PC club, ffmpeg -c copy)
                              │  publica rtsp por WireGuard (saliente, sin abrir puertos)
                              ▼
 VPS Canadá: wireguard ──▶ mediamtx ──HLS──▶ caddy-docker-proxy ──HTTPS──▶ navegador
                              ▲                    ┌── streaming.csdsoler.com.ar (web)
                              │                    ├── api.streaming.csdsoler.com.ar (api)
            api ──▶ db (postgres, red interna)      └── hls.streaming.csdsoler.com.ar (hls)
```

## Estructura

| Carpeta | Qué es |
|---|---|
| `club-bridge/` | Puente Go (binario único). Lee RTSP del DVR y lo republica al VPS. Ver `club-bridge/README.md`. |
| `vps/` | Lado servidor, todo dockerizado detrás de `caddy-docker-proxy`. Ver `vps/README.md`. |
| `.github/workflows/docker.yml` | CI: buildea `api`, `web`, `club-bridge` y publica en GHCR. |

Dominios:

| Servicio | Dominio | Origen |
|---|---|---|
| web | `streaming.csdsoler.com.ar` | `vps/web` (placeholder nginx → React) |
| api | `api.streaming.csdsoler.com.ar` | `vps/api` (placeholder express → NestJS) |
| hls | `hls.streaming.csdsoler.com.ar` | `mediamtx:8889` |

## Puesta en marcha (orden recomendado)

### 0. Relevamiento (antes de tocar código)

- DVR: marca/modelo, URL RTSP, códec (H.264 ideal), resolución/FPS/bitrate.
- Internet del club: subida real sostenida (≥ 4 Mbps + margen).
- VPS: CPU/RAM, salida y transferencia mensual, UDP 51820 abierto.
- Definir: precio, duración del acceso, dispositivos por compra, latencia aceptable (v1 = HLS).

### 1. Puente del club

```bash
cd club-bridge
cp config.example.yaml config.yaml   # o editá config.yaml (dev)
# completar input.rtsp_url y output.endpoint
go run . validate --config ./config.yaml
go run . print-ffmpeg --config ./config.yaml
BRIDGE_PUBLISH_PASSWORD=... go run . --config ./config.yaml
curl localhost:8081/healthz
```

Instalación en la PC del club (Arch o Ubuntu, ver `install.sh`):

```bash
sudo ./install.sh --config ./config.yaml
sudo nano /etc/stream-bridge/config.yaml
sudo nano /etc/stream-bridge/bridge.env   # BRIDGE_PUBLISH_PASSWORD=...
sudo systemctl enable --now club-bridge
journalctl -u club-bridge -f
```

Contrato del puente: todo por `config.yaml` + env (`BRIDGE_RTSP_URL`,
`BRIDGE_ENDPOINT`, `BRIDGE_PUBLISH_USER`, `BRIDGE_PUBLISH_PASSWORD`, …),
password nunca en el yaml, restart infinito (`max_retries: 0`).

### 2. VPS

Requisitos: Docker + compose, red externa `caddy_net`, `caddy-docker-proxy`
escuchando en `caddy_net`, DNS de los 3 subdominios → IP del VPS.

```bash
cd vps
cp .env.example .env                 # completar POSTGRES_PASSWORD
mkdir -p wireguard/config
cp wireguard/wg0.conf.example wireguard/config/wg0.conf  # completar claves
docker compose up -d db mediamtx wireguard
docker compose up -d api web
curl https://api.streaming.csdsoler.com.ar/healthz
```

El puente publica `rtsp://club1:<pass>@mediamtx:8554/live/<partido>`
(pass = el de `vps/mediamtx/mediamtx.yml`); se ve en
`https://streaming.csdsoler.com.ar` vía
`https://hls.streaming.csdsoler.com.ar/live/<partido>/index.m3u8`.

### 3. Imágenes (CI)

Push a `main` (o tag `v*`) → GitHub Actions buildea `linux/amd64` y publica:

- `ghcr.io/hectororviz/rtsp-streaming-api`
- `ghcr.io/hectororviz/rtsp-streaming-web`
- `ghcr.io/hectororviz/rtsp-streaming-club-bridge`

En el VPS, `docker compose pull && docker compose up -d` toma `:latest`.

## Seguridad

- El club solo abre conexiones **salientes** (WG + RTSP publish). Nada del DVR en internet.
- RTSP/MediaMTX sin puertos públicos; HLS/API/web solo por HTTPS vía caddy.
- `db` aislada en red `backend`, sin labels ni puertos.
- Pagos: el acceso se habilita solo por webhook server-side de Mercado Pago (el
  placeholder devuelve 501 hasta integrar NestJS + MP).
- Secretos (`POSTGRES_PASSWORD`, `BRIDGE_PUBLISH_PASSWORD`, `wg0.conf`, `vps/.env`)
  **nunca** se commitean (ver `.gitignore`).

## Estado / roadmap

- [x] Puente funcional (supervisión, health, systemd, docker test).
- [x] VPS dockerizado detrás de caddy-docker-proxy + CI a GHCR.
- [x] Demo E2E: PIN + landing + player HLS + backoffice.
- [x] Home con modal de acceso (PIN / Mercado Pago pendiente), personalización
  (nombre, escudo, colores) y validez por día; PIN auto-generado y visible.
- [ ] API real de pagos (Mercado Pago: checkout + webhook + grants).
- [ ] Web final (reemplazar PIN por checkout; retener landing/player/admin).
- [ ] WebRTC de baja latencia (`rtc.streaming.csdsoler.com.ar`).
- [ ] Multi-cámara / multi-club (más stream-keys, mismo patrón).
