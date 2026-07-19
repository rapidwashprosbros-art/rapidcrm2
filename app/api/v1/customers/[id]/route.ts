import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import {
  getCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/services/customers.service";
import { updateCustomerSchema } from "@/lib/validation/customer.schema";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params["params"]>(
  async (_req, ctx, { params }) => {
    const customer = await getCustomer(ctx, params.id);
    return NextResponse.json(customer);
  },
  { permission: "customers:read" }
);

export const PATCH = withAuth<Params["params"]>(
  async (req: NextRequest, ctx, { params }) => {
    const body = await req.json();
    const input = updateCustomerSchema.parse(body);
    const customer = await updateCustomer(ctx, params.id, input);
    return NextResponse.json(customer);
  },
  { permission: "customers:write" }
);

export const DELETE = withAuth<Params["params"]>(
  async (_req, ctx, { params }) => {
    await deleteCustomer(ctx, params.id);
    return new NextResponse(null, { status: 204 });
  },
  { permission: "customers:delete" }
);
