# Rapid CRM — Architecture

## 1. Tenancy model

Every table that holds business data carries a `companyId`. There is no
"global" table for Customers, Jobs, Invoices, etc. A `Company` is the
tenant boundary. A `User` can belong to exactly one `Company` (via
`Membership`), which keeps permission logic simple — no cross-company
role juggling in v1.

**Enforcement strategy (defense in depth):**

1. **Every Prisma query is wrapped.** We never call `prisma.customer.findMany()`
   directly in a route handler. We call `db.customer.findMany(ctx, {...})`
   where `ctx` is the authenticated request context carrying `companyId`.
   The wrapper (`lib/db-scoped.ts`) injects `where: { companyId }` on every
   read and `data: { companyId }` on every write, and throws if a caller
   tries to override it.
2. **Route-level guard.** `lib/api/with-auth.ts` is a higher-order function
   every route handler is wrapped in. It resolves the session, loads the
   `Membership`, and passes a `RequestContext { userId, companyId, role,
   permissions }` into the handler. A route physically cannot run without
   a resolved `companyId`.
3. **Row-level checks on relations.** When a request references a resource
   by ID that itself references another resource (e.g. "add a note to job
   X"), the service layer re-verifies `job.companyId === ctx.companyId`
   before mutating — never trusts a nested ID blindly.
4. **Postgres RLS as a second layer** (see `prisma/rls.sql`) — even if
   application code has a bug, row-level security policies scoped to
   `current_setting('app.company_id')` stop cross-tenant reads at the DB.

## 2. Folder structure

```
app/
  (auth)/                 sign-in, sign-up, verify-email, reset-password
  (app)/                  authenticated app shell (sidebar, topbar, command palette)
    dashboard/
    customers/
    leads/
    jobs/
    scheduling/
    estimates/
    invoices/
    payments/
    automation/
    reviews/
    team/
    reports/
    calculators/
    equipment/
    settings/
  api/
    v1/
      customers/route.ts        (GET list, POST create)
      customers/[id]/route.ts   (GET, PATCH, DELETE one)
      ...one folder per resource, same shape
components/
  ui/            shadcn primitives (button, input, dialog, etc.)
  customers/     feature-scoped components
  jobs/
  shared/        cross-feature composed components (DataTable, EmptyState, PageHeader)
lib/
  auth.ts               Better Auth server config
  auth-client.ts        Better Auth client hooks
  db.ts                 raw Prisma client singleton
  db-scoped.ts           company-scoped query wrapper
  permissions.ts         role -> permission matrix + `can()` helper
  api/
    with-auth.ts          route wrapper: session -> RequestContext
    error-handler.ts       consistent API error shapes
    rate-limit.ts
  validation/             zod schemas, one file per resource
types/
  index.ts
services/                 business logic, one file per domain (customers.service.ts, jobs.service.ts)
hooks/                    useCustomers(), useJobs(), etc. (React Query wrappers)
middleware.ts             session refresh + route protection
prisma/
  schema.prisma
  rls.sql
  seed.ts
```

Rule of thumb: **route handlers stay thin.** They parse/validate input,
call a service function, return a response. All business logic (review
routing rules, invoice totals, permission checks) lives in `services/`,
which is framework-agnostic and unit-testable.

## 3. Auth & account types

Better Auth handles session management, email/password, Google OAuth,
email verification, and password reset natively. On top of its `user`
table we add:

- `Company` — the tenant
- `Membership` — join table: `userId + companyId + roleId`, one row per
  person per company (v1: one company per user, but the shape supports
  multi-company later without a migration)
- `Role` — either a system role (Owner, Admin, Office Manager,
  Technician, Sales Rep) or a custom role scoped to a company, holding a
  JSON `permissions` map
- `Invitation` — email/link/QR invite, `expiresAt`, `token`, `roleId`,
  `companyId`

Signup flow branches on account type:
- **Business Owner** → create `Company` + `Membership(role=Owner)` in one
  transaction right after Better Auth creates the `user` row (via Better
  Auth's `databaseHooks.user.create.after`).
- **Team Member** → no company created at signup; they land on
  "enter invite code" or arrive via `/invite/[token]`, which creates
  their `Membership` against the inviting company.

## 4. Permissions

Permissions are additive strings like `customers:read`, `invoices:write`,
`team:manage`, `billing:manage`. Each `Role` stores an array of granted
permission strings. `lib/permissions.ts` exports:

```ts
can(ctx: RequestContext, permission: Permission): boolean
requirePermission(ctx, permission): void // throws ApiError(403)
```

System roles ship with sane defaults (Owner = `*`), but every permission
on every role is editable by an Owner/Admin from Settings → Roles, stored
per-company so a custom role never leaks into another tenant.

## 5. Review gating state machine

`ReviewRequest` record per completed job:

```
states: CREATED -> SENT -> OPENED -> RATED -> (PUBLIC_REDIRECTED | PRIVATE_FEEDBACK) -> RESOLVED
```

- Job marked `COMPLETED` → service creates `ReviewRequest`, sends SMS/email
  with a signed link `/review/[token]`.
- Link open → `OPENED`, timestamp recorded.
- Customer selects 1-5 stars → `RATED`, `rating` stored.
  - `rating >= 4` → redirect to `company.googleReviewUrl`, status
    `PUBLIC_REDIRECTED`.
  - `rating <= 3` → render private feedback form, on submit status
    `PRIVATE_FEEDBACK`, `feedbackText` stored, owner notified
    (in-app + email) immediately.
- Owner can mark a private-feedback request `RESOLVED` with an internal
  note.

This whole flow is public-facing (customer isn't authenticated), so the
`[token]` route is the only customer-facing surface with no session
requirement — validated by a signed, single-use, expiring token instead.

## 6. Real-time (chat, notifications)

v1 uses **Supabase Realtime** (Postgres logical replication) rather than
standing up a separate WebSocket server — we're already on Postgres, and
it gives us per-row change subscriptions filtered by `companyId` for
free via RLS. `Message`, `Conversation`, `Notification` tables are the
source of truth; the client subscribes to `postgres_changes` on those
tables scoped to the user's company/conversation.

## 7. What's included in this delivery vs. what follows the same pattern

Fully implemented in this pass: schema, auth wiring, permission system,
scoped-query layer, and the **Customers** module end-to-end (types →
zod validation → service → API routes → hooks → UI list/detail/form) as
the reference every other module (Leads, Jobs, Estimates, Invoices, etc.)
copies exactly. Each additional module is the same five-layer pattern
with different fields — mechanical, not novel, work.
