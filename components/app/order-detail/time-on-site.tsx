"use client";

import { Flag, MapPin, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { markArrived, markFinished } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/lib/i18n";
import { minutesBetween } from "@/lib/order-utils";

export function TimeOnSite({
  orderId,
  scheduledAt,
  createdAt,
  arrivedAt,
  finishedAt,
  canAct,
}: {
  orderId: number;
  scheduledAt: Date | null;
  createdAt: Date;
  arrivedAt: Date | null;
  finishedAt: Date | null;
  canAct: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onSite = minutesBetween(arrivedAt, finishedAt);
  const reaction = minutesBetween(scheduledAt ?? createdAt, arrivedAt);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "შეცდომა");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
          <div className="text-[11px] text-muted-foreground">მისვლა</div>
          <div className="font-medium">{arrivedAt ? formatDate(arrivedAt, true) : "—"}</div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
          <div className="text-[11px] text-muted-foreground">დასრულება</div>
          <div className="font-medium">{finishedAt ? formatDate(finishedAt, true) : "—"}</div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
          <div className="text-[11px] text-muted-foreground">ობიექტზე</div>
          <div className="font-medium">{onSite ? formatDuration(onSite) : "—"}</div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
          <div className="text-[11px] text-muted-foreground">რეაგირება</div>
          <div className="font-medium">{reaction ? formatDuration(reaction) : "—"}</div>
        </div>
      </div>
      {canAct && (
        <div className="flex gap-2">
          {(!arrivedAt || finishedAt) && (
            <Button size="sm" className="flex-1" disabled={pending} onClick={() => run(() => markArrived(orderId))}>
              <MapPin className="size-3.5" /> მივედი ობიექტზე
            </Button>
          )}
          {arrivedAt && !finishedAt && (
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={pending} onClick={() => run(() => markFinished(orderId))}>
              <Flag className="size-3.5" /> დავასრულე
            </Button>
          )}
          {arrivedAt && !finishedAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="size-3.5" /> მიმდინარეობს
            </span>
          )}
        </div>
      )}
    </div>
  );
}
