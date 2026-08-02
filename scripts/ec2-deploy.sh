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
compose pull
compose up -d --remove-orphans

# Gateway nginx resolves upstream hostnames at start and caches IPs. When app
# containers are recreated they get new IPs; without recreating nginx, path
# apps (/admin/, /judge/, …) 404 against stale upstreams while / and /api may
# still appear fine.
echo "==> Recreating gateway nginx (refresh upstream DNS)"
compose up -d --force-recreate --no-deps nginx

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
  echo "ERROR: API health check did not pass in time. Check logs:"
  echo "  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=100"
  compose ps
  exit 1
fi

echo "==> Checking path-prefixed apps..."
failed=0
for path in /admin/ /judge/ /display/ /results/ /; do
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
  echo "ERROR: one or more frontends returned non-200. Gateway upstreams may be stale."
  echo "  compose logs nginx --tail=50"
  exit 1
fi

echo "==> Healthy. Admin: http://127.0.0.1:${HTTP_PORT}/admin/"
