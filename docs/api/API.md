# API Reference

Base URL: `http://localhost:4000/api/v1`

All authenticated endpoints require `Authorization: Bearer <access_token>` unless noted.

Responses follow the envelope:

```json
{
  "success": true,
  "data": { … },
  "meta": { … }
}
```

Errors:

```json
{
  "success": false,
  "error": { "code": "…", "message": "…" }
}
```

Interactive documentation: **http://localhost:4000/api/docs**

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health check |

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Email/password → tokens, memberships, org selection flag |
| POST | `/auth/select-organization` | Yes | Select org for this client/tab (identity token unchanged) |
| POST | `/auth/refresh` | No | Refresh access token (optional `organizationId`) |
| POST | `/auth/logout` | No | Revoke refresh token |
| GET | `/auth/me` | Yes | Current user + memberships + active org context |

Send organization context on every tenant API call:

```
Authorization: Bearer <access_token>
X-Organization-Id: <organizationId>
```

### Organization context model

- A user may belong to many organizations via `OrganizationMember`
- Permissions come from the membership **permission bundle** (built-in `OrgRole` or custom `OrganizationRole`)
- Platform administrators (`SUPER_ADMIN`) manage tenants/licenses but need membership to enter an org
- One session can use different orgs in different tabs (`sessionStorage` + `X-Organization-Id`)
- Cross-organization access is rejected server-side

---

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List users |
| POST | `/users` | Admin | Create user |
| GET | `/users/:id` | Admin | Get user |
| PATCH | `/users/:id` | Admin | Update user |
| DELETE | `/users/:id` | Admin | Deactivate/remove user |

---

## Organizations

Organizations are the multi-tenant root: federations, clubs, and commercial customers own competitions. Sample seed tenant uses NPHA as an example organization — not product branding.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/organizations` | `organization:read` | List organizations (search, status, pagination) |
| POST | `/organizations` | `organization:manage` | Create organization |
| GET | `/organizations/:id` | `organization:read` | Get organization with settings and counts |
| PUT | `/organizations/:id` | `organization:manage` | Update organization profile / branding |
| PATCH | `/organizations/:id/status` | `organization:manage` | Activate, deactivate, or archive |
| PUT | `/organizations/:id/settings` | `organization:manage` | Update settings defaults (print, display, rules, …) |
| POST | `/organizations/:id/logo` | `organization:manage` | Upload logo (`multipart/form-data`, field `logo`) |
| GET | `/organizations/:id/competitions` | Member | List competitions owned by the organization |
| GET | `/organizations/:id/members` | `organization:members` | List members |
| POST | `/organizations/:id/members` | `organization:members` | Invite / add member |
| PATCH | `/organizations/:id/members/:memberId` | `organization:members` | Change role / custom role / status |
| DELETE | `/organizations/:id/members/:memberId` | `organization:members` | Deactivate membership |
| GET | `/organizations/:id/roles` | `organization:members` | List custom roles |
| POST | `/organizations/:id/roles` | `organization:roles` | Create custom role (permission bundle) |
| PATCH | `/organizations/:id/roles/:roleId` | `organization:roles` | Update custom role |
| DELETE | `/organizations/:id/roles/:roleId` | `organization:roles` | Delete custom role |

Hard deletion is not exposed. Organizations with competitions should be archived rather than removed. `Competition.organizationId` is required; create competition uses the **current organization context**.

Platform-only: `POST /organizations`, `PATCH /organizations/:id/status` require `platform:organizations`.

---

## Competitions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/competitions` | Yes | List competitions |
| POST | `/competitions` | `competition:create` | Create competition |
| GET | `/competitions/:id` | Yes | Get competition detail |
| PATCH | `/competitions/:id` | `competition:update` | Update competition |
| DELETE | `/competitions/:id` | `competition:delete` | Delete competition |
| PATCH | `/competitions/:id/settings` | `competition:update` | Update scoring/settings |
| POST | `/competitions/:id/publish` | `competition:publish` | Publish competition |

---

## Pilots

Base: `/competitions/:competitionId/pilots`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List pilots |
| GET | `/search?q=` | Yes | Search pilots |
| GET | `/qr/:code` | Yes | QR/barcode lookup |
| POST | `/` | `pilot:manage` | Register pilot |
| POST | `/import` | `pilot:manage` | CSV import (multipart) |
| GET | `/:pilotId` | Yes | Get pilot |
| PATCH | `/:pilotId` | `pilot:manage` | Update pilot |
| DELETE | `/:pilotId` | `pilot:manage` | Remove pilot |

---

## Teams

Base: `/competitions/:competitionId/teams`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List teams |
| POST | `/` | `team:manage` | Create team |
| GET | `/:teamId` | Yes | Get team with members |
| PATCH | `/:teamId` | `team:manage` | Update team |
| DELETE | `/:teamId` | `team:manage` | Delete team |
| PUT | `/:teamId/members` | `team:manage` | Set team roster |
| POST | `/:teamId/validate` | `team:manage` | Validate 3+1 team rules |

---

