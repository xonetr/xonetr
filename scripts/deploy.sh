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

    # Compose releases published ports only after stopping/removing its containers.
    # Starting with a clean project state avoids Docker trying to bind 8010 while
    # a frontend container from a previous deployment is still active.
    docker compose down --remove-orphans >/dev/null

    if ! docker compose up --build -d; then
      echo
      echo "❌ No se pudo iniciar el frontend."

      for port in 8010 8000; do
        docker_containers="$(docker ps --filter "publish=${port}" --format '{{.Names}} ({{.Ports}})' 2>/dev/null || true)"
        if [[ -n "$docker_containers" ]]; then
          echo "Puerto ${port} ocupado por:"
          echo "$docker_containers"
        fi
      done

      if command -v ss >/dev/null 2>&1; then
        listeners="$(ss -H -ltnp "( sport = :8010 or sport = :8000 )" 2>/dev/null || true)"
        if [[ -n "$listeners" ]]; then
          echo "Oyentes del sistema:"
          echo "$listeners"
        fi
      fi
      exit 1
    fi
    echo
    echo "🌐 Frontend: http://localhost:8010"
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
