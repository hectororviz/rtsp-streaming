# club-bridge — puente DVR(RTSP) → VPS

Binario único Go, sin nada hardcodeado. Lee `config.yaml`, levanta `ffmpeg -c copy`
y lo supervisa (restart infinito). Corre igual en Arch (dev) y Ubuntu (club).

## Layout

```
main.go                    CLI (run|validate|print-ffmpeg|version)
internal/config/           yaml + env overrides + validacion + PublishURL
internal/bridge/           BuildArgs ffmpeg + supervisor con backoff
internal/health/           GET /healthz -> {ffmpeg_running, restarts, uptime}
config.example.yaml        plantilla prod
config.yaml                dev local (loopback)
systemd/*.template         servicio + env example
install.sh                 instalador Arch/Ubuntu
docker-compose.yml         prueba E2E local
```

## Uso rapido (tu Arch)

```bash
cd club-bridge
go mod tidy
go run . validate --config ./config.yaml
go run . print-ffmpeg --config ./config.yaml   # ver comando sin correr
BRIDGE_RTSP_URL=rtsp://... BRIDGE_ENDPOINT=rtsp://vps:8554/live/x go run . --config ./config.yaml
curl localhost:8081/healthz
```

## Config

Resolucion: `--config` > `$BRIDGE_CONFIG` > `./config.yaml` > `/etc/stream-bridge/config.yaml`.

Overrides env (pisan yaml): `BRIDGE_RTSP_URL`, `BRIDGE_TRANSPORT`,
`BRIDGE_ENDPOINT`, `BRIDGE_PUBLISH_USER`, `BRIDGE_PUBLISH_PASSWORD`,
`BRIDGE_LOG_LEVEL`, `BRIDGE_HEALTH_PORT`, `BRIDGE_HEALTH_ENABLED`.

Password nunca en yaml: se lee de `$BRIDGE_PUBLISH_PASSWORD_ENV`
(default `BRIDGE_PUBLISH_PASSWORD`).

## Instalacion prod (Ubuntu club, igual en Arch)

```bash
sudo ./install.sh --config ./config.yaml   # compila si falta binario
sudo nano /etc/stream-bridge/config.yaml
sudo nano /etc/stream-bridge/bridge.env    # BRIDGE_PUBLISH_PASSWORD=...
sudo systemctl enable --now club-bridge
journalctl -u club-bridge -f
```

## Notas

- Default `-c copy` (sin recodificar). Si el DVR da H.265 incompatible,
  poner `copy_codec: false` + args de transcode en `extra_ffmpeg_args`.
- Siempre publicar hacia el VPS por WireGuard; nunca abrir puertos en el club.
- `max_retries: 0` = infinito, lo correcto para el club.
