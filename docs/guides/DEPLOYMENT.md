# EC2 / GHCR Deployment

Deploy AeroJudge by building images in **GitHub Actions**, pushing them to **GHCR**, and pulling them on EC2. The instance never builds the monorepo.

## Architecture

```
GitHub Actions (linux/amd64)
  → ghcr.io/<owner>/<repo>/{api,admin,judge,display,public-results}:<sha>
  → SSH to EC2 → docker compose pull + up
```

This host may also run other apps (e.g. nepse-api). Do **not** stop the whole EC2 instance to save AeroJudge cost — that takes those services down too. To idle AeroJudge only:

```bash
cd /home/ubuntu/apps/aerojudge-accuracy-cms
docker compose -f docker/docker-compose.deploy.yml --env-file docker/.env.deploy stop
# later:
docker compose -f docker/docker-compose.deploy.yml --env-file docker/.env.deploy start
```

Prefer an **Elastic IP** (or stable DNS) so the address does not change if the instance is ever restarted.

## One-time EC2 setup

### 1. Instance

- Type: prefer **`t3.small`** (2 GB). `t3.micro` works with swap for light use.
- Security group: **22** (your IP), **80**, optionally **443**. Do **not** open **5432**.
- Allocate and associate an **Elastic IP**.

### 2. Bootstrap

SSH in, then:

```bash
# Copy scripts from the repo, or clone once:
git clone https://github.com/Pratap22/aerojudge-accuracy-cms.git /home/ubuntu/apps/aerojudge-accuracy-cms
cd /home/ubuntu/apps/aerojudge-accuracy-cms
sudo ./scripts/ec2-bootstrap.sh
# log out/in so docker group applies
```

### 3. Server env (secrets stay on the host)

```bash
cd /home/ubuntu/apps/aerojudge-accuracy-cms
cp docker/.env.deploy.example docker/.env.deploy
nano docker/.env.deploy
```

Replace `YOUR_HOST` with `http://<elastic-ip>` (or your domain), set strong `POSTGRES_PASSWORD` / JWT secrets, and set seed admin credentials. After the first successful boot with seed, set `RUN_SEED=false`.

### 4. First pull (optional smoke test)

After images exist in GHCR (run the workflow once):

```bash
export GHCR_TOKEN=ghp_...   # classic PAT with read:packages if packages are private
./scripts/ec2-deploy.sh
```

Open `http://<elastic-ip>/` for the marketing site, or `http://<elastic-ip>/admin/` for Admin.

---

## GitHub configuration

### Packages

Images publish to:

`ghcr.io/<lowercase-owner>/<lowercase-repo>/<app>`

For a private repo, either:

- Make each package **Public** (Package settings → Change visibility), or
- Create a PAT with `read:packages` and set secrets below (`GHCR_READ_TOKEN`, `GHCR_USER`).

### Repository secrets

| Secret | Purpose |
|--------|---------|
| `EC2_HOST` | Elastic IP or DNS |
| `EC2_USER` | SSH user (`ubuntu`, `ec2-user`, …) |
| `EC2_SSH_KEY` | Private key (full PEM) |
| `EC2_DEPLOY_PATH` | Absolute path: `/home/ubuntu/apps/aerojudge-accuracy-cms` |
| `GHCR_READ_TOKEN` | Optional; PAT with `read:packages` if private |
| `GHCR_USER` | Optional; GitHub username for that PAT |

### Manual runs only

Workflows do **not** run on push or pull request. Use **Actions → Build and deploy → Run workflow**.

- **Deploy** checked → build images, push to GHCR, deploy to EC2  
- **Deploy** unchecked → build and push images only  

### Environment

Create a GitHub Environment named **`production`** (Settings → Environments). Attach the secrets there if you prefer environment-scoped secrets.

---

## Day-to-day

1. Push code to `main` when ready (no Actions run).
2. **Actions → Build and deploy → Run workflow** (Deploy = true to update EC2).
3. To free RAM/CPU without affecting other apps on the box: `docker compose … stop` (see above).

Manual deploy on the box:

```bash
cd /home/ubuntu/apps/aerojudge-accuracy-cms
IMAGE_TAG=<git-sha> GHCR_TOKEN=... ./scripts/ec2-deploy.sh
```

---

## Local build (optional)

To build `linux/amd64` images on an Apple Silicon Mac and push:

```bash
# after docker login ghcr.io
export REGISTRY=ghcr.io/pratap22/aerojudge-accuracy-cms
export TAG=$(git rev-parse --short HEAD)

docker buildx build --platform linux/amd64 -f docker/Dockerfile.api \
  -t $REGISTRY/api:$TAG --push .

for app in admin judge display; do
  docker buildx build --platform linux/amd64 -f docker/Dockerfile.web \
    --build-arg APP_NAME=$app --build-arg BASE_PATH=/$app/ \
    -t $REGISTRY/$app:$TAG --push .
done

docker buildx build --platform linux/amd64 -f docker/Dockerfile.web \
  --build-arg APP_NAME=public-results --build-arg BASE_PATH=/results/ \
  -t $REGISTRY/public-results:$TAG --push .

docker buildx build --platform linux/amd64 -f docker/Dockerfile.web \
  --build-arg APP_NAME=marketing --build-arg BASE_PATH=/ \
  --build-arg VITE_SITE_URL=https://aerojudge.nepalabs.com \
  --build-arg VITE_CONTACT_EMAIL=hello@nepalabs.com \
  -t $REGISTRY/marketing:$TAG --push .
```

Prefer GitHub Actions for CI consistency.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Deploy SSH fails | `EC2_HOST` / key / security group / instance running |
| `pull` unauthorized | Package visibility or `GHCR_READ_TOKEN` |
| Buildx / Docker Hub timeout | Transient Hub outage; workflow retries Buildx and uses `mirror.gcr.io`. Re-run the workflow. |
| OOM / killed containers | Upgrade to `t3.small` or increase swap |
| CORS / blank API | `CORS_ORIGINS` and `*_URL` match the browser origin (scheme + host) |
| Wrong IP after start | Attach an Elastic IP |
| Health timeout | `docker compose -f docker/docker-compose.deploy.yml --env-file docker/.env.deploy logs` |

---

## Related

- Local Docker build: [INSTALLATION.md](INSTALLATION.md) § Docker
- Compose (build on machine): `docker/docker-compose.yml`
- Compose (pull images): `docker/docker-compose.deploy.yml`
