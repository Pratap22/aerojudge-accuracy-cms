# Person Identity Architecture

**Product principle:** *Create once. Participate everywhere.*

Canonical identity is a **Person**. Authentication, organization permissions, competition participation, and historical results are separate concerns.

---

## 1. Current domain model (pre-change)

Three disconnected silos:

| Concept | Model | Scope | Login? |
|---------|--------|--------|--------|
| Athlete | `Pilot` | Per competition | No |
| Public staff label | `CompetitionOfficial` | Per competition | No |
| Staff account | `User` + `OrganizationMember` | Platform + org | Yes |
| Unused staff assign | `CompetitionUser` | Per competition | Yes (schema only) |

Scoring, teams, and rankings hang exclusively on **`Pilot.id`**.

There was no directory search, no cross-competition reuse, and no link between pilot ↔ official ↔ user.

---

## 2–4. Relationships (auth / org / competition)

```
User ── OrganizationMember ── Organization ── Competition
                                                    │
                         Pilot · Team · Official · Scores…
                         (identity fields duplicated per event)
```

- Auth and RBAC remain **org permission bundles** + `X-Organization-Id`.
- `CompetitionUser` is **not** used for authorization in the API.
- Officials are **display roster** rows (name/role strings), not permission grants.

---

## 5. Problems

1. Same real-world person recreated per competition (name, CIVL, photo…).
2. Pilot vs Judge treated as different entity types.
3. No reusable directory or duplicate prevention.
4. Sensitive data mixed with identity on competition-scoped rows without a global privacy model.
5. No path to “claim profile” / personal dashboard without creating duplicates.

---

## 6. Proposed domain model

```
Person  (global identity — who)
  │
  ├── User Account?     (optional login — how you sign in)
  ├── AeroJudge Profile (product concept; mostly derived)
  ├── Organization Memberships (via User → OrganizationMember)
  └── CompetitionParticipant  (one per competition + person)
            ├── CompetitionParticipantRole  (normalized roles)
            ├── Pilot snapshot + scoring FKs  (if PILOT)
            └── CompetitionOfficial snapshot (if official roles)
```

### Separation of concerns

| Layer | Question |
|-------|----------|
| **Person** | Who are you? |
| **User** | How do you log in? |
| **Profile** | What history / preferences does AeroJudge expose? |
| **OrganizationMember** | What can you do in this org? |
| **CompetitionParticipant + Role** | What are you doing at this event? |
| **RBAC permissions** | What API actions may this account perform? |

Competition **role ≠** authorization permission. Assigning `TARGET_JUDGE` does not grant `score:enter`; that remains org membership + permissions.

### Product policy: Pilot and Judge together

**A Person cannot hold both a pilot role and a judge/official role in the same competition.**

- Allowed: pilot in A, target judge in B, chief judge in C.
- Disallowed: pilot + any of `CHIEF_JUDGE`, `TARGET_JUDGE`, `JUDGE`, … in competition D.
- Enforced in services (role assignment / pilot registration), not by collapsing identity.

---

## 7. Tables / models that change

| Change | Notes |
|--------|--------|
| **New `Person`** | Global identity + `aeroJudgeId` (`AJ-XXXXXX`) |
| **New `CompetitionParticipant`** | Unique `(competitionId, personId)` |
| **New `CompetitionParticipantRole`** | Unique `(participantId, role)` |
| **New `ProfileClaimRequest`** | Secure claim foundation (no auto-claim) |
| **New `PersonMergeLog`** | Audit for controlled merges |
| **`User.personId`** | Optional 1:1 link |
| **`Pilot.personId` + `participantId`** | Links scoring roster to Person; **snapshot fields stay on Pilot** |
| **`CompetitionOfficial.personId` + `participantId`** | Optional link; name remains snapshot |

**Intentionally unchanged:** `Flight`, `Score`, `IndividualRanking`, `TeamMember` still use `pilotId`. No scoring rewrite.

### Snapshot vs global current data

| Global (Person) | Competition snapshot (Pilot / Official / results) |
|-----------------|-----------------------------------------------------|
| Current name, photo, CIVL, FAI, nationality country | `firstName` / `lastName` / `nationality` / `countryId` on Pilot at registration |
| Privacy prefs, claim link | Pilot number, team, glider, category flags, emergency contact |
| | Official public display `name` / `role` at assignment |

Updating Person **must not** rewrite historical Pilot/Official snapshot columns or `Result.payloadJson`.

### Privacy classification

