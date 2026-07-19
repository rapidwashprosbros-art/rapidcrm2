import type { Permission } from "@/lib/permissions";

/** Resolved on every authenticated request by lib/api/with-auth.ts.
 *  A route handler physically cannot run without this being populated —
 *  there is no code path that reaches business logic with a missing
 *  companyId. */
export interface RequestContext {
  userId: string;
  companyId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}
