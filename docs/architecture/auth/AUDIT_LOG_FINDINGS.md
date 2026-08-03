# Audit Log Findings

**Status:** Root-cause analysis (Phase 2) + repair plan.  
**Date:** 2026-08-03  
**Severity:** Product-facing feature broken (read path); writes partial.

---

## 1. Executive root cause

**Primary cause of “audit logs not working”:**

The Admin **Audit Log** page requests:

```
GET /api/v1/competitions/:competitionId/audit
```

There was **no matching route, controller, service, or DTO mapper**. Writes to `AuditLog` could succeed while the UI always failed (404) or rendered blank (error not surfaced).

This is not primarily an RLS issue (no RLS), a schema migration gap for the table (table exists since init), or a permissions-only issue (`audit:view` only gated the UI).

---

## 2. Inventory

### Model

`AuditLog` (`database/prisma/schema.prisma`):

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `competitionId?` | Optional FK |
| `userId?` | Actor (optional) |
| `action` | Free string |
| `entityType` | Free string |
| `entityId?` | |
| `beforeJson` / `afterJson` | Optional |
| `ipAddress` / `userAgent` | Optional |
| `createdAt` | |

**Missing vs multi-tenant target:** `organizationId`, `requestId`, `result`, `actorPersonId`. Org-scoped events only attach actor user, not org/competition.

### Writers

| Mechanism | Location |
|-----------|----------|
| `writeAuditLog` | `server/src/api/v1/middleware/audit.ts` (helper, not Express middleware) |
| Direct `prisma.auditLog.create` | `auth.service`, `person.service`, `competition-participant.service` |

### Write coverage (partial)

| Written | Not written (examples) |
|---------|------------------------|
| Competition create/delete/publish/complete/archive/unarchive | Settings/rules update |
| Pilot create/update/status/accept/reject | Pilot delete |
| Score enter (`SCORE_ENTER`) | Score confirm |
| Person create (sometimes double with service) | Most rounds/teams/approvals/results/print/weather/display/officials/sponsors |
| Org create/update/member/role mutations | Login success/failure |
| Some person merge/claim events | Role assign when `actorUserId` omitted |

### Participant role audit skip

`assignCompetitionRole` / `removeCompetitionRole` only audit if `opts.actorUserId` is set. Official and pilot services often omit it → silent **non-write** (not try/catch swallow).

### Read path (broken)

| Layer | Status |
|-------|--------|
| `GET …/audit` | Implemented (`audit.routes.ts` + `audit.service.ts`) |
| Permission UI gate | `RequirePermission(['audit:view'])` + server `requirePermission('audit:view')` |
| API route | **Present** under competition nested guards |
| Export | Documented in ops guide; not implemented |
| Tests | Summary + matrix + cross-tenant unit scenarios |

### UI / DB mismatch (even after raw findMany)

| UI field | DB field |
|----------|----------|
| `timestamp` | `createdAt` |
| `userName` | Join `User` first/last |
| `details` | Derive from before/after / action |
| `entityId` required string | Nullable → `.slice` would crash |

Error UX: no `isError` → failed GET looks empty.

---

## 3. Silent failure patterns

| Pattern | Present? |
|---------|----------|
| Empty try/catch around audit | No — `await` propagates failures |
| Fire-and-forget | No |
| Optional actor skips write | **Yes** (participant roles) |
| Missing organizationId always | **Yes** (schema) |
| Mutation succeeds without audit | Yes when writer not called |

Failure mode when `writeAuditLog` throws: **mutation request fails** (AUDIT_REQUIRED-like for call sites that await after business write — order varies).

---

## 4. Dual “audit” concepts (not the UI bug)

| Name | Meaning |
|------|---------|
| `AuditLog` table | User/API actions |
| Scoring `auditJson` | Ranking math explanation (engine) |
| `PersonMergeLog` | Separate merge history |

---

## 5. Target audit architecture (aligned with proposal)

1. **Server-only** writes from trusted auth context (never client actor/org).  
2. **One writer** (`writeAuditLog` / future `audit.service`) for all domains.  
3. **List API** competition-scoped (+ later org-scoped) with `audit:view`.  
4. Append-only for normal users (no update/delete routes).  
5. Naming convention: prefer stable verbs (`CREATE`, `SCORE_ENTER`, `PERSON_MERGED`) → migrate toward `RESOURCE.ACTION` over time without breaking filters.  
6. Classification:  
   - **AUDIT_REQUIRED** — score change, approval, result publish, role/permission change, person merge  
   - **AUDIT_BEST_EFFORT** — cosmetic settings, low-risk reads (if logged at all)  
7. Competition integrity: mutation + audit in same transaction where practical.

---

## 6. Repair plan (phased)

### Phase A — unblock UI (implemented)

- `GET /competitions/:competitionId/audit` (`audit.routes.ts` + `audit.service.ts`)
- Map DTO expected by Admin UI
- Enforce `audit:view` + competition-in-org guards
- Surface API errors in UI; null-safe entityId
- Unit tests for list summary + `audit:view` matrix

### Phase B — write completeness (in progress)

- [x] Settings updates (`SETTINGS_UPDATE`)
- [x] Score confirm
- [x] Approvals request / chief / director
- [x] Result publish (`RESULT_PUBLISHED`)
- [x] Pilot delete
- [x] Officials create / update / delete
- [x] Pass `actorUserId` for participant role assign/remove from pilot + official services
- [ ] Remaining: rounds lifecycle, teams, print, weather, display
- [ ] Resolve double-write on person create (controller + service)

### Phase C — multi-tenant fields

- Migration: optional `organizationId` (+ index)
- Writer fills from `req.organizationId`
- Org audit viewer

### Phase D — immutability / export

- No DELETE/PATCH for AuditLog in API
- Optional DB revoke for superuser retention jobs only
- Export CSV with `audit:view` or future `audit:export`

---

## 7. Verification checklist

1. Create competition → row with `competitionId` + actor.  
2. Open Admin Audit page → entries list (not blank/404).  
3. User without `audit:view` → 403 on API, route blocked in UI.  
4. Cross-tenant: User A cannot list Competition B audits.  
5. Score enter → entry with before/after useful summary.

---

## Related

- [AUTH_ARCHITECTURE_PROPOSAL.md](./AUTH_ARCHITECTURE_PROPOSAL.md)
- [AUTHENTICATION_INVENTORY.md](./AUTHENTICATION_INVENTORY.md)
