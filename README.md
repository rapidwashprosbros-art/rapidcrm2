# Rapid CRM

## What's actually implemented here

- **Full Prisma schema** (`prisma/schema.prisma`) — every model for
  Customers, Leads, Jobs, Scheduling, Estimates, Invoices, Payments,
  Reviews, Team/Roles/Invitations, Chat, Notifications, Audit Log,
  Equipment, Automation. Fully normalized, indexed, multi-tenant.
- **Postgres RLS policies** (`prisma/rls.sql`) as a second, DB-level
  layer of tenant isolation independent of application code.
- **Better Auth wiring** (`lib/auth.ts`) — email/password, email
  verification, password reset, Google OAuth, session config, and a
  `databaseHooks` hook that auto-provisions a Company + Owner role the
  moment a Business Owner signs up.
- **Permission system** (`lib/permissions.ts`) — full permission string
  set, system role defaults for Owner/Admin/Office Manager/Technician/
  Sales Rep, `can()`/`requirePermission()` helpers.
- **Tenant-scoped query layer** (`lib/db-scoped.ts`) — every model query
  is routed through a wrapper that injects `companyId` automatically and
  sets the Postgres session variable RLS checks against.
- **Route auth wrapper** (`lib/api/with-auth.ts`) — resolves session →
  membership → `RequestContext`, enforces permissions, wraps in a
  tenant-scoped transaction, normalizes errors.
- **Customers module, end to end** — this is the reference
  implementation every other module follows exactly:
  - `lib/validation/customer.schema.ts` — Zod schemas
  - `services/customers.service.ts` — business logic, audit logging,
    guard against deleting a customer with active jobs
  - `app/api/v1/customers/route.ts` + `[id]/route.ts` — REST endpoints
  - `hooks/use-customers.ts` — React Query hooks
  - `components/customers/*` — form (react-hook-form + zod) and table
    (search, pagination, loading/empty states, motion)
  - `app/(app)/customers/page.tsx` — the page that wires it together
- **Onboarding + email services** — `services/onboarding.service.ts`
  (transactional company/role/membership creation),
  `services/email.service.ts` (Resend-backed transactional email with
  templates for verification, reset, invitations, review requests,
  negative-feedback alerts).
- **Design tokens** (`app/globals.css`, `tailwind.config.ts`) — light/dark
  HSL variable system, soft/elevated shadow scale, rounded-corner radius
  scale, ready for the shadcn/ui primitives (two are included:
  `Button`, `Input`).

## What follows the same pattern (not yet written out)

Leads, Jobs, Scheduling, Estimates, Invoices, Payments, Team/Invitations,
Chat, Reviews, Reports, Calculators, Equipment, Automation, Notifications,
Settings, Search/Command Palette. Each is mechanically the same five
layers as Customers — schema (done, in `schema.prisma`) → Zod schema →
service → API routes → hooks → UI. None of it is a novel architectural
problem once Customers is the template; it's volume, which is exactly
the kind of work Claude Code should grind through with real
install/build/test verification after each module, rather than more
unverified files accumulating in a chat.

## Running it

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum to start
npx prisma migrate dev --name init
npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma
npm run dev
```

## Notable design decisions

- **One company per user in v1.** `Membership` is modeled as a join
  table (not a direct FK) so multi-company support later doesn't require
  a schema migration — just relaxing the uniqueness constraint.
- **Review gating** (`ReviewRequest` model) implements the Flyer-style
  flow as an explicit state machine — see `docs/ARCHITECTURE.md` §5.
- **Rate limiting** ships with an in-process store so the app runs
  standalone; the interface is Redis-ready (`lib/api/rate-limit.ts`) —
  swap the store before running multiple serverless instances, since
  in-memory state doesn't share across Vercel lambdas.
- **Real-time** (chat, live notifications) is designed around Supabase
  Realtime / Postgres logical replication rather than a bespoke
  WebSocket server — see `docs/ARCHITECTURE.md` §6.
