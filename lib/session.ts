import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/db/schema";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  image?: string | null;
};

export const getSession = cache(async () => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; phone?: string | null };
  const sessionUser: SessionUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as UserRole) ?? "executor",
    phone: u.phone ?? null,
    image: u.image ?? null,
  };
  return { user: sessionUser, session: s.session };
});

/** Redirects to /login when not signed in; to / when the role is not allowed. */
export async function requireUser(roles?: UserRole[]): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (roles && !roles.includes(s.user.role)) redirect("/");
  return s.user;
}

export const isStaff = (role: UserRole) => role === "admin" || role === "manager";
