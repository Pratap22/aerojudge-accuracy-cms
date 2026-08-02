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

echo "==> Deploying AeroJudge"
echo "    Registry: ${IMAGE_REGISTRY}"
echo "    Tag:      ${IMAGE_TAG}"

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  GHCR_USER="${GHCR_USER:-$(echo "${IMAGE_REGISTRY}" | cut -d/ -f2)}"
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

cd "${ROOT_DIR}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

echo "==> Waiting for API health..."
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/v1/health" >/dev/null 2>&1; then
    echo "==> Healthy. Admin: http://127.0.0.1:${HTTP_PORT}/admin/"
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
    exit 0
  fi
  sleep 2
done

echo "WARNING: health check did not pass in time. Check logs:"
echo "  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=100"
exit 1
