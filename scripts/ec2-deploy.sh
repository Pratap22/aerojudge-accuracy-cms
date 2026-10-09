#!/usr/bin/env bash
# Pull pre-built AeroJudge images and (re)start the stack on EC2.
# Usage:
#   ./scripts/ec2-deploy.sh
#   IMAGE_TAG=abc1234 ./scripts/ec2-deploy.sh
#   GHCR_TOKEN=ghp_... ./scripts/ec2-deploy.sh   # required if GHCR packages are private
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.deploy.yml"
ENV_FILE="${ROOT_DIR}/docker/.env.deploy"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  echo "Copy docker/.env.deploy.example → docker/.env.deploy and fill in secrets."
  exit 1
fi

# Optional: override tag without editing permanently via env
if [[ -n "${IMAGE_TAG:-}" ]]; then
  if grep -q '^IMAGE_TAG=' "${ENV_FILE}"; then
    sed -i.bak "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "${ENV_FILE}"
    rm -f "${ENV_FILE}.bak"
  else
    echo "IMAGE_TAG=${IMAGE_TAG}" >> "${ENV_FILE}"
  fi
fi

env_get() {
  local key="$1"
  grep -E "^${key}=" "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r' || true
}

IMAGE_REGISTRY="$(env_get IMAGE_REGISTRY)"
IMAGE_TAG="$(env_get IMAGE_TAG)"
HTTP_PORT="$(env_get HTTP_PORT)"
IMAGE_TAG="${IMAGE_TAG:-latest}"
HTTP_PORT="${HTTP_PORT:-80}"

if [[ -z "${IMAGE_REGISTRY}" ]]; then
  echo "IMAGE_REGISTRY must be set in ${ENV_FILE}"
  exit 1
fi

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

echo "==> Deploying AeroJudge"
echo "    Registry: ${IMAGE_REGISTRY}"
echo "    Tag:      ${IMAGE_TAG}"

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  GHCR_USER="${GHCR_USER:-$(echo "${IMAGE_REGISTRY}" | cut -d/ -f2)}"
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

cd "${ROOT_DIR}"

echo "==> Disk before image cleanup"
df -h / || true
# Old image tags stay on disk after each deploy and fill the volume during the next pull.
# Image prune keeps containers that are still serving; it does not stop the stack.
echo "==> Removing unused Docker images"
docker image prune -af
echo "==> Disk after image cleanup"
df -h / || true

# Pull while the current containers keep serving.
compose pull

container_name() {
  echo "aerojudge-${1}"
}

image_ref() {
  echo "${IMAGE_REGISTRY}/${1}:${IMAGE_TAG}"
}

image_id() {
  docker image inspect -f '{{.Id}}' "$1" 2>/dev/null || true
}

container_image_id() {
  docker inspect -f '{{.Image}}' "$1" 2>/dev/null || true
}

wait_healthy() {
  local name="$1"
  local attempt status
  for attempt in $(seq 1 60); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${name}" 2>/dev/null || true)"
    case "${status}" in
      healthy) return 0 ;;
      unhealthy)
        echo "    ${name} is unhealthy"
        return 1
        ;;
      none)
        # No healthcheck: accept a running container.
        if [[ "$(docker inspect -f '{{.State.Running}}' "${name}" 2>/dev/null || true)" == "true" ]]; then
          return 0
        fi
        ;;
    esac
    sleep 2
  done
  echo "    ${name} did not become healthy"
  return 1
}

# Services replaced in this run, so a later failure can put the previous images back.
SWAPPED_SERVICES=()
SWAPPED_IMAGES=()

restore_service() {
  local svc="$1"
  local prev_id="$2"
  local name image
  [[ -z "${prev_id}" ]] && return 0
  name="$(container_name "${svc}")"
  image="$(image_ref "${svc}")"
  echo "==> Restoring previous ${svc} image"
  docker tag "${prev_id}" "${image}"
  compose up -d --no-deps --force-recreate "${svc}" || true
  wait_healthy "${name}" || true
}

