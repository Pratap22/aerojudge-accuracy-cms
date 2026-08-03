# Auth Architecture Proposal

**Status:** Target architecture + incremental migration plan.  
**Principle:** Simplicity is a security feature.  
**Date:** 2026-08-03

---

## 1. Sources of confusion (root causes)

1. **Three role systems** named similarly: platform `Role`, org `OrgRole`, event `CompetitionRole` (+ free-text official labels).  
2. **Legacy global permission matrix** still used as a fallback when org context is missing.  
3. **`CompetitionUser`** seeded but never used for authorization.  
4. **Invite language vs behavior:** no tokens/email; admin sets temporary password; `INVITED` status unused.  
5. **Dual audit writers** + **missing audit list API**.  
6. **Logout/token lifecycle inconsistent** across apps; long access TTL + localStorage.  
7. **Auth debug surface weak:** no request-scoped auth summary logs; optional org header silently empties permissions.

Person/User split is **intentionally correct** and must be preserved. The mess is around **RBAC layers, legacy fallbacks, and incomplete audit**, not the Person model.

---

## 2. Target sources of truth

| Concern | Source of truth |
|---------|-----------------|
| Human identity | `Person` |
| Login account | `User` (optional 1:1 `personId`) |
| Session | Access JWT (identity) + `RefreshToken` row |
| Current organization | `X-Organization-Id` re-validated against `OrganizationMember` |
| Permissions | Membership permission bundle (custom role JSON **or** built-in OrgRole map in `@npha/shared`) |
| Competition activity | `CompetitionParticipant` + `CompetitionParticipantRole` (not RBAC) |
| Audit | Server `AuditLog` only |

**Deprecate as auth authority:** `CompetitionUser`, legacy non-platform `User.role` for tenant permissions, client-supplied role claims.

---

## 3. Target diagrams

### Identity & auth

```text
                 PERSON
                    │
                    │ optional
                    ▼
              USER ACCOUNT
                    │
                    ▼
               SESSION
           (access + refresh)
                    │
                    ▼
              AUTH CONTEXT
         (userId, personId?, roles platform)
                    │
                    ▼
        ORGANIZATION MEMBERSHIP
           (current org header)
                    │
                    ▼
              PERMISSIONS
                    │
                    ▼
          AUTHORIZATION POLICY
                    │
              ┌─────┴─────┐
              ▼           ▼
            ALLOW        DENY
```

### Competition participation (separate)

```text
PERSON
   │
   ▼
COMPETITION PARTICIPATION
   │
   ▼
COMPETITION ROLES  (roster / identity — not API RBAC)
```

### Mutations + audit

```text
AUTHORIZED MUTATION
        │
        ├─────────────┐
        ▼             ▼
   DATABASE        AUDIT LOG
    CHANGE          EVENT
```

---

## 4. Authorization pipeline (canonical)

Centralize on existing `server/src/auth/rbac.ts` (do not invent a second framework):

1. `requireAuth` — trusted user id from JWT  
2. `resolveOrganizationContext` — membership DB load (never trust client membership/role)  
3. `requireOrgContext` — for tenant APIs  
4. `requirePermission(key)` — explicit permission  
5. `requireCompetitionInOrg` — resource tenancy  
6. Services may re-check resource ownership for nested IDs

**Default deny.** Never “if org missing, allow.”

**Future AuthContext shape** (request-level, server-only):

```ts
{
  requestId,
  userId,
  personId?,
  organizationId?,
  membershipId?,
  orgRole?,
  permissions: Permission[],
}
```

Populate from JWT + DB; use for authz + audit actor.

---

## 5. Session security targets (incremental)

| Topic | Near-term | Later |
|-------|-----------|--------|
| Access TTL | Prefer short (15m) in defaults | Keep env-configurable |
| Refresh | Rotate on use; revoke on logout **all apps** | Device list |
| Storage | Document XSS risk of localStorage | HttpOnly cookie option if apps share origin via reverse proxy |
| Account disable | Reject login + refresh when `User.status !== ACTIVE` | Global token revoke |
| Org remove | Membership INACTIVE; keep User | — |

