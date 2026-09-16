"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BellItem = { id: number; title: string; body: string | null; readAt: Date | null; createdAt: Date; orderId: number | null };

export function NotificationBell({ unread, items }: { unread: number; items: BellItem[] }) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="შეტყობინებები" />}>
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>შეტყობინებები</span>
          {unread > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-normal text-blue-600 hover:underline"
              onClick={() =>
                start(async () => {
                  await markAllNotificationsRead();
                  router.refresh();
                })
              }
            >
              <CheckCheck className="size-3" /> ყველა წაკითხულია
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && <div className="px-2 py-4 text-center text-sm text-muted-foreground">შეტყობინებები არ არის</div>}
        <div className="max-h-96 overflow-y-auto">
          {items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn("flex flex-col items-start gap-0.5 whitespace-normal", !n.readAt && "bg-blue-50 dark:bg-blue-950/30")}
              onClick={() => {
                start(async () => {
                  if (!n.readAt) await markNotificationRead(n.id);
                  if (n.orderId) router.push(`/orders/${n.orderId}`);
                  router.refresh();
                });
              }}
            >
              <span className="text-sm font-medium leading-snug">{n.title}</span>
              {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-[11px] text-muted-foreground">{formatDate(n.createdAt, true)}</span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/notifications" />} className="justify-center text-sm text-blue-600">
          ყველას ნახვა
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
