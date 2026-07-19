-- Second layer of tenant isolation, independent of application code.
-- Run after `prisma migrate deploy`. The app sets `app.company_id` per
-- request via `SET LOCAL app.company_id = '<id>'` inside a transaction
-- (see lib/db-scoped.ts) so these policies only ever see the caller's
-- own tenant.

alter table "customer" enable row level security;
alter table "lead" enable row level security;
alter table "job" enable row level security;
alter table "estimate" enable row level security;
alter table "invoice" enable row level security;
alter table "payment" enable row level security;
alter table "review_request" enable row level security;
alter table "conversation" enable row level security;
alter table "message" enable row level security;
alter table "notification" enable row level security;
alter table "audit_log" enable row level security;
alter table "equipment" enable row level security;
alter table "automation" enable row level security;
alter table "membership" enable row level security;
alter table "role" enable row level security;
alter table "invitation" enable row level security;

do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'customer','lead','job','estimate','invoice','payment',
      'review_request','conversation','notification','audit_log',
      'equipment','automation','membership','role','invitation'
    ])
  loop
    execute format(
      'create policy tenant_isolation_%1$s on %1$s
         using ("companyId" = current_setting(''app.company_id'', true))
         with check ("companyId" = current_setting(''app.company_id'', true));',
      tbl
    );
  end loop;
end $$;

-- message has no companyId directly; scope through its conversation.
create policy tenant_isolation_message on "message"
  using (
    exists (
      select 1 from "conversation" c
      where c.id = "message"."conversationId"
        and c."companyId" = current_setting('app.company_id', true)
    )
  );
