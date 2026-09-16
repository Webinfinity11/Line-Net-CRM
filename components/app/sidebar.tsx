"use client";

import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/session";
import { ROLE_LABELS, t } from "@/lib/i18n";
import { navFor } from "./nav";

export function NavLinks({
  user,
  inboxCount,
  unseenCount,
  onNavigate,
}: {
  user: SessionUser;
  inboxCount: number;
  unseenCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navFor(user.role, { inbox: inboxCount, unseen: unseenCount });
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-150",
              active
                ? "bg-[#eef2ff] font-medium text-[#3457d5] shadow-[inset_3px_0_0_#3457d5] dark:bg-blue-950/40 dark:text-blue-200"
                : "text-[#4a5a6c] hover:bg-[#f3f6fb] hover:text-[#17212b] dark:text-neutral-300 dark:hover:bg-neutral-800",
            )}
          >
            <Icon className="size-4 shrink-0 [stroke-width:1.7]" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                  active ? "bg-[#3457d5] text-white" : "bg-[#d95c4c] text-white",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarFooter({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="border-t p-3">
      <Link
        href="/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          pathname === "/profile" ? "bg-[#eef2ff] text-[#3457d5]" : "text-[#4a5a6c] hover:bg-[#f3f6fb] hover:text-[#17212b]",
        )}
      >
        <UserCircle className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{user.name}</span>
          <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]} · {t.nav2.profile}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={logout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#4a5a6c] transition-colors hover:bg-[#fff1ed] hover:text-[#a73b2d] focus-visible:outline-2 focus-visible:outline-[#3457d5]"
      >
        <LogOut className="size-4 shrink-0" />
        <span className="font-heading uppercase tracking-wide">{t.nav.logout}</span>
      </button>
    </div>
  );
}

export function Sidebar(props: { user: SessionUser; inboxCount: number; unseenCount: number }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 flex-col border-r border-[#e6ebf2] bg-white dark:bg-neutral-900 md:flex">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#3457d5] font-heading text-xs font-bold text-white shadow-[0_3px_7px_rgba(52,87,213,0.14)]">LN</div>
        <div className="leading-tight">
          <div className="font-heading text-[15px] font-semibold text-foreground">{t.appName}</div>
          <div className="whitespace-nowrap text-[11px] text-muted-foreground">სერვისის მართვა</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <NavLinks {...props} />
      </div>
      <SidebarFooter user={props.user} />
    </aside>
  );
}
