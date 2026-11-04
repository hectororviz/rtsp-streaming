# rtsp-streaming — plataforma de transmision en vivo del club

- `club-bridge/` — puente Go DVR(RTSP) → VPS. Binario unico, config por `config.yaml` + env. Ver su README.
- `vps/` — lado servidor, todo dockerizado detras de `caddy-docker-proxy` (red `caddy_net`):
  `wireguard` + `mediamtx` + `api` + `web` + `db` (postgres aparte).
- `.github/workflows/docker.yml` — CI que publica imagenes en GHCR.

Dominios: `streaming.csdsoler.com.ar` (web), `api.streaming.csdsoler.com.ar`,
`hls.streaming.csdsoler.com.ar`.
