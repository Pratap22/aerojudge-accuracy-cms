#!/usr/bin/env bash
# Bootstrap an Ubuntu/Amazon Linux EC2 host for AeroJudge (Docker + swap + deploy dir).
# Run once as a user with sudo:  curl ... | bash  OR  ./scripts/ec2-bootstrap.sh
set -euo pipefail

SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/apps}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$USER}}"

echo "==> AeroJudge EC2 bootstrap"
echo "    Deploy dir: ${DEPLOY_DIR}"
echo "    Swap:       ${SWAP_SIZE_GB}G"
echo "    User:       ${DEPLOY_USER}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo: sudo $0"
  exit 1
fi

# --- Packages ---
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl git
  # Docker official install if missing
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  fi
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl git
  if ! command -v docker >/dev/null 2>&1; then
    dnf install -y docker
    systemctl enable --now docker
  fi
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git
  if ! command -v docker >/dev/null 2>&1; then
    amazon-linux-extras install docker -y 2>/dev/null || yum install -y docker
    systemctl enable --now docker
  fi
else
  echo "Unsupported package manager. Install Docker manually, then re-run."
  exit 1
fi

# Compose plugin
if ! docker compose version >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y docker-compose-plugin || true
  fi
fi

usermod -aG docker "${DEPLOY_USER}" || true

# --- Swap (helps t3.micro) ---
if [[ ! -f /swapfile ]]; then
  echo "==> Creating ${SWAP_SIZE_GB}G swapfile"
  fallocate -l "${SWAP_SIZE_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_SIZE_GB * 1024))
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
else
  echo "==> Swapfile already present"
  swapon /swapfile 2>/dev/null || true
fi

# --- Deploy directory ---
mkdir -p "${DEPLOY_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_DIR}"

echo ""
echo "==> Bootstrap complete."
echo "Next steps (as ${DEPLOY_USER}):"
echo "  1. Clone or sync the repo into ${DEPLOY_DIR} (at least docker/ + scripts/ec2-deploy.sh)"
echo "  2. cp ${DEPLOY_DIR}/docker/.env.deploy.example ${DEPLOY_DIR}/docker/.env.deploy"
echo "  3. Edit secrets and YOUR_HOST URLs in docker/.env.deploy"
echo "  4. Log out/in (or newgrp docker), then: ${DEPLOY_DIR}/scripts/ec2-deploy.sh"
echo ""
echo "Security group: allow TCP 22 (your IP), 80, and optionally 443. Do not open 5432."
echo "Cost control: stop the EC2 instance when idle (EBS only). Prefer an Elastic IP."
