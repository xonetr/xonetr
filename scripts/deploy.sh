#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-up}"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker no está instalado o no está en PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Docker Compose no está disponible."
  exit 1
fi

if [[ ! -f backend/.env ]]; then
  if [[ -f backend/.env.example ]]; then
    cp backend/.env.example backend/.env
    echo "✅ Se creó backend/.env a partir del ejemplo. Ajustá los valores antes de desplegar."
  else
    echo "❌ No existe backend/.env ni backend/.env.example."
    exit 1
  fi
fi

case "$ACTION" in
  up)
    echo "🚀 Construyendo y levantando servicios..."
    docker compose up --build -d
    echo
    echo "🌐 Frontend: http://localhost:5173"
    echo "🔧 Backend:  http://localhost:8000/api/health"
    echo "📦 Volúmenes: backend-data, frontend-node-modules"
    ;;
  down)
    echo "🛑 Deteniendo servicios..."
    docker compose down
    ;;
  logs)
    docker compose logs -f --tail=200
    ;;
  ps)
    docker compose ps
    ;;
  *)
    echo "Uso: $0 [up|down|logs|ps]"
    exit 1
    ;;
 esac