# Put back every service this deploy already swapped. The live stack returns
# to the images that were serving when the script started.
rollback_swapped() {
  local i
  if [[ "${#SWAPPED_SERVICES[@]}" -eq 0 ]]; then
    return 0
  fi
  echo "==> Rolling back ${#SWAPPED_SERVICES[@]} service(s)"
  for ((i = ${#SWAPPED_SERVICES[@]} - 1; i >= 0; i--)); do
    restore_service "${SWAPPED_SERVICES[$i]}" "${SWAPPED_IMAGES[$i]}"
  done
  if docker inspect "$(container_name nginx)" >/dev/null 2>&1; then
    compose exec -T nginx nginx -s reload || true
  fi
}

# Swap one service. Unchanged image digests are left running.
# A failed start restores that service before returning.
replace_service() {
  local svc="$1"
  local name image new_id prev_id
  name="$(container_name "${svc}")"
  image="$(image_ref "${svc}")"
  new_id="$(image_id "${image}")"
  if [[ -z "${new_id}" ]]; then
    echo "ERROR: missing image ${image}"
    return 1
  fi
  prev_id="$(container_image_id "${name}")"
  if [[ -n "${prev_id}" && "${prev_id}" == "${new_id}" ]]; then
    echo "==> ${svc} unchanged — still serving"
    return 0
  fi
  echo "==> Replacing ${svc}"
  if compose up -d --no-deps --force-recreate "${svc}" && wait_healthy "${name}"; then
    if [[ -n "${prev_id}" ]]; then
      SWAPPED_SERVICES+=("${svc}")
      SWAPPED_IMAGES+=("${prev_id}")
    fi
    return 0
  fi
  echo "ERROR: ${svc} failed health checks"
  restore_service "${svc}" "${prev_id}"
  return 1
}

if ! docker inspect "$(container_name postgres)" >/dev/null 2>&1; then
  echo "==> Starting postgres"
  compose up -d --no-deps postgres
fi
wait_healthy "$(container_name postgres)"

url_encode() {
  local s="$1" out="" i c hex
  local LC_ALL=C
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "${c}" in
      [a-zA-Z0-9.~_-]) out+="${c}" ;;
      *)
        printf -v hex '%%%02X' "'${c}"
        out+="${hex}"
        ;;
    esac
  done
  printf '%s' "${out}"
}

# Apply migrations before stopping the live API, so the replacement only has to boot.
# A one-off container joins the compose network as itself, not as the "api" hostname,
# so nginx keeps sending traffic to the API that is still serving.
api_image="$(image_ref api)"
api_new="$(image_id "${api_image}")"
api_prev="$(container_image_id "$(container_name api)")"
if [[ -n "${api_new}" && "${api_new}" != "${api_prev}" ]]; then
  echo "==> Migrating database before the API swap"
  POSTGRES_USER="$(env_get POSTGRES_USER)"
  POSTGRES_PASSWORD="$(env_get POSTGRES_PASSWORD)"
  POSTGRES_DB="$(env_get POSTGRES_DB)"
  POSTGRES_USER="${POSTGRES_USER:-aerojudge}"
  POSTGRES_DB="${POSTGRES_DB:-aerojudge}"
  PG_NET="$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$(container_name postgres)" | head -n1)"
  if [[ -z "${PG_NET}" ]]; then
    echo "ERROR: postgres container has no Docker network; leaving the live API in place"
    exit 1
  fi
  docker run --rm \
    --network "${PG_NET}" \
    --entrypoint ./node_modules/.bin/prisma \
    -e "DATABASE_URL=postgresql://$(url_encode "${POSTGRES_USER}"):$(url_encode "${POSTGRES_PASSWORD}")@postgres:5432/$(url_encode "${POSTGRES_DB}")?schema=public" \
    "${api_image}" \
    migrate deploy --schema=./database/prisma/schema.prisma
fi

# API first, then the sites. Each swap is only that service; nginx stays up.
# Any failure restores the services already swapped, so the live stack is unchanged.
if ! replace_service api; then
  rollback_swapped
  exit 1
fi
for svc in admin judge display public-results marketing; do
  if ! replace_service "${svc}"; then
    rollback_swapped
    exit 1
  fi
done

# Gateway uses Docker DNS (resolver + variables), so a reload picks up new
# container IPs and any synced nginx config without dropping port 80.
echo "==> Reloading gateway nginx"
if docker inspect "$(container_name nginx)" >/dev/null 2>&1; then
  if ! compose exec -T nginx nginx -t || ! compose exec -T nginx nginx -s reload; then
    echo "ERROR: nginx reload failed; restoring previous containers"
    rollback_swapped
    exit 1
  fi
else
  compose up -d --no-deps nginx
fi

echo "==> Waiting for API health..."
api_ok=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/v1/health" >/dev/null 2>&1; then
    api_ok=1
    break
  fi
  sleep 2
done

if [[ "${api_ok}" -ne 1 ]]; then
  echo "ERROR: API health check did not pass in time. Restoring previous containers."
  echo "  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=100"
  rollback_swapped
  compose ps
  exit 1
fi

echo "==> Checking path-prefixed apps..."
failed=0
for path in /admin/ /judge/ /display/ /events/ /; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${HTTP_PORT}${path}" || true)"
  if [[ "${code}" != "200" ]]; then
    echo "    FAIL ${path} → HTTP ${code}"
    failed=1
  else
    echo "    OK   ${path}"
  fi
done

compose ps

if [[ "${failed}" -ne 0 ]]; then
  echo "ERROR: one or more frontends returned non-200. Restoring previous containers."
  compose logs nginx --tail=50 || true
  rollback_swapped
  exit 1
fi

echo "==> Removing images replaced by this deploy"
docker image prune -af

echo "==> Healthy. Admin: http://127.0.0.1:${HTTP_PORT}/admin/"
