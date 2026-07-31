# Installation Guide

This guide walks through setting up AeroJudge for local development or self-hosted deployment.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 20.0.0 | LTS recommended |
| npm | ≥ 10.0.0 | Ships with Node 20+ |
| PostgreSQL | 15.x | Local install or Docker |
| Git | any recent | Clone the repository |

Optional:

- **Redis 7** — Future rate-limit / sync queue backend (not required for core features)
- **Docker & Docker Compose** — For containerised deployment

---

## 1. Clone and install

```bash
git clone https://github.com/Pratap22/aerojudge-accuracy-cms.git
cd aerojudge-accuracy-cms
npm install
```

---

## 2. Environment configuration

Copy the root environment template:

```bash
cp .env.example .env
```

Edit `.env` with your values. Key variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://npha:password@localhost:5432/npha_accuracy?schema=public` |
| `JWT_ACCESS_SECRET` | Access token secret (≥ 32 chars) | Random string |
| `JWT_REFRESH_SECRET` | Refresh token secret (≥ 32 chars) | Random string |
| `CORS_ORIGINS` | Comma-separated frontend URLs | `http://localhost:3000,…` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `SEED_ADMIN_EMAIL` | Default admin email for seed | `admin@npha.org.np` |
| `SEED_ADMIN_PASSWORD` | Default admin password for seed | `NphaAdmin@2024!` |

For Docker, also review `docker/.env.example`.

---

## 3. Database setup

### Option A — Local PostgreSQL

Create the database:

```sql
CREATE USER npha WITH PASSWORD 'npha_secure_password';
CREATE DATABASE npha_accuracy OWNER npha;
```

Then run migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The organizations migration creates a default sample organization (NPHA) and associates existing competitions with it. Product branding remains AeroJudge by Nepalabs.

### Option B — Docker PostgreSQL only

```bash
docker compose -f docker/docker-compose.yml up -d postgres
# Wait for healthy, then migrate against localhost:5432
npm run db:migrate
```

---

## 4. Seed demo data

Populate countries, staff users, a sample competition, pilots, teams, and Round 1 scores:

```bash
npm run db:seed
```

Expected output includes:

- 10 countries
- 5 staff users (admin, director, chief judge, judge, scorekeeper)
- **NPHA National Accuracy Championship 2024** (`publicSlug: npha-acc-2024`) — sample seed competition for an **example organization** (NPHA), not product branding.
- 24 pilots, 4 national teams
- Round 1 with sample scores

---

## 5. Run all applications

### Turbo (recommended)

```bash
npm run dev
```

### With port reminder

```bash
./scripts/dev-all.sh
```

### Individual workspaces

```bash
npm run dev --workspace=@npha/server      # API :4000
npm run dev --workspace=@npha/admin       # Admin :3000
npm run dev --workspace=@npha/judge       # Judge :3001
npm run dev --workspace=@npha/display     # Display :3002
npm run dev --workspace=@npha/public-results  # Public :3003
```

---

## 6. Verify installation

| Check | URL |
|-------|-----|
| API health | http://localhost:4000/api/v1/health |
| Swagger docs | http://localhost:4000/api/docs |
| Admin login | http://localhost:3000/login |
| Public results | http://localhost:3003/?slug=npha-acc-2024 |

Login with `admin@npha.org.np` / `NphaAdmin@2024!`.

---

## 7. Docker full stack

For a production-like environment with Nginx routing:

```bash
cp docker/.env.example docker/.env   # optional
npm run docker:up
```

Services:

- **http://localhost/** → redirects to admin
- **http://localhost/admin/** → admin portal
- **http://localhost/api/v1/** → API
- **http://localhost/results/** → public results

The API container runs migrations on startup. Set `RUN_SEED=true` in `docker/.env` to seed on first boot (default: `true`).

---

## 8. End-to-end tests

```bash
# Install Playwright browsers (first time)
npx playwright install --with-deps

# Run e2e (starts API if not running)
npm run test:e2e
```

Skip auto-starting the API when it is already running:

```bash
SKIP_WEBSERVER=1 npm run test:e2e
```

---

## Troubleshooting

### `DATABASE_URL is required`

Ensure `.env` exists at the repo root and `DATABASE_URL` is set. The server loads `../.env` relative to `server/`.

### Prisma client not generated

```bash
npm run db:generate
```

### Port already in use

Change ports in each app's `vite.config.ts` or stop conflicting processes.

### CORS errors in browser

Add your frontend origin to `CORS_ORIGINS` in `.env`.

---

## Next steps

- [Competition Operations](COMPETITION_OPS.md) — Run a competition day
- [API Reference](../api/API.md) — REST endpoints
- [Architecture Overview](../architecture/OVERVIEW.md) — System design
