"use client";

import { LogOut, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { ROLE_LABELS, t } from "@/lib/i18n";
import type { SessionUser } from "@/lib/session";
import { NavLinks } from "./sidebar";
import { UserAvatar } from "./user-avatar";

export function Topbar({ user, inboxCount, unseenCount }: { user: SessionUser; inboxCount: number; unseenCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const staff = user.role !== "executor";

  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur dark:bg-neutral-900/90 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="მენიუ" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-4">
          <SheetTitle className="mb-4 text-base">{t.appName}</SheetTitle>
          <NavLinks user={user} inboxCount={inboxCount} unseenCount={unseenCount} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {staff ? (
        <form action="/orders" method="get" className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            placeholder="ძებნა: შეკვეთა, კლიენტი, მისამართი..."
            className="h-9 w-full rounded-lg border bg-neutral-50 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:bg-neutral-800"
          />
        </form>
      ) : (
        <div className="flex-1" />
      )}
      <div className="flex-1 sm:hidden" />

      {staff && (
        <Button render={<Link href="/orders/new" />} size="default" className="bg-sky-600 hover:bg-sky-700">
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t.order.new}</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button className="flex items-center gap-2 rounded-full pl-1 pr-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" />}
        >
          <UserAvatar name={user.name} image={user.image} size="md" />
          <div className="hidden text-left leading-tight md:block">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="size-4" />
            {t.nav.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