---

## 6. Invitation target (product requires decision)

**Current:** create user + password + ACTIVE membership.  
**Target (when product prioritizes):**

```
Invite email → secure token (random, hashed, expiring, single-use)
  → recipient sets password / login
  → Person match
  → Membership ACTIVE
```

Until then: rename UI copy to “Add member” and optional force password-change flag.

---

## 7. Error model (standardize over time)

| Code | Use |
|------|-----|
| `UNAUTHENTICATED` | Missing/invalid access token |
| `SESSION_EXPIRED` | Refresh rejected |
| `ACCOUNT_DISABLED` | User not ACTIVE |
| `ORGANIZATION_REQUIRED` | Missing org context |
| `NOT_ORGANIZATION_MEMBER` | Header org not membership |
| `PERMISSION_DENIED` | Missing permission |
| `COMPETITION_ACCESS_DENIED` or `NOT_FOUND` | Cross-tenant resource (prefer NOT_FOUND when safer) |
| `INVITATION_*` | When real invites land |

Do not leak existence of foreign-tenant resources.

---

## 8. Observability

Dev structured log fields (never secrets/tokens/passwords):

`requestId`, `auth.status`, `userId`, `personId`, `organizationId`, `membershipId`, `requiredPermission`, `authorizationResult`, `auditEventId`

Authorization denials: server-side `AUTHZ_DENIED` with resource type + required permission.

---

## 9. Migration strategy (safe order)

| Phase | Work | Risk |
|-------|------|------|
| **P1 Discovery** | Inventory docs (this folder) | None |
| **P2 RCA** | Audit break documented | None |
| **P3 Spec** | This proposal + matrix | None |
| **P4 Auth simplify** | (a) Admin/judge call server logout (b) Scores require org + competition ownership always (c) Log AUTHZ_DENIED (d) Feature-flag remove legacy permission fallback (e) Stop seeding CompetitionUser for auth, document obsolete | Medium |
| **P5 Audit** | List API + UI + tests; expand writers; optional `organizationId` column | Low–medium |
| **P6 Hardening** | Shorter access TTL defaults; refresh rotation; optional requestId middleware | Medium |
| **P7 Tests** | Auth unit + cross-tenant integration + audit | — |
| **P8 Docs** | Update AUTHENTICATION.md, API.md, remove obsolete claims | — |

**Do not** big-bang rewrite JWT custom crypto or introduce a third-party IdP mid-season without a product decision.

### Backward compatibility

- Existing Users / memberships / tokens keep working  
- Password hashes unchanged  
- Person links unchanged  
- Deprecate before delete: CompetitionUser, legacy Role fallback  

### Rollback

- List API: remove route  
- Schema: additive columns only with nullable defaults  

---

## 10. Module boundaries (conceptual — map to existing paths)

| Concern | Existing home |
|---------|---------------|
| authentication / session | `server/src/auth/*`, `services/auth.service.ts` |
| authorization | `server/src/auth/rbac.ts`, `permissions.ts`, `@npha/shared` constants |
| users / invitations | `user.service`, `organization-member.service` |
| people | `person.service`, people routes |
| organizations | `modules/organization` |
| audit | `middleware/audit.ts` → grow into `services/audit.service.ts` |

Avoid reorganizing the monorepo purely for folder symmetry.

---

## 11. Out of scope (this initiative)

- Multi-IdP SSO  
- Full invite email product build without product schedule  
- Collapsing Person and User  
- Making competition roles equal global permissions  

---

## 12. Success criteria (from initiative DoD)

Authentication and authorization are boring:

- One login path, one membership model, one permission map, one permission check helper, one audit writer, one documentable request pipeline.  
- Cross-tenant isolation tests pass.  
- Audit log UI shows real server-generated events with correct actor.  
- Person remains optional for pilots without accounts.
