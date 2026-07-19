import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError } from "@/lib/api/error-handler";
import { requirePermission, type Permission } from "@/lib/permissions";
import { withTenantSession } from "@/lib/db-scoped";
import type { RequestContext } from "@/types";

type Handler<TParams = Record<string, string>> = (
  req: NextRequest,
  ctx: RequestContext,
  routeParams: { params: TParams }
) => Promise<NextResponse>;

/**
 * Wrap every /api/v1/** route handler in this. It:
 *   1. Resolves the Better Auth session (401 if none).
 *   2. Loads the caller's active Membership + Role (403 if no company).
 *   3. Builds a RequestContext and runs the handler inside a DB
 *      transaction with `app.company_id` set for Postgres RLS.
 *   4. Optionally enforces a required permission before the handler runs.
 *   5. Normalizes all thrown errors to a consistent JSON shape.
 */
export function withAuth<TParams = Record<string, string>>(
  handler: Handler<TParams>,
  options?: { permission?: Permission }
) {
  return async (req: NextRequest, routeParams: { params: TParams }) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user) {
        throw new ApiError(401, "Not authenticated");
      }

      const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: { role: true },
      });
      if (!membership) {
        throw new ApiError(403, "No active company membership");
      }

      const ctx: RequestContext = {
        userId: session.user.id,
        companyId: membership.companyId,
        membershipId: membership.id,
        roleId: membership.roleId,
        roleName: membership.role.name,
        permissions: membership.role.permissions as Permission[],
      };

      if (options?.permission) {
        requirePermission(ctx, options.permission);
      }

      return await withTenantSession(ctx.companyId, () => handler(req, ctx, routeParams));
    } catch (error) {
      return handleApiError(error);
    }
  };
}
