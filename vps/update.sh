#!/usr/bin/env bash
# update.sh — baja cambios de GitHub y levanta las imágenes nuevas (solo VPS).
# No toca club-bridge (corre en la PC del club, no acá).
#
# Uso: ./update.sh [rama]   (por defecto: main)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-main}"

echo "==> Rama: $BRANCH"

# Abortamos si hay cambios locales en archivos trackeados: un pull podría
# pisarlos (o un up aplicaría un compose/mediamtx.yml a medio editar).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "!! Hay cambios locales sin commitear. Hacé commit o stash antes de actualizar:"
  git status --short
  exit 1
fi

echo "==> git fetch origin"
git fetch origin

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "==> Ya estás al día ($LOCAL). Refresco imágenes por si CI publicó tags nuevos."
else
  echo "==> Actualizando $LOCAL -> $REMOTE"
  git pull --ff-only origin "$BRANCH"
fi

cd "$ROOT/vps"

# El yml real (con password) vive solo en el VPS, nunca en git.
if [ ! -f mediamtx/mediamtx.yml ]; then
  echo "!! Falta mediamtx/mediamtx.yml (está ignorado en git). Crealo desde la plantilla:"
  echo "   cp mediamtx/mediamtx.yml.example mediamtx/mediamtx.yml  # y poné la password real"
  exit 1
fi

echo "==> docker compose pull"
docker compose pull

echo "==> docker compose up -d"
docker compose up -d

echo "==> Estado"
docker compose ps

echo "==> Health checks"
curl -sk -o /dev/null -w "api /healthz: %{http_code}\n" https://api.streaming.csdsoler.com.ar/healthz || true
curl -sk -o /dev/null -w "web /: %{http_code}\n" https://streaming.csdsoler.com.ar/ || true
curl -sk -o /dev/null -w "web /vivo: %{http_code}\n" https://streaming.csdsoler.com.ar/vivo || true

echo "Listo."
