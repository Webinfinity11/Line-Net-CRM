import { Building2, CalendarClock, ChartColumnIncreasing, CirclePlus, ClipboardCheck, ClipboardList, Inbox, LayoutGrid, MapPin, Tags, UsersRound, Wrench, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { t } from "@/lib/i18n";

/** Client-safe twin of `isStaff` in lib/session (which is server-only). */
export const isStaffRole = (role: UserRole) => role === "admin" || role === "manager";

/** `phone: true` marks the four destinations that belong in the thumb bar on a phone. */
export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; phone?: boolean };

export function navFor(role: UserRole, counts: { inbox: number; unseen: number }): NavItem[] {
  if (role === "executor") {
    return [{ href: "/my", label: t.nav.my, icon: ClipboardCheck, badge: counts.unseen, phone: true }];
  }
  if (role === "client") {
    return [
      { href: "/portal", label: t.nav.my, icon: ClipboardList, phone: true },
      { href: "/portal/new", label: t.order.new, icon: CirclePlus, phone: true },
      { href: "/portal/sites", label: "მისამართები", icon: MapPin, phone: true },
    ];
  }
  const items: NavItem[] = [
    { href: "/", label: t.nav.dashboard, icon: LayoutGrid, phone: true },
    { href: "/orders", label: t.nav.orders, icon: ClipboardList, phone: true },
    { href: "/inbox", label: t.nav.inbox, icon: Inbox, badge: counts.inbox, phone: true },
    { href: "/schedule", label: t.nav2.schedule, icon: CalendarClock, phone: true },
    { href: "/maintenance", label: t.nav2.maintenance, icon: Wrench },
    { href: "/clients", label: t.nav.clients, icon: Building2 },
    { href: "/reports", label: t.nav2.reports, icon: ChartColumnIncreasing },
    { href: "/settings/services", label: "სერვისები", icon: Tags },
  ];
  if (role === "admin") {
    items.push({ href: "/settings/users", label: t.nav.users, icon: UsersRound });
  }
  return items;
}

/** The one item to highlight: the longest href the path sits under, so /portal/new does not light up /portal too. */
export function activeHref(items: NavItem[], pathname: string): string | undefined {
  const under = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return items
    .filter((i) => under(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