## Rounds

Base: `/competitions/:competitionId/rounds`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List rounds |
| POST | `/` | `round:manage` | Create round |
| GET | `/:roundId` | Yes | Get round with flights |
| PATCH | `/:roundId` | `round:manage` | Update round |
| DELETE | `/:roundId` | `round:manage` | Delete round |
| POST | `/:roundId/start` | `round:start` | Start round |
| POST | `/:roundId/pause` | `round:manage` | Pause round |
| POST | `/:roundId/resume` | `round:start` | Resume round |
| POST | `/:roundId/close` | `round:close` | Close round |
| POST | `/:roundId/reopen` | `round:manage` | Reopen closed round |
| POST | `/:roundId/flight-order` | `round:manage` | Generate flight order |

---

## Scores

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/scores/enter` | `score:enter` | Enter score for a flight |
| POST | `/scores/:scoreId/confirm` | `score:confirm` | Confirm entered score |
| GET | `/scores/:scoreId` | Yes | Get score detail |

Round scores list: `GET /competitions/:competitionId/results/rounds/:roundId/scores`

---

## Approvals

Base: `/competitions/:competitionId/rounds/:roundId/approvals`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List approval records |
| GET | `/status` | Yes | Combined approval status |
| POST | `/request` | `round:close` | Request dual approval |
| POST | `/chief-judge` | `score:approve_chief` | Chief Judge decision |
| POST | `/director` | `score:approve_director` | Director decision |

---

## Results & Rankings

Base: `/competitions/:competitionId/results`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rounds/:roundId/scores` | Yes | Scores for a round |
| POST | `/recalculate` | `results:publish` | Recalculate all rankings |
| GET | `/rankings/individual` | Yes | Individual rankings |
| GET | `/rankings/team` | Yes | Team rankings |
| GET | `/rankings/country` | Yes | Country rankings |
| GET | `/rankings/women` | Yes | Women category rankings |
| POST | `/publish` | `results:publish` | Publish official results |

---

## Reports (Print)

Base: `/competitions/:competitionId/reports`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List print history |
| POST | `/generate` | `print:generate` | Generate PDF report |
| GET | `/:printId/download` | `print:generate` | Download PDF |
| POST | `/:printId/approve` | `print:approve` | Approve print job |

---

## Announcements

Base: `/competitions/:competitionId/announcements`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List announcements |
| POST | `/` | `announce` | Create announcement |
| PATCH | `/:id` | `announce` | Update announcement |
| DELETE | `/:id` | `announce` | Delete announcement |

---

## Weather & Wind

Base: `/competitions/:competitionId/weather`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/weather` | Yes | List weather readings |
| POST | `/weather` | `weather:update` | Record weather |
| GET | `/wind` | Yes | List wind readings |
| GET | `/wind/latest` | Yes | Latest wind reading |
| POST | `/wind` | `weather:update` | Record wind |

---

## Display Layouts

Base: `/competitions/:competitionId/display-layouts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List layouts |
| GET | `/default` | Yes | Default layout for type |
| POST | `/` | `display:control` | Create layout |
| GET | `/:id` | Yes | Get layout |
| PATCH | `/:id` | `display:control` | Update layout |
| DELETE | `/:id` | `display:control` | Delete layout |

---

## Statistics

Base: `/competitions/:competitionId/statistics`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Competition statistics |
| GET | `/rounds/:roundId` | Yes | Round statistics |

---

## Offline Sync

Base: `/sync`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pending` | Yes | Pending sync items |
| POST | `/enqueue` | Yes | Queue offline operation |
| POST | `/clients/:clientId/process` | Yes | Process client batch |
| POST | `/:id/synced` | Yes | Mark item synced |
| POST | `/:id/failed` | Yes | Mark item failed |

---

## Public (no auth)

Base: `/public`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/competitions` | List published competitions (`active` / `past`) |
| GET | `/:slug` | Public competition info (id or publicSlug) |
| GET | `/:slug/results?category=OVERALL` | Published rankings |
| GET | `/:slug/rounds?round=1` | Round results |
| GET | `/:slug/latest-score` | Most recent judge-entered score |

Requires `isPublished: true` and `livePublicResults: true` in competition settings.

---

## WebSocket events

Connect to `ws://localhost:4000/socket.io` with JWT auth.

Common events:

| Event | Direction | Description |
|-------|-----------|-------------|
| `round:updated` | Server → Client | Round status change |
| `score:entered` | Server → Client | New score entered |
| `score:confirmed` | Server → Client | Score confirmed |
| `flight:status` | Server → Client | Flight launch/land update |
| `rankings:updated` | Server → Client | Rankings recalculated |
| `announcement:live` | Server → Client | Live announcement |

---

## Rate limiting

Default: skipped in development/test; **15 000** requests per 15 minutes per IP in production (configurable via `RATE_LIMIT_*` env vars).

---

## Related

- [Architecture Overview](../architecture/OVERVIEW.md)
- [Installation Guide](../guides/INSTALLATION.md)
- Swagger UI: `/api/docs`
