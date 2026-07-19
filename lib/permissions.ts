import { ApiError } from "@/lib/api/error-handler";
import type { RequestContext } from "@/types";

export const PERMISSIONS = [
  "customers:read", "customers:write", "customers:delete",
  "leads:read", "leads:write", "leads:delete",
  "jobs:read", "jobs:write", "jobs:delete",
  "scheduling:read", "scheduling:write",
  "estimates:read", "estimates:write",
  "invoices:read", "invoices:write",
  "payments:read", "payments:write",
  "reviews:read", "reviews:manage",
  "reports:read",
  "automation:read", "automation:write",
  "team:read", "team:manage",
  "billing:manage",
  "settings:manage",
  "chat:read", "chat:write", "chat:moderate",
] as const;

export type Permission = (typeof PERMISSIONS)[number] | "*";

// Defaults for the system roles created for every new company. Owners
// get everything; the rest are sane starting points an Owner/Admin can
// edit per-company from Settings → Roles (stored on the Role row, these
// arrays are only the seed values).
export const SYSTEM_ROLE_DEFAULTS: Record<string, Permission[]> = {
  Owner: ["*"],
  Admin: [
    "customers:read", "customers:write", "customers:delete",
    "leads:read", "leads:write", "leads:delete",
    "jobs:read", "jobs:write", "jobs:delete",
    "scheduling:read", "scheduling:write",
    "estimates:read", "estimates:write",
    "invoices:read", "invoices:write",
    "payments:read", "payments:write",
    "reviews:read", "reviews:manage",
    "reports:read",
    "automation:read", "automation:write",
    "team:read", "team:manage",
    "settings:manage",
    "chat:read", "chat:write", "chat:moderate",
  ],
  "Office Manager": [
    "customers:read", "customers:write",
    "leads:read", "leads:write",
    "jobs:read", "jobs:write",
    "scheduling:read", "scheduling:write",
    "estimates:read", "estimates:write",
    "invoices:read", "invoices:write",
    "payments:read",
    "reviews:read", "reviews:manage",
    "reports:read",
    "chat:read", "chat:write",
  ],
  Technician: [
    "jobs:read", "jobs:write",
    "scheduling:read",
    "customers:read",
    "chat:read", "chat:write",
  ],
  "Sales Representative": [
    "leads:read", "leads:write",
    "customers:read", "customers:write",
    "estimates:read", "estimates:write",
    "chat:read", "chat:write",
  ],
};

export function can(ctx: RequestContext, permission: Permission): boolean {
  if (ctx.permissions.includes("*")) return true;
  return ctx.permissions.includes(permission);
}

export function requirePermission(ctx: RequestContext, permission: Permission): void {
  if (!can(ctx, permission)) {
    throw new ApiError(403, `Missing permission: ${permission}`);
  }
}
