"use client";

import { LogOut, Menu, Search, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { ROLE_LABELS, t } from "@/lib/i18n";
import type { SessionUser } from "@/lib/session";
import { isStaffRole } from "./nav";
import { NotificationBell, type BellItem } from "./notification-bell";
import { NavLinks, SidebarFooter } from "./sidebar";
import { ThemeMenu } from "./theme-menu";
import { UserAvatar } from "./user-avatar";

export function Topbar({
  user,
  inboxCount,
  unseenCount,
  unread,
  bellItems,
}: {
  user: SessionUser;
  inboxCount: number;
  unseenCount: number;
  unread: number;
  bellItems: BellItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staff = isStaffRole(user.role);

  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-background/90 px-4 backdrop-blur md:px-6">
      {staff && <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="max-md:size-11 md:hidden" aria-label="მენიუ" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[288px] max-w-full overflow-y-auto bg-[#16293a] p-4 text-white">
          <SheetTitle className="mb-4 shrink-0 pr-8 text-base text-white">{t.appName}</SheetTitle>
          <NavLinks user={user} inboxCount={inboxCount} unseenCount={unseenCount} onNavigate={() => setOpen(false)} />
          <div className="mt-4 shrink-0">
            <SidebarFooter user={user} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>}

      {staff && pathname !== "/orders" ? (
        <form action="/orders" method="get" className="relative hidden w-full max-w-[520px] sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            placeholder="ძებნა: შეკვეთა, კლიენტი, მისამართი…"
            className="h-10 w-full rounded-full border border-transparent bg-card pl-10 pr-4 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-[#a5cdd1] dark:focus:border-primary focus:shadow-[0_2px_8px_rgba(57,123,131,0.1)] focus:ring-2 focus:ring-primary/15"
          />
        </form>
      ) : (
        <div className="flex-1" />
      )}
      {/* the bell's trigger lives in notification-bell.tsx; 44px on phones from here */}
      <div className="ml-auto flex items-center gap-2 max-md:[&>[data-slot=button]]:size-11">
      <NotificationBell unread={unread} items={bellItems} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button aria-label="პროფილის მენიუ" className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors max-md:min-h-11 max-md:min-w-11 max-md:justify-center max-md:pr-1 hover:bg-[#f6fafb] dark:hover:bg-muted" />}
        >
          <UserAvatar name={user.name} image={user.image} size="md" />
          <div className="hidden text-left leading-tight md:block">
            <div className="max-w-[200px] truncate text-sm font-medium">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <UserCircle className="size-4" />
              {t.nav2.profile}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4" />
              {t.nav.logout}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <ThemeMenu />
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
