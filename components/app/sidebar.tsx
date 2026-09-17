"use client";

import { ChevronsLeft, ChevronsRight, LogOut, Plus, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { ROLE_LABELS, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { navFor } from "./nav";

const STORE_KEY = "ln-sidebar-open";

export function NavLinks({
  user,
  inboxCount,
  unseenCount,
  collapsed = false,
  onNavigate,
}: {
  user: SessionUser;
  inboxCount: number;
  unseenCount: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navFor(user.role, { inbox: inboxCount, unseen: unseenCount });
  return (
    <nav className={cn("flex flex-col gap-1", collapsed && "items-center")}>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center transition-colors duration-150",
              collapsed
                ? "size-11 justify-center rounded-[14px]"
                : "gap-2.5 rounded-full px-3 py-2 text-[13px]",
              active ? "bg-[#3457d5] font-medium text-white shadow-[0_6px_16px_rgba(52,87,213,0.35)]" : "text-[#9fb0c0] hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0 [stroke-width:1.7]" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            {item.badge ? (
              <span
                className={cn(
                  "flex items-center justify-center rounded-full text-[10px] font-semibold leading-none text-white",
                  collapsed ? "absolute -right-0.5 -top-0.5 size-[18px] ring-2 ring-[#16293a]" : "px-1.5 py-0.5",
                  "bg-[#d95c4c]",
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

export function SidebarFooter({ user, collapsed = false, onNavigate }: { user: SessionUser; collapsed?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }
  const profileActive = pathname === "/profile";
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 p-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          title={`${user.name} · ${t.nav2.profile}`}
          className={cn("grid size-11 place-items-center rounded-[14px] transition-colors", profileActive ? "bg-white/10" : "hover:bg-white/[0.07]")}
        >
          <UserAvatar name={user.name} image={user.image} size="md" />
          <span className="sr-only">{t.nav2.profile}</span>
        </Link>
        <button
          type="button"
          onClick={logout}
          title={t.nav.logout}
          className="grid size-11 place-items-center rounded-[14px] text-[#9fb0c0] transition-colors hover:bg-white/[0.07] hover:text-[#ffb4a6] focus-visible:outline-2 focus-visible:outline-white/40"
        >
          <LogOut className="size-[18px] [stroke-width:1.7]" />
          <span className="sr-only">{t.nav.logout}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="p-3">
      <Link
        href="/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition-colors",
          profileActive ? "bg-white/10 text-white" : "text-[#9fb0c0] hover:bg-white/[0.07] hover:text-white",
        )}
      >
        <UserCircle className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-white">{user.name}</span>
          <span className="block text-[11px] text-[#8296a8]">
            {ROLE_LABELS[user.role]} · {t.nav2.profile}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={logout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm text-[#9fb0c0] transition-colors hover:bg-white/[0.07] hover:text-[#ffb4a6] focus-visible:outline-2 focus-visible:outline-white/40"
      >
        <LogOut className="size-4 shrink-0" />
        <span className="font-heading font-bold tracking-[-0.005em]">{toMtavruli(t.nav.logout)}</span>
      </button>
    </div>
  );
}

/** Desktop rail: icons only by default, expandable to labels; the choice is remembered per browser. */
export function Sidebar(props: { user: SessionUser; inboxCount: number; unseenCount: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORE_KEY) === "1");
    } catch {
      // private mode or blocked storage: keep the rail
    }
  }, []);
  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }
  return (
    <aside
      className={cn("sticky top-0 hidden h-screen shrink-0 flex-col bg-[#16293a] transition-[width] duration-200 ease-out md:flex", open ? "w-[224px]" : "w-[84px]")}
      aria-label="მთავარი მენიუ"
    >
      <div className={cn("flex h-16 items-center", open ? "gap-2.5 px-4" : "justify-center px-2")}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#3457d5] font-heading text-xs font-bold text-white shadow-[0_6px_16px_rgba(52,87,213,0.28)]">LN</div>
        {open && (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-heading text-[15px] font-semibold text-white">{t.appName}</div>
            <div className="truncate text-[11px] text-[#8296a8]">სერვისის მართვა</div>
          </div>
        )}
      </div>

      <div className={cn("flex pb-2", open ? "justify-end px-4" : "justify-center")}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title={open ? "მენიუს ჩაკეცვა" : "მენიუს გაშლა"}
          className="grid size-8 place-items-center rounded-full text-[#7d90a3] transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-white/40"
        >
          {open ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
          <span className="sr-only">{open ? "მენიუს ჩაკეცვა" : "მენიუს გაშლა"}</span>
        </button>
      </div>

      {props.user.role !== "executor" && (
        <div className={cn("pb-1", open ? "px-3" : "px-2")}>
          <Link
            href="/orders/new"
            title={open ? undefined : t.order.new}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full bg-[#3457d5] font-heading text-[13px] font-bold tracking-[-0.005em] text-white shadow-[0_8px_20px_rgba(52,87,213,0.4)] transition-colors hover:bg-[#2846b7]",
              open ? "h-10 px-4" : "h-11 w-11",
            )}
          >
            <Plus className="size-4 shrink-0" />
            {open ? <span className="truncate">{toMtavruli(t.order.new)}</span> : <span className="sr-only">{t.order.new}</span>}
          </Link>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto pt-2", open ? "px-3" : "px-2")}>
        <NavLinks {...props} collapsed={!open} />
      </div>

      <SidebarFooter user={props.user} collapsed={!open} />
    </aside>
  );
}
