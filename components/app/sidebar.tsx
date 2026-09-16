"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                  active ? "bg-blue-600 text-white" : "bg-rose-500 text-white",
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

export function Sidebar(props: { user: SessionUser; inboxCount: number; unseenCount: number }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-white dark:bg-neutral-900 md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 font-heading text-sm font-bold text-white shadow-sm shadow-blue-500/30">LN</div>
        <div className="leading-tight">
          <div className="font-heading text-[15px] font-bold text-blue-700">{t.appName}</div>
          <div className="whitespace-nowrap text-[11px] text-muted-foreground">სერვისის მართვა</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks {...props} />
      </div>
      <div className="border-t p-4 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{props.user.name}</div>
        <div>{ROLE_LABELS[props.user.role]}</div>
      </div>
    </aside>
  );
}
