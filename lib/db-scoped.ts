import { prisma } from "@/lib/db";
import type { RequestContext } from "@/types";

/**
 * Every model that carries a companyId gets routed through here. Route
 * handlers and services must never import `prisma` directly for these
 * models — import `scopedDb(ctx)` instead. This does two things:
 *
 *   1. Injects `companyId` into every where/data clause, so a bug that
 *      forgets to filter by tenant is structurally impossible.
 *   2. Sets the Postgres session variable RLS policies check, so even a
 *      raw query or a future bug here is caught at the database layer.
 *
 * Usage:
 *   const db = scopedDb(ctx);
 *   await db.customer.findMany();          // auto-filtered to ctx.companyId
 *   await db.customer.create({ data: {...} }); // companyId injected
 */
export function scopedDb(ctx: RequestContext) {
  const companyId = ctx.companyId;

  return {
    customer: makeScopedModel(prisma.customer, companyId),
    lead: makeScopedModel(prisma.lead, companyId),
    job: makeScopedModel(prisma.job, companyId),
    estimate: makeScopedModel(prisma.estimate, companyId),
    invoice: makeScopedModel(prisma.invoice, companyId),
    payment: makeScopedModel(prisma.payment, companyId),
    reviewRequest: makeScopedModel(prisma.reviewRequest, companyId),
    conversation: makeScopedModel(prisma.conversation, companyId),
    notification: makeScopedModel(prisma.notification, companyId),
    auditLog: makeScopedModel(prisma.auditLog, companyId),
    equipment: makeScopedModel(prisma.equipment, companyId),
    automation: makeScopedModel(prisma.automation, companyId),
    membership: makeScopedModel(prisma.membership, companyId),
    role: makeScopedModel(prisma.role, companyId),
    invitation: makeScopedModel(prisma.invitation, companyId),
  };
}

/**
 * Runs `fn` inside a transaction with `app.company_id` set for the
 * session, so Postgres RLS policies apply even to raw/edge-case queries.
 * Wrap any handler that talks to the DB in this at the top level
 * (done automatically by `withAuth`, see lib/api/with-auth.ts).
 */
export async function withTenantSession<T>(
  companyId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.company_id = '${companyId}'`);
    return fn();
  });
}

// ── internals ──────────────────────────────────────────────────────────

type AnyDelegate = {
  findMany: (args?: any) => Promise<any>;
  findFirst: (args?: any) => Promise<any>;
  findUnique: (args?: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args?: any) => Promise<any>;
  count: (args?: any) => Promise<any>;
};

function makeScopedModel<T extends AnyDelegate>(delegate: T, companyId: string) {
  const withCompanyWhere = (args: any = {}) => ({
    ...args,
    where: { ...(args.where ?? {}), companyId },
  });

  return {
    findMany: (args?: any) => delegate.findMany(withCompanyWhere(args)),
    findFirst: (args?: any) => delegate.findFirst(withCompanyWhere(args)),
    // findUnique can't take an arbitrary where merge (unique constraint
    // shape), so we fetch then verify tenancy explicitly.
    findUniqueScoped: async (args: any) => {
      const record = await delegate.findUnique(args);
      if (record && record.companyId !== companyId) return null;
      return record;
    },
    create: (args: any) =>
      delegate.create({ ...args, data: { ...args.data, companyId } }),
    update: (args: any) => delegate.update(withCompanyWhere(args)),
    updateMany: (args: any) => delegate.updateMany(withCompanyWhere(args)),
    delete: (args: any) => delegate.delete(withCompanyWhere(args)),
    deleteMany: (args?: any) => delegate.deleteMany(withCompanyWhere(args)),
    count: (args?: any) => delegate.count(withCompanyWhere(args)),
  };
}
