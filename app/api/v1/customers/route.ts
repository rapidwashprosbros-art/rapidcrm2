import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { listCustomers, createCustomer } from "@/services/customers.service";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
} from "@/lib/validation/customer.schema";

export const GET = withAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url);
    const query = listCustomersQuerySchema.parse(
      Object.fromEntries(url.searchParams)
    );
    const result = await listCustomers(ctx, query);
    return NextResponse.json(result);
  },
  { permission: "customers:read" }
);

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    await rateLimit(`create-customer:${ctx.companyId}`, { limit: 60, windowMs: 60_000 });
    const body = await req.json();
    const input = createCustomerSchema.parse(body);
    const customer = await createCustomer(ctx, input);
    return NextResponse.json(customer, { status: 201 });
  },
  { permission: "customers:write" }
);
