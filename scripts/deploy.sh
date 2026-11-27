#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-up}"

if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 && [[ "$ACTION" != "down" ]]; then
  BRANCH="$(git -C "$ROOT_DIR" branch --show-current)"

  if [[ -n "$BRANCH" ]]; then
    echo "Actualizando repositorio (${BRANCH})..."
    if ! git -C "$ROOT_DIR" pull --ff-only origin "$BRANCH"; then
      echo "❌ No se pudo actualizar el repositorio. El despliegue fue cancelado para evitar usar código desactualizado."
      exit 1
    fi
  fi
fi

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

PUBLISH_ROOT="${PUBLISH_ROOT:-/var/www/xonetr}"

publish_frontend_build() {
  # El nginx del host sirve el front desde PUBLISH_ROOT, no desde el contenedor.
  # Sin este paso el build nuevo queda solo en el contenedor y la web pública sigue vieja.
  if [[ ! -d "$PUBLISH_ROOT" ]]; then
    echo "ℹ️  No existe ${PUBLISH_ROOT}; se salta la publicación estática (desarrollo local)."
    return 0
  fi

  if ! command -v sudo >/dev/null 2>&1 || ! command -v rsync >/dev/null 2>&1; then
    echo "❌ Se necesitan sudo y rsync para publicar el build en ${PUBLISH_ROOT}."
    return 1
  fi

  local container_id tmp_dir
  container_id="$(docker compose ps -q frontend | head -n 1)"

  if [[ -z "$container_id" ]]; then
    echo "❌ No se encontró el contenedor frontend para publicar el build."
    return 1
  fi

  tmp_dir="$(mktemp -d)"
  if ! docker cp "${container_id}:/usr/share/nginx/html/." "$tmp_dir/"; then
    echo "❌ No se pudo copiar el build desde el contenedor frontend."
    rm -rf "$tmp_dir"
    return 1
  fi

  if [[ ! -f "$tmp_dir/index.html" || ! -d "$tmp_dir/assets" ]]; then
    echo "❌ El build copiado no contiene index.html y assets/."
    rm -rf "$tmp_dir"
    return 1
  fi

  echo "📤 Publicando build en ${PUBLISH_ROOT}..."
  sudo install -d -o http -g http -m 755 "$PUBLISH_ROOT/assets"
  sudo rsync -a --delete --chown=http:http "$tmp_dir/assets/" "$PUBLISH_ROOT/assets/"
  sudo install -o http -g http -m 644 "$tmp_dir/index.html" "$PUBLISH_ROOT/index.html"
  rm -rf "$tmp_dir"

  if sudo nginx -t >/dev/null 2>&1; then
    if ! sudo systemctl reload nginx; then
      echo "⚠️  No se pudo recargar nginx; los archivos ya están publicados."
    fi
  else
    echo "⚠️  nginx -t falló; no se recargó nginx (revisá la configuración)."
  fi
}

case "$ACTION" in
  up)
    echo "🚀 Construyendo y levantando servicios..."

    # Compose releases published ports only after stopping/removing its containers.
    # Starting with a clean project state avoids Docker trying to bind 8010 while
    # a frontend container from a previous deployment is still active.
    docker compose down --remove-orphans >/dev/null

    BACKEND_HOST_PORT=""
    for port in {8011..8020}; do
      if ! ss -H -ltn "( sport = :${port} )" 2>/dev/null | grep -q .; then
        BACKEND_HOST_PORT="$port"
        break
      fi
    done

    if [[ -z "$BACKEND_HOST_PORT" ]]; then
      echo "❌ No hay puertos disponibles entre 8011 y 8020 para el backend."
      exit 1
    fi

    export BACKEND_HOST_PORT
    echo "🔧 Backend publicado en el puerto: ${BACKEND_HOST_PORT}"

    if ! docker compose up --build -d; then
      echo
      echo "❌ No se pudo iniciar el frontend."

      for port in 8010 "$BACKEND_HOST_PORT"; do
        docker_containers="$(docker ps --filter "publish=${port}" --format '{{.Names}} ({{.Ports}})' 2>/dev/null || true)"
        if [[ -n "$docker_containers" ]]; then
          echo "Puerto ${port} ocupado por:"
          echo "$docker_containers"
        fi
      done

      if command -v ss >/dev/null 2>&1; then
        listeners="$(ss -H -ltnp "( sport = :8010 or sport = :${BACKEND_HOST_PORT} )" 2>/dev/null || true)"
        if [[ -n "$listeners" ]]; then
          echo "Oyentes del sistema:"
          echo "$listeners"
        fi
      fi
      exit 1
    fi

    publish_frontend_build

    echo
    echo "🌐 Frontend: http://localhost:8010"
    echo "🔧 Backend:  http://localhost:${BACKEND_HOST_PORT}/api/health"
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
