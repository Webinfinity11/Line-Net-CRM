"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { navFor } from "./nav";

/**
 * Phone navigation. Field research is consistent on this: the actions a technician or
 * manager reaches for must sit in the thumb zone, not behind a menu at the top.
 * Shows the first four destinations for the role; everything else stays in the top sheet.
 */
export function MobileNav({ user, inboxCount, unseenCount }: { user: SessionUser; inboxCount: number; unseenCount: number }) {
  const pathname = usePathname();
  const all = navFor(user.role, { inbox: inboxCount, unseen: unseenCount });
  const items = all.filter((i) => i.phone).slice(0, 4);
  if (items.length < 2) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e6ebf2] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
      aria-label="მთავარი მენიუ"
    >
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors", active ? "text-[#3457d5]" : "text-[#7d8b9a]")}
          >
            <span className="relative">
              <Icon className={cn("size-[22px]", active && "[stroke-width:2]")} />
              {item.badge ? (
                <span className="absolute -right-2 -top-1.5 flex size-[16px] items-center justify-center rounded-full bg-[#d95c4c] text-[9px] font-semibold text-white ring-2 ring-white">{item.badge}</span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
