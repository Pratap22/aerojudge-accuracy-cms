# Authorization Matrix

**Status:** Phase 1–2 — derived from `@npha/shared` system org role permission bundles.  
**Source of truth:** `packages/shared/src/constants/index.ts` (`SYSTEM_ORG_ROLE_DEFINITIONS`).  
**Last reviewed:** 2026-08-03

Permissions are checked by **permission key**, not `role === '…'`. Built-in org roles are named bundles. Custom `OrganizationRole` rows supply an explicit permission list stored in the DB.

Platform role on `User.role` is separate. Platform-only permissions are not shown as org-column checks.

Legend: **✓** grants · blank denies.

---

## 1. Organization-scoped actions (built-in roles)

Columns: **Owner** = `ORGANIZATION_OWNER` · **MD** = `MEET_DIRECTOR` · **CJ** = `CHIEF_JUDGE` · **Scorer** · **Judge** · **Ann.** = Announcer · **Disp.** = Display Operator · **L/G** = Launch or Goal Marshal · **Reg.** = Registration Officer · **View** = Viewer

| Action | Permission key | Owner | MD | CJ | Scorer | Judge | Ann. | Disp. | L/G | Reg. | View |
|--------|----------------|:-----:|:--:|:--:|:------:|:-----:|:----:|:-----:|:---:|:----:|:----:|
| Read organization surface | `organization:read` | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage organization settings | `organization:manage` | ✓ | | | | | | | | | |
| Manage members (invite/roles/status) | `organization:members` | ✓ | ✓ | | | | | | | | |
| Manage custom org roles | `organization:roles` | ✓ | ✓ | | | | | | | | |
| Create competition | `competition:create` | ✓ | ✓ | | | | | | | | |
| Update competition / settings | `competition:update` | ✓ | ✓ | | | | | | | | |
| Delete competition | `competition:delete` | ✓ | | | | | | | | | |
| Publish competition listing | `competition:publish` | ✓ | ✓ | | | | | | | | |
| Manage pilots | `pilot:manage` | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | |
| Manage teams | `team:manage` | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | |
| Manage rounds | `round:manage` | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| Start round | `round:start` | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| Close round | `round:close` | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| Enter score | `score:enter` | ✓ | | ✓ | ✓ | ✓ | | | | | |
| Confirm score | `score:confirm` | ✓ | | ✓ | ✓ | | | | | | |
| Chief judge approve scores | `score:approve_chief` | ✓ | ✓ | ✓ | | | | | | | |
| Director approve scores | `score:approve_director` | ✓ | ✓ | | | | | | | | |
| Publish results | `results:publish` | ✓ | ✓ | ✓ | | | | | | | |
| Generate print / reports | `print:generate` | ✓ | ✓ | ✓ | ✓ | | | ✓ | | | |
| Approve print | `print:approve` | ✓ | ✓ | ✓ | | | | | | | |
| Control venue display | `display:control` | ✓ | ✓ | | | | | ✓ | | | |
| Announcements | `announce` | ✓ | ✓ | | | | ✓ | | | | |
| Weather updates | `weather:update` | ✓ | ✓ | ✓ | | | | | ✓ | | |
| View audit logs | `audit:view` | ✓ | ✓ | ✓ | | | | | | | |

### Derived product notes (from code, not product marketing)

1. **Meet Director cannot enter or confirm scores** unless Owner or a custom role adds those permissions.  
2. **Judge has no `organization:read`** — may affect org-nav UX that gates on that key.  
3. **Owners** inherit Meet Director + delete/manage + score enter/confirm.  
4. **Scorer** includes judge-like scoring entry + pilot/team management.  
5. **Registration Officer** manages pilots/teams only (plus `organization:read`).

---

## 2. Platform-only actions

| Action | Permission | SUPER_ADMIN | PLATFORM_SUPPORT | PLATFORM_DEVELOPER | Org roles |
|--------|------------|:-----------:|:----------------:|:------------------:|-----------|
| Create/archive orgs (platform) | `platform:organizations` | ✓ | | | none |
| Licenses | `platform:licenses` | ✓ | | | none |
| Platform analytics | `platform:analytics` | ✓ | ✓ | | none |
| Manage platform users | `user:manage` | ✓ | | | none |

Platform roles **do not** receive org competition data without an `OrganizationMember` row (enforced by `hasEffectivePermission` when org-scoped checks use membership permissions).

---

## 3. Competition participation roles (NOT authorization)

| Concept | Authorization? |
|---------|----------------|
| `CompetitionRole` (PILOT, CHIEF_JUDGE, …) on `CompetitionParticipantRole` | **No** — event identity / roster |
| `CompetitionOfficial` display labels | **No** — public roster text |
| `CompetitionUser` | **No** — legacy seed only |

Assigning `TARGET_JUDGE` on a competition **must not** grant `score:enter`. Login permission still comes from org membership.

---

## 4. Legacy global `User.role` matrix

Still present as `PERMISSIONS` for backward compatibility. Effective check falls back to it only when:

- no org role, and  
- no explicit permissions array, and  
- not a platform role, and  
- permission is not platform-only.

**Risk:** accounts still holding legacy competition roles on `User.role` can receive permissions **without** org context.

**Recommendation:** mark legacy matrix deprecated; strip non-platform values from new users; require membership for all tenant permissions. See proposal.

---

## 5. DECISION REQUIRED

| # | Topic | Why |
|---|--------|-----|
| D1 | Should Meet Director enter scores? | Code: no; product talk often yes |
| D2 | Should Judge have `organization:read`? | Code: no; may break nav consistency |
| D3 | SUPER_ADMIN break-glass into all orgs | Code: no; ops may want support access |
| D4 | `audit:export` separate from `audit:view` | Not in code today |
| D5 | Competition-assignment gate on scoring | Not enforced via CompetitionUser |
| D6 | Keep or delete legacy `User.role` permission fallback | Security vs migration ease |

Do **not** silently grant new permissions until product confirms D1–D6.

---

## 6. How checks run (server)

```
Authenticated User (JWT)
  → Linked Person? (optional, for identity APIs)
  → X-Organization-Id
  → OrganizationMember ACTIVE + permissions
  → hasEffectivePermission(required)
  → Competition.organizationId == context (when resource is competition-scoped)
  → ALLOW / DENY
```

Frontend mirrors permission keys for UX only.
