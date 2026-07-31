# Authentication & Authorization

AeroJudge uses **organization-based, permission-driven access control**.

## Concepts

| Layer | Where | Purpose |
|-------|--------|---------|
| Platform role | `User.role` | SaaS operators (Platform Admin / Support / Developer) |
| Organization membership | `OrganizationMember` | Links a user to an org with a built-in or custom role |
| Permission bundle | `OrgRole` definition or `OrganizationRole.permissions` | What the member may do |
| Organization context | `X-Organization-Id` (per tab) | Active tenant for the request |
| Competition assignment | `CompetitionUser` | Optional event-level staff (legacy/seed) |

## Platform roles

- `SUPER_ADMIN` — Platform Administrator (create/suspend orgs, licenses, platform users)
- `PLATFORM_SUPPORT` — read platform analytics / support tooling
- `PLATFORM_DEVELOPER` — reserved for engineering tooling

Platform roles **do not** grant competition or org data access. Join an organization explicitly.

## Permission-based roles

Authorization checks **permissions**, not role name equality.

Examples:

- `competition:create`
- `competition:delete`
- `pilot:manage`
- `team:manage`
- `score:enter` / `score:approve_chief`
- `results:publish`
- `print:generate`
- `organization:members`
- `organization:roles`
- `organization:manage`

Built-in `OrgRole` values (Owner, Chief Judge, Meet Director, …) are **named bundles** defined in `@npha/shared` (`SYSTEM_ORG_ROLE_DEFINITIONS`).

Organizations can also create **custom roles** (`OrganizationRole`) — e.g. “Deputy Chief Judge” — with an explicit permission list. Assign via `OrganizationMember.customRoleId`. Custom roles win over the built-in `role` bundle.

APIs:

- `GET/POST /organizations/:id/roles`
- `PATCH/DELETE /organizations/:id/roles/:roleId`
- Member update accepts `customRoleId`

## Multi-tab organization context

One login session can use **different organizations in different browser tabs**:

| Storage | Contents |
|---------|----------|
| `localStorage` | Access + refresh tokens (shared session) |
| `sessionStorage` | Active `organizationId` (**per tab**) |

Every tenant API call sends `X-Organization-Id` from that tab’s `sessionStorage`. The JWT is **identity-only** (no active-org claim), so switching org in one tab does not overwrite another tab’s context.

## Request validation

Every tenant API:

1. Authenticates JWT (identity)
2. Resolves org from `X-Organization-Id`
3. Loads **active** `OrganizationMember` (+ optional custom role) from the database
4. Checks permission against the membership’s **permission bundle**
5. Ensures competition rows belong to that organization

## Login UX

1. Sign in with email/password
2. One membership → enter automatically (tab stores that org)
3. Multiple memberships → organization selector (choice stored in this tab only)
4. Sidebar shows current organization and allows switching **in this tab**
5. Open another tab → select a different org without affecting the first
