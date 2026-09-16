import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

const microsoftEnabled = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);

const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: baseURL ? [baseURL] : undefined,
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders: microsoftEnabled
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          prompt: "select_account",
        },
      }
    : undefined,
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      defaultRole: "executor",
      adminRoles: ["admin"],
    }),
    nextCookies(),
  ],
});

export const isMicrosoftLoginEnabled = microsoftEnabled;
export type Session = typeof auth.$Infer.Session;
