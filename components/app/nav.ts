import { BarChart3, Building2, CalendarDays, CalendarSync, ClipboardList, FileText, Inbox, LayoutDashboard, Layers, ReceiptText, Users, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { t } from "@/lib/i18n";

/** `phone: true` marks the four destinations that belong in the thumb bar on a phone. */
export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; phone?: boolean };

export function navFor(role: UserRole, counts: { inbox: number; unseen: number }): NavItem[] {
  if (role === "executor") {
    return [{ href: "/my", label: t.nav.my, icon: ClipboardList, badge: counts.unseen, phone: true }];
  }
  const items: NavItem[] = [
    { href: "/", label: t.nav.dashboard, icon: LayoutDashboard, phone: true },
    { href: "/orders", label: t.nav.orders, icon: ClipboardList, phone: true },
    { href: "/quotes", label: "შეთავაზებები", icon: FileText },
    { href: "/inbox", label: t.nav.inbox, icon: Inbox, badge: counts.inbox, phone: true },
    { href: "/schedule", label: t.nav2.schedule, icon: CalendarDays, phone: true },
    { href: "/maintenance", label: t.nav2.maintenance, icon: CalendarSync },
    { href: "/clients", label: t.nav.clients, icon: Building2 },
    { href: "/reports", label: t.nav2.reports, icon: BarChart3 },
    { href: "/settings/services", label: "სერვისები", icon: ReceiptText },
  ];
  if (role === "admin") {
    items.push({ href: "/settings/systems", label: "სისტემები", icon: Layers });
    items.push({ href: "/settings/users", label: t.nav.users, icon: Users });
  }
  return items;
}
