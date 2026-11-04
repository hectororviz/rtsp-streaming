#!/usr/bin/env bash
# Instalador distro-agnostico: Arch y Ubuntu (systemd).
# Uso: sudo ./install.sh [--config /ruta/config.yaml] [--binary ./club-bridge]
set -euo pipefail

CONFIG_SRC="./config.yaml"
BIN_SRC="./club-bridge"
PREFIX="/usr/local/bin"
CONF_DIR="/etc/stream-bridge"
CONF_DST="$CONF_DIR/config.yaml"
ENV_DST="$CONF_DIR/bridge.env"
SERVICE_DST="/etc/systemd/system/club-bridge.service"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_SRC="$2"; shift 2;;
    --binary) BIN_SRC="$2"; shift 2;;
    *) echo "uso: sudo ./install.sh [--config <yaml>] [--binary <bin>]"; exit 2;;
  esac
done

if [[ $EUID -ne 0 ]]; then echo "corre con sudo"; exit 1; fi

echo "== chequeos =="
command -v ffmpeg >/dev/null || { echo "ERROR: falta ffmpeg. Ubuntu: apt install ffmpeg | Arch: pacman -S ffmpeg"; exit 1; }
command -v systemctl >/dev/null || { echo "ERROR: sin systemd"; exit 1; }
if command -v wg >/dev/null || command -v wg-quick >/dev/null; then echo "wireguard: ok"; else echo "WARN: wireguard no encontrado (wg/wg-quick). Instalalo para prod."; fi

if [[ ! -f "$BIN_SRC" ]]; then
  echo "binario no encontrado en $BIN_SRC, compilando..."
  if command -v go >/dev/null; then
    (cd "$(dirname "$0")" && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o club-bridge .)
    BIN_SRC="./club-bridge"
  else
    echo "ERROR: ni binario ni go para compilar"; exit 1
  fi
fi

echo "== instalando =="
mkdir -p "$CONF_DIR"
install -m 0755 "$BIN_SRC" "$PREFIX/club-bridge"
if [[ -f "$CONF_DST" ]]; then
  echo "config existente conservada: $CONF_DST (nueva en $CONF_DST.nuevo)"
  install -m 0644 "$CONFIG_SRC" "$CONF_DST.nuevo"
else
  install -m 0644 "$CONFIG_SRC" "$CONF_DST"
fi
if [[ ! -f "$ENV_DST" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [[ -f "$SCRIPT_DIR/systemd/bridge.env.example" ]]; then
    install -m 0600 "$SCRIPT_DIR/systemd/bridge.env.example" "$ENV_DST"
  else
    install -m 0600 /dev/null "$ENV_DST"
    echo "# completa BRIDGE_PUBLISH_PASSWORD" >> "$ENV_DST"
  fi
  echo "creado $ENV_DST (completa el password, perms 600)"
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
install -m 0644 "$SCRIPT_DIR/systemd/club-bridge.service.template" "$SERVICE_DST"

systemctl daemon-reload
echo "== validando =="
"$PREFIX/club-bridge" validate --config "$CONF_DST" || echo "WARN: valida la config ($CONF_DST) y bridge.env"
echo ""
echo "listo. Siguiente:"
echo "  1. edita $CONF_DST y $ENV_DST"
echo "  2. sudo systemctl enable --now club-bridge"
echo "  3. journalctl -u club-bridge -f  |  curl localhost:8081/healthz"
