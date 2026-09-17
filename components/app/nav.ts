import { BarChart3, Building2, CalendarDays, CalendarSync, ClipboardCheck, ClipboardList, Inbox, LayoutDashboard, ReceiptText, Users, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { t } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

export function navFor(role: UserRole, counts: { inbox: number; unseen: number }): NavItem[] {
  if (role === "executor") {
    return [{ href: "/my", label: t.nav.my, icon: ClipboardList, badge: counts.unseen }];
  }
  const items: NavItem[] = [
    { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/orders", label: t.nav.orders, icon: ClipboardList },
    { href: "/inbox", label: t.nav.inbox, icon: Inbox, badge: counts.inbox },
    { href: "/schedule", label: t.nav2.schedule, icon: CalendarDays },
    { href: "/maintenance", label: t.nav2.maintenance, icon: CalendarSync },
    { href: "/clients", label: t.nav.clients, icon: Building2 },
    { href: "/reports", label: t.nav2.reports, icon: BarChart3 },
    { href: "/settings/checklists", label: t.nav2.checklists, icon: ClipboardCheck },
    { href: "/settings/services", label: "სერვისები", icon: ReceiptText },
  ];
  if (role === "admin") items.push({ href: "/settings/users", label: t.nav.users, icon: Users });
  return items;
}
