import { prisma } from "@/lib/db";
import { SYSTEM_ROLE_DEFAULTS } from "@/lib/permissions";
import { nanoid } from "nanoid";

/**
 * Runs immediately after Better Auth creates a User row for someone who
 * signed up as a Business Owner. Creates the Company, seeds the system
 * roles for that company, and makes this user the Owner — all in one
 * transaction so we never end up with a User that has no Company.
 */
export async function createOwnerCompany(userId: string, userName: string) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: `${userName}'s Company`,
        slug: `${slugify(userName)}-${nanoid(6)}`,
      },
    });

    const roles = await Promise.all(
      Object.entries(SYSTEM_ROLE_DEFAULTS).map(([name, permissions]) =>
        tx.role.create({
          data: {
            companyId: company.id,
            name,
            isSystem: true,
            permissions,
          },
        })
      )
    );

    const ownerRole = roles.find((r) => r.name === "Owner")!;

    await tx.membership.create({
      data: {
        userId,
        companyId: company.id,
        roleId: ownerRole.id,
        status: "ACTIVE",
      },
    });

    return company;
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "company";
}
