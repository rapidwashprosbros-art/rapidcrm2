import { scopedDb } from "@/lib/db-scoped";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/error-handler";
import { logAudit } from "@/services/audit.service";
import type { RequestContext, PaginatedResult } from "@/types";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from "@/lib/validation/customer.schema";
import type { Customer } from "@prisma/client";

export async function listCustomers(
  ctx: RequestContext,
  query: ListCustomersQuery
): Promise<PaginatedResult<Customer>> {
  const db = scopedDb(ctx);
  const where = query.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" as const } },
          { lastName: { contains: query.search, mode: "insensitive" as const } },
          { email: { contains: query.search, mode: "insensitive" as const } },
          { phone: { contains: query.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.customer.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function getCustomer(ctx: RequestContext, id: string): Promise<Customer> {
  const db = scopedDb(ctx);
  const customer = await db.customer.findUniqueScoped({ where: { id } });
  if (!customer) throw new ApiError(404, "Customer not found");
  return customer;
}

export async function createCustomer(
  ctx: RequestContext,
  input: CreateCustomerInput
): Promise<Customer> {
  const db = scopedDb(ctx);
  const customer = await db.customer.create({
    data: {
      ...input,
      email: input.email || null,
    },
  });

  await logAudit(ctx, {
    action: "customer.created",
    entityType: "Customer",
    entityId: customer.id,
  });

  return customer;
}

export async function updateCustomer(
  ctx: RequestContext,
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  // Verify tenancy before mutating — belt-and-suspenders alongside the
  // scoped `where` update below.
  await getCustomer(ctx, id);

  const db = scopedDb(ctx);
  const customer = await db.customer.update({
    where: { id },
    data: input,
  });

  await logAudit(ctx, {
    action: "customer.updated",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { fields: Object.keys(input) },
  });

  return customer;
}

export async function deleteCustomer(ctx: RequestContext, id: string): Promise<void> {
  await getCustomer(ctx, id);

  const activeJobs = await prisma.job.count({
    where: { customerId: id, companyId: ctx.companyId, status: { not: "CANCELED" } },
  });
  if (activeJobs > 0) {
    throw new ApiError(
      409,
      "This customer has active jobs. Cancel or complete them before deleting."
    );
  }

  const db = scopedDb(ctx);
  await db.customer.delete({ where: { id } });

  await logAudit(ctx, {
    action: "customer.deleted",
    entityType: "Customer",
    entityId: id,
  });
}
