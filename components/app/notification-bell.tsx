"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { NewTaskAlert } from "@/components/app/new-task-alert";
import { KeepNumbers } from "@/components/app/keep-numbers";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BellItem = { id: number; type: string; title: string; body: string | null; readAt: Date | null; createdAt: Date; orderId: number | null; href: string | null };

/** On the same order page push only changes the hash, which does not scroll, so bring the chat into view. */
function openHref(router: ReturnType<typeof useRouter>, href: string) {
  const samePage = href.split("#")[0] === window.location.pathname;
  router.push(href);
  if (samePage && href.endsWith("#comments")) window.setTimeout(() => document.getElementById("comments")?.scrollIntoView({ block: "start" }), 50);
}

export function NotificationBell({ unread, items }: { unread: number; items: BellItem[] }) {
  const router = useRouter();
  const [, start] = useTransition();

  const [unreadCount, setUnreadCount] = useState(unread);
  const [bellItems, setBellItems] = useState(items);
  const [alerts, setAlerts] = useState<BellItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const enableNotifications = useRef<(() => void) | null>(null);
  const cursor = useRef(Math.max(0, ...items.map(n => n.id)));

  useEffect(() => {
    setUnreadCount(unread);
    setBellItems(items);
    setAlerts(previous => previous.filter(alert => !items.some(n => n.id === alert.id && n.readAt)));
  }, [unread, items]);

  useEffect(() => {
    let disposed = false;
    let polling = false;
    const controller = new AbortController();
    const supported = "Notification" in window;
    const updatePermission = () => {
      if (supported) setPermission(Notification.permission);
    };
    updatePermission();
    enableNotifications.current = () => {
      if (supported) void Notification.requestPermission().then(value => {
        if (!disposed) setPermission(value);
      }).catch(() => {});
    };
    const poll = async () => {
      if (document.visibilityState !== "visible" || polling) return;
      updatePermission();
      polling = true;
      try {
        const response = await fetch(`/api/notifications?since=${cursor.current}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok || response.redirected) return;
        const data: { items: (Omit<BellItem, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null })[]; unread: number; nextSince: number } = await response.json();
        if (disposed) return;
        const fresh = data.items.map(n => ({ ...n, createdAt: new Date(n.createdAt), readAt: n.readAt ? new Date(n.readAt) : null }));
        setUnreadCount(data.unread);
        if (fresh.length) setBellItems(previous => [...fresh, ...previous.filter(n => !fresh.some(f => f.id === n.id))].sort((a, b) => b.id - a.id).slice(0, 8));
        // Initial server items establish the cursor; only later arrivals alert.
        const tasks = fresh.filter(n => !n.readAt && (n.type === "assigned" || n.type === "taken"));
        if (tasks.length) setAlerts(previous => [...previous, ...tasks.filter(n => !previous.some(a => a.id === n.id))]);
        for (const n of fresh) {
          if (!supported || Notification.permission !== "granted") continue;
          try {
            const notice = new Notification(n.title, { body: n.body ?? undefined, tag: n.type === "comment" && n.orderId ? `comment-${n.orderId}` : String(n.id) });
            notice.onclick = () => {
              window.focus();
              openHref(router, n.href ?? "/notifications");
              notice.close();
            };
          } catch { /* Some mobile browsers require a service worker; the bell still updates. */ }
        }
        cursor.current = data.nextSince;
      } catch { /* Retry on the next tick after a network failure. */ }
      finally { polling = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    const onVisibility = () => { void poll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      enableNotifications.current = null;
    };
  }, [router]);

  function dismissAlert(id: number) {
    setAlerts(previous => previous.filter(n => n.id !== id));
  }

  async function readItem(n: BellItem) {
    dismissAlert(n.id);
    if (!n.readAt) {
      const result = await markNotificationRead(n.id);
      if (result.ok) {
        setBellItems(previous => previous.map(item => item.id === n.id ? { ...item, readAt: new Date() } : item));
        setUnreadCount(previous => Math.max(0, previous - 1));
      }
    }
  }

  return (
    <>
    <NewTaskAlert items={alerts} onDismiss={dismissAlert} onDismissAll={() => setAlerts([])} onOpen={id => {
      const item = alerts.find(n => n.id === id);
      if (item) start(async () => { await readItem(item); router.refresh(); });
    }} />
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="შეტყობინებები" />}>
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b13f32] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px] max-w-[calc(100vw-24px)] rounded-2xl p-2">
        <DropdownMenuGroup>
        <DropdownMenuLabel className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
          <span>შეტყობინებები</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#3457d5] hover:bg-[#eef2ff] focus-visible:outline-2 focus-visible:outline-[#3457d5]"
              onClick={() =>
                start(async () => {
                  const result = await markAllNotificationsRead();
                  if (result.ok) {
                    setUnreadCount(0);
                    setAlerts([]);
                    setBellItems(previous => previous.map(n => ({ ...n, readAt: new Date() })));
                  }
                  router.refresh();
                })
              }
            >
              <CheckCheck className="size-3" /> წაკითხულად მონიშვნა
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {permission === "default" && (
          <DropdownMenuItem className="min-h-11 rounded-lg px-3 py-2 text-xs text-[#3457d5]" onClick={() => enableNotifications.current?.()}>
            ბრაუზერის შეტყობინებების ჩართვა
          </DropdownMenuItem>
        )}
        {permission === "denied" && (
          <p className="px-2 py-2 text-xs text-muted-foreground">შეტყობინებები დაბლოკილია. ჩართეთ ბრაუზერის პარამეტრებში, ამ საიტის ნებართვებში.</p>
        )}
        {bellItems.length === 0 && <div className="px-2 py-4 text-center text-sm text-muted-foreground">შეტყობინებები არ არის</div>}
        <div className="max-h-[min(384px,55dvh)] space-y-2 overflow-y-auto overscroll-contain py-2">
          {bellItems.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn("flex flex-col items-start gap-1.5 rounded-xl px-3 py-3 whitespace-normal", !n.readAt && "bg-[#eef2ff] dark:bg-blue-950/30")}
              onClick={() => {
                start(async () => {
                  await readItem(n);
                  openHref(router, n.href ?? "/notifications");
                  router.refresh();
                });
              }}
            >
              <span className="text-[13px] font-semibold leading-5"><KeepNumbers text={n.title} /></span>
              {n.body && <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{n.body}</span>}
              <span className="pt-0.5 text-[11px] leading-4 text-muted-foreground">{formatDate(n.createdAt, true)}</span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/notifications" />} className="min-h-11 justify-center rounded-xl text-sm font-medium text-[#3457d5]">
          ყველას ნახვა
        </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
