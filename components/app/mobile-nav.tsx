"use client";

import Link from "next/link";
import { Archive, CircleCheck, ClipboardList, Play, Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { activeHref, navFor } from "./nav";

const EXECUTOR_TABS = [
  { key: "board", label: "ყველა", icon: ClipboardList },
  { key: "new", label: "დასაწყები", icon: ClipboardList },
  { key: "active", label: "მიმდინარე", icon: Play },
  { key: "done", label: "ჩაბარებული", icon: CircleCheck },
  { key: "closed", label: "დახურული", icon: Archive },
] as const;
type ExecutorCounts = Record<(typeof EXECUTOR_TABS)[number]["key"], number>;

/** Role-specific destinations, always within reach on a phone. */
export function MobileNav({ user, inboxCount, unseenCount, executorCounts }: { user: SessionUser; inboxCount: number; unseenCount: number; executorCounts: ExecutorCounts }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const executor = user.role === "executor";
  const client = user.role === "client";
  const asked = searchParams.getAll("tab");
  const tab = (asked.length === 1 && EXECUTOR_TABS.find((item) => item.key === asked[0])?.key)
    || (executorCounts.active > 0 ? "active" : "new");
  const all = navFor(user.role, { inbox: inboxCount, unseen: unseenCount });
  const items = executor
    ? EXECUTOR_TABS.map((item) => ({ ...item, href: item.key === "board" ? "/my/board" : `/my?tab=${item.key}`, badge: executorCounts[item.key] }))
    : all.filter((i) => i.phone).slice(0, 4);
  if (items.length < 2) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e6ebf2] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
      aria-label="მთავარი მენიუ"
    >
      {items.map((item) => {
        const active = executor
          ? (pathname === "/my/board" ? item.href === "/my/board" : pathname === "/my" && item.href === `/my?tab=${tab}`)
          : item.href === activeHref(all, pathname);
        const create = client && item.href === "/portal/new";
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors", (executor || client) && "min-w-0 py-[4px]", active ? "text-[#3457d5]" : "text-[#617084]")}
          >
            <span className={cn("relative", create && "-mt-[22px] flex size-[44px] shrink-0 items-center justify-center rounded-full bg-[#3457d5] text-white")}>
              {create ? <Plus className="size-[24px]" /> : <Icon className={cn("size-[22px]", active && "[stroke-width:2]")} />}
              {(executor || item.badge) ? (
                <span className={cn("absolute -right-2 -top-1.5 flex items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white", executor ? "h-[16px] min-w-[16px] bg-[#617084] px-[3px]" : "size-[16px] bg-[#b13f32]")}>{item.badge}</span>
              ) : null}
            </span>
            <span className={cn("max-w-full", executor || client ? "whitespace-nowrap" : "truncate")}>{create ? "ახალი" : item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
