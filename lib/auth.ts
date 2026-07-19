import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/services/email.service";
import { createOwnerCompany } from "@/services/onboarding.service";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Rapid CRM password",
        template: "password-reset",
        data: { name: user.name, url },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email — Rapid CRM",
        template: "verify-email",
        data: { name: user.name, url },
      });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once/day of activity
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  // "Remember me" maps to whether a persistent vs. session cookie is
  // issued; enforced client-side at sign-in (see lib/auth-client.ts).

  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          // Only auto-provision a company when the signup form marked
          // this user as a Business Owner. Team members join via
          // /invite/[token] instead (see app/api/v1/invitations/[token]/accept).
          const accountType = ctx?.body?.accountType as string | undefined;
          if (accountType === "owner") {
            await createOwnerCompany(user.id, user.name);
          }
        },
      },
    },
  },

  advanced: {
    generateId: false, // let Prisma's cuid() defaults handle IDs
  },
});

export type Auth = typeof auth;
