# Authentication Inventory

**Status:** Phase 1 discovery — code and database are the source of truth.  
**Date:** 2026-08-03  
**Product:** AeroJudge (Nepalabs)

This document inventories the **current** authentication implementation. It does not prescribe the target architecture (see [AUTH_ARCHITECTURE_PROPOSAL.md](./AUTH_ARCHITECTURE_PROPOSAL.md)).

---

## 1. Provider / library

| Concern | Implementation |
|---------|----------------|
| Auth provider | **Custom** (no Supabase Auth, Clerk, NextAuth, Firebase Auth) |
| Protocol | REST + JWT Bearer |
| Access token | JWT signed with `JWT_ACCESS_SECRET` (`server/src/auth/jwt.ts`) |
| Refresh token | JWT + `RefreshToken` table row (random `tokenId`) |
| Password hashing | bcrypt, 12 rounds (`server/src/auth/password.ts`) |
| Cookies / HttpOnly sessions | **Not used** — tokens in browser `localStorage` |
| RLS / Postgres policies | **Not used** — Express + Prisma application authorization |
| Service role / admin client | **Not used** (no Supabase service role) |

---

## 2. Environment variables

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` | Access JWT HMAC (≥ 32 chars, Zod-validated) |
| `JWT_REFRESH_SECRET` | Refresh JWT HMAC (≥ 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | Access TTL (default in env often **`7d`** — long for bearer-in-localStorage) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh JWT TTL (default `7d`) |
| `SEED_ADMIN_PASSWORD` | Seed only |
| CORS / rate-limit | General API; rate limit **skipped outside production** |

Source: `server/src/config/env.ts`, root `.env.example`.

---

## 3. File inventory

### Server — authentication

| Path | Role |
|------|------|
| `server/src/auth/jwt.ts` | Sign/verify access + refresh JWTs |
| `server/src/auth/password.ts` | hash / verify |
| `server/src/auth/rbac.ts` | `requireAuth`, org context, permissions |
| `server/src/auth/permissions.ts` | Resolve membership → permission list |
| `server/src/services/auth.service.ts` | Login, register, select-org, refresh, logout, me, claims |
| `server/src/api/v1/controllers/auth.controller.ts` | HTTP handlers |
| `server/src/api/v1/routes/auth.routes.ts` | Auth routes |
| `server/src/types/express.d.ts` | `req.user`, `req.organizationId`, `req.permissions` |
| `server/src/socket/index.ts` | Optional Socket.IO JWT (join rooms unauthenticated-friendly) |

### Server — authorization & tenancy

| Path | Role |
|------|------|
| `server/src/api/v1/middleware/org-scope.ts` | Competition nested-route guards |
| `server/src/modules/organization/*` | Org CRUD, members, custom roles, invites |
| `packages/shared/src/constants/index.ts` | Permission SSoT + org role bundles |
| Nested competition routes | `requirePermission` per mutation |

### Frontends

| App | Auth client |
|-----|-------------|
| `apps/admin` | `lib/auth.tsx`, `lib/api.ts` (`npha_*` keys) |
| `apps/judge` | `lib/auth.tsx`, `lib/api.ts` (`npha_*` keys; migrates legacy `npha_judge_*`) |
| `apps/public-results` | `lib/auth.tsx`, `lib/auth-api.ts` (participant) |
| `apps/display` / `apps/marketing` | No staff auth client |

### Database

| Artifact | Notes |
|----------|-------|
| `User`, `RefreshToken`, `OrganizationMember`, `OrganizationRole` | Auth / tenant RBAC |
| `Person`, `CompetitionParticipant`, `CompetitionParticipantRole` | Identity / event roles (not login RBAC) |
| `CompetitionUser` | Legacy seed-only staff assignment |
| `AuditLog` | Append-style activity log |
| Migrations | `20260731010000_org_based_auth`, `20260731020000_org_role_permissions`, Person identity migrations |

---

## 4. Login implementation

1. `POST /api/v1/auth/login` `{ email, password }`
2. Load `User` by lowercased email; require `status === ACTIVE`
3. `verifyPassword` (bcrypt)
4. Update `lastLoginAt`
5. Load memberships (`ACTIVE` + `INVITED` in list; only **ACTIVE** usable for context)
6. Exactly one ACTIVE membership → auto-select org in response
7. Multiple ACTIVE → `requiresOrganizationSelection: true`
8. Issue identity-only access JWT (`sub`, email, names, platform `role` — **no org claim**)
9. Issue refresh JWT; persist `RefreshToken` (DB expiry hardcoded ~7 days in issue path)
10. Client stores tokens in `localStorage`; org id in `sessionStorage` (per tab)
11. After org context is known, Admin/Judge clients **auto-open** the preferred staff app (`getPreferredStaffApp`): Judge-only → `/judge`, no `score:enter` → `/admin`, dual-capable roles stay. Each app exposes a cross-link (Admin ↔ Scoring) for intentional switches. Cross-port handoff uses a one-time URL hash (`aj_staff_handoff=`).

---

## 5. Logout implementation

| Client | Behavior |
|--------|----------|
| Admin | Clears tokens/local state only — **does not** call `POST /auth/logout` |
| Judge | Same as admin |
| Public-results | Best-effort server logout then clear |

Server logout: revokes refresh row by `tokenId` from refresh JWT.

---

## 6. Registration

`POST /auth/register` (participant):

- Creates `User` with `role: PUBLIC_USER`
- Creates/links `Person`
- Sets `emailVerifiedAt` **without** email OTP/link
- Issues tokens
- Writes `PARTICIPANT_ACCOUNT_CREATED` audit (no competitionId)

No separate org staff “signup”; staff are created via org member invite / platform users.

---

## 7. Session / token model

```
Access JWT (identity)  +  X-Organization-Id header  →  server loads membership from DB
Refresh JWT + RefreshToken row  →  new access JWT (same refresh returned — no rotation)
```

| Property | Status |
|----------|--------|
| Access token | Bearer, localStorage |
| Refresh token | Bearer body, localStorage + DB |
| Refresh rotation | **No** |
| HttpOnly cookies | **No** |
| Multi-device | Multiple refresh rows possible |
| Remember-me | N/A (long-lived access TTL in env) |

---

## 8. Middleware (server)

| Middleware | Behavior |
|------------|----------|
| `requireAuth` | Bearer access JWT → `req.user` |
| `optionalAuth` | Best-effort token |
| `resolveOrganizationContext` | Validate membership for `X-Organization-Id`; set `req.permissions` |
| `requireOrgContext` | Fail if no resolved org |
| `requirePermission(p)` | `hasEffectivePermission(...)` |
| `requireRoles` / `requirePlatformRole` | Platform / user admin |
| `requireCompetitionInOrg` | Competition.organizationId must match context |
| `competitionScopedGuards` | Auth + org + competition ownership |

**Missing org header:** request continues with no `req.permissions`. Tenant mutations usually also use `requireOrgContext`; some paths (e.g. `/scores` org check) only apply when both flight and org id are present.

---

## 9. Client-side authentication state

| Store | Contents |
|-------|----------|
| `localStorage` | Access + refresh tokens (shared across tabs) |
| `sessionStorage` | Active `organizationId` (**per tab**) |
| React context | `user`, memberships, `activeOrganizationId` |

Organization switch: `POST /auth/select-organization` + update sessionStorage; access token remains identity-only.

Frontend permission UX: `usePermission` / `RequirePermission` using `hasEffectivePermission` (UX only).

---

## 10. Protected routes

| Layer | Mechanism |
|-------|-----------|
| Admin SPA | `ProtectedRoute` (auth), `RequirePermission` (capability) |
| Judge SPA | Auth required for scoring UI |
| API | `requireAuth` + permission + org + competition-in-org |

---

## 11. Organization selection

- Multi-membership → organization selector UI
- Header `X-Organization-Id` re-validated every request against `OrganizationMember` (ACTIVE, org not ARCHIVED)
- Client-provided org id **without** membership → `403`

---

## 12. Invitation flow (as implemented)

**Not** email token invites.

1. `POST /organizations/:id/members` + `organization:members`
2. Create user if missing (requires firstName, lastName, **password chosen by inviter**)
3. `ensureUserPerson` best-effort
4. Create `OrganizationMember` **`status: ACTIVE`**, `joinedAt: now`
5. Status enum `INVITED` exists but is **unused** by this path

No invitation token table, no email, no single-use accept URL.

---

## 13. Password reset / email verification

| Flow | Status |
|------|--------|
| Forgot / reset password | **Not implemented** |
| Change password self-service | **Not implemented** |
| Super Admin set/reset user password | `POST /users/:id/password` (`user:manage`) — revokes refresh tokens |
| Email verification | Field `Person.emailVerifiedAt` / set on register without mailer |

---

## 14. Person / User relationship

See [PERSON_IDENTITY.md](../PERSON_IDENTITY.md). Summary:

| Concept | Table | Login? |
|---------|-------|--------|
| Person | `Person` | No |
| User account | `User.personId?` | Yes |
| Org RBAC | `OrganizationMember` | Yes |
| Event role | `CompetitionParticipantRole` | No |

---

## 15. Admin / service role

No database admin client. Platform ops use `User.role` platform values + dedicated permissions (`platform:*`, `user:manage`). Platform role alone does **not** grant `competition:create` without org membership (`hasEffectivePermission` tests).

---

## 16. Audit integration (summary)

- Writer: `writeAuditLog` / raw `prisma.auditLog.create`
- Reader API for competition audit: **was missing** (see [AUDIT_LOG_FINDINGS.md](./AUDIT_LOG_FINDINGS.md))
- UI: `apps/admin/src/pages/AuditPage.tsx`

---

## 17. Auth-related tests

| File | Covers |
|------|--------|
| `server/src/__tests__/auth.test.ts` | JWT, bcrypt, legacy matrix |
| `server/src/__tests__/organization-auth.test.ts` | Effective permissions, platform isolation |
| `server/src/__tests__/permissions.resolve.test.ts` | Custom role resolution |
| `server/src/__tests__/organization-member.service.test.ts` | Member invite conflicts |
| `e2e/tests/auth.spec.ts` | Admin login UI |

Gaps: HTTP tenant isolation integration tests, audit list API, refresh revocation/rotation, disabled account HTTP paths.

---

## 18. CURRENT auth flow (actual)

```
Browser Login Form
        │
        ▼
POST /auth/login  (email/password)
        │
        ▼
bcrypt verify + User ACTIVE
        │
        ▼
Issue access JWT (identity) + refresh JWT + RefreshToken row
        │
        ├─ 1 membership ──► client sets sessionStorage org
        └─ N memberships ─► select-organization UI
                                    │
                                    ▼
                          POST /auth/select-organization
                          (validates ACTIVE membership)
                                    │
                                    ▼
Subsequent API call:
  Authorization: Bearer <access>
  X-Organization-Id: <org>
        │
        ▼
requireAuth → resolveOrganizationContext (DB membership)
        │
        ▼
requireOrgContext / requirePermission / requireCompetitionInOrg
        │
        ▼
Controller → Service → Prisma
        │
        └─ optional writeAuditLog (not all mutations)
```

### Duplicated / inconsistent paths (documented)

| Path | Pattern |
|------|---------|
| Most nested competition routes | Full competitionScopedGuards + permission |
| `/scores` | Auth + optional org flight check only when `flightId` **and** org present |
| Some GETs | Auth without org require |
| Frontend | Permission hide buttons (UX only) |
| Legacy | `User.role` matrix if no org context / no permissions array |
| Socket join | Room id only; optional JWT |

---

## 19. Related documents

- [AUTHORIZATION_MATRIX.md](./AUTHORIZATION_MATRIX.md)
- [AUDIT_LOG_FINDINGS.md](./AUDIT_LOG_FINDINGS.md)
- [AUTH_ARCHITECTURE_PROPOSAL.md](./AUTH_ARCHITECTURE_PROPOSAL.md)
- [Authentication guide](../../guides/AUTHENTICATION.md)
- [Person identity](../PERSON_IDENTITY.md)