| Class | Examples | Exposure |
|-------|----------|----------|
| PUBLIC (if profile public) | Display name, country, CIVL, AJ ID, verified competition history | Optional `/public/profiles/{aeroJudgeId}` |
| DIRECTORY (organizers) | Same + gender | Person search with `pilot:manage` / `competition:update` |
| PRIVATE | Email, phone, DOB | Org-authorized only; never public profile payload |
| SENSITIVE | Emergency contacts, medical notes | **Only** on competition Pilot (not global Person) |

### AeroJudge Profile

No separate Profile table required. Profile is:

`Person` + participations/roles + pilots/rankings derived + visibility flags.

---

## 8. Migration strategy

1. Add Person / Participant / Role / claim / merge tables + FKs (nullable).
2. Backfill:
   - **Users** → one Person each; `User.personId`.
   - **Pilots** with same non-null `civlId` → single Person; others → one Person per pilot (no name-only merge).
   - **Officials** → Person per row (safe); link participant + role when mappable.
   - Create `CompetitionParticipant` + `PILOT` role for each pilot enrollment.
3. Keep all Pilot / Score / Team IDs; only additive FKs.
4. New writes always ensure Person + Participant + Role.

### Data-loss risks (mitigated)

| Risk | Mitigation |
|------|------------|
| Wrong CIVL merge | Unique CIVL only for active persons; review ambiguous non-CIVL rows |
| Name collision | Never auto-merge on name alone |
| Score break | Pilot PK unchanged |
| Delete pilot destroys identity | `deletePilot` drops enrollment/role only; Person retained |

---

## 9. Backward compatibility risks

- APIs that create pilots without `personId` still work (Person auto-created).
- Pilot list shape gains optional `personId` / `aeroJudgeId`.
- Official APIs accept optional `personId` / competition role enum mapping.
- CSV import match report may return ambiguous matches (review required).

---

## 10. Data-loss risks

See table above. Rollback: drop new tables / nullable columns; old Pilot fields untouched.

---

## 11. APIs affected / added

| Area | Notes |
|------|--------|
| `GET/POST /people` | Directory search & create |
| `GET/PATCH /people/:id` | Directory identity (privacy-filtered) |
| `GET /people/:id/history` | Competition participation history |
| `POST /people/match` | Duplicate detection |
| `POST /people/:id/merge` | Controlled merge (platform/admin) |
| `POST …/pilots` | Accept `personId`; link participant |
| `POST …/pilots/import` | Match persons; report possible duplicates |
| `POST …/officials` | Accept `personId` + map role |
| User / org invite | Ensure Person on user create |

Existing pilot/official routes remain the primary competition mutators.

---

## 12. UI affected

- Admin **Pilots**: search directory → select Person → enter pilot number / equipment only.
- Admin **Officials**: same directory search → assign role.
- Future: People module / My AeroJudge dashboard / public profile.

---

## Architect review checklist

| # | Requirement | Status design |
|---|-------------|----------------|
| 1 | Person without login | Yes — Person optional User |
| 2 | Unlimited competitions | Yes — many participants |
| 3 | Different roles per event | Yes |
| 4 | Multiple roles same event | Yes, except pilot+judge policy |
| 5–7 | Multi-org + isolation | Unchanged org RBAC; Person directory public fields only |
| 8–11 | Returning pilot/judge | Directory search + personId |
| 12–14 | Dupes / claim / history integrity | Match + merge + claim request; snapshots on Pilot |
| 15–16 | Reconstruct history / sensitive | Derived from participation; medical on Pilot only |
| 17 | Scores/teams survive | Pilot PK retained |
| 18 | No duplicate architecture | Official display + Pilot scoring keep purpose; shared via Person |

---

## Self-registration flow (participants)

```
Login / Create AeroJudge account
        │
        ├─ signup creates/links Person (email ownership)
        │
        ▼
Optional: Claim existing Person
  (VERIFIED_EMAIL match only for auto-link;
   otherwise PENDING organiser approval)
        │
        ▼
Register for competition
  → identity from Person
  → competition fields only
```

Unauthenticated open registration is disabled (`POST /public/:slug/register` requires Bearer auth).

Related APIs: `POST /auth/register`, `GET /auth/me` (includes `person`), `POST /auth/me/person/claim`, `GET /auth/me/person/lookup`.

---

## Related

- [ER Diagram](ER_DIAGRAM.md)
- [Architecture Overview](OVERVIEW.md)
- [Authentication](../guides/AUTHENTICATION.md)
- [Competition Ops](../guides/COMPETITION_OPS.md)
