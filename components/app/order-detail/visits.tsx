"use client";

import { Flag, MapPin, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { endVisit, startVisit } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatDuration } from "@/lib/i18n";
import { minutesBetween } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

export type VisitItem = { id: number; startedAt: Date; endedAt: Date | null; note: string | null; user: { id: string; name: string; image: string | null } };

export function Visits({
  orderId,
  visits,
  meId,
  canAct,
  legacy,
  scheduledAt,
}: {
  orderId: number;
  visits: VisitItem[];
  meId: string;
  canAct: boolean;
  /** Old arrived/finished pair kept for orders that predate visit history */
  legacy: { arrivedAt: Date | null; finishedAt: Date | null } | null;
  scheduledAt: Date | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const mine = visits.find((v) => v.user.id === meId && !v.endedAt);
  const anyOpen = visits.filter((v) => !v.endedAt);
  const totalMinutes = visits.reduce((sum, v) => sum + (minutesBetween(v.startedAt, v.endedAt) ?? 0), 0);
  const firstArrival = visits.length ? visits[visits.length - 1].startedAt : (legacy?.arrivedAt ?? null);
  const reaction = scheduledAt && firstArrival ? minutesBetween(scheduledAt, firstArrival) : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "შეცდომა");
        return;
      }
      toast.success(okMsg);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-1">
        <CardTitle className="flex items-center gap-2">
          <Timer className="size-4 text-muted-foreground" /> ვიზიტები
          <span className="text-sm font-normal text-muted-foreground">{visits.length}</span>
        </CardTitle>
        {totalMinutes > 0 && <span className="text-xs text-muted-foreground">სულ ობიექტზე: {formatDuration(totalMinutes)}</span>}
      </CardHeader>
      <CardContent className="space-y-3">
        {canAct && (
          <div className="rounded-xl border bg-slate-50/70 p-3 dark:bg-neutral-800/40" aria-live="polite">
            {mine ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-medium">მიმდინარე ვიზიტი</span>
                  <span className="text-muted-foreground">დაწყება {formatDate(mine.startedAt, true)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="შენიშვნა ვიზიტზე (არასავალდებულო)" className="h-9 min-w-[200px] flex-1 bg-white" />
                  <Button size="default" variant="outline" disabled={pending} onClick={() => run(() => endVisit(orderId, note), "ვიზიტი დასრულდა")}>
                    <Flag className="size-4" /> ვიზიტის დასრულება
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">ვიზიტის დასრულება არ ნიშნავს სამუშაოს ჩაბარებას. ჩასაბარებლად გამოიყენეთ „სამუშაო შესრულებულია“.</p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{visits.length ? "შეგიძლიათ ახალი ვიზიტი დაიწყოთ" : "ობიექტზე მისვლისას დააჭირეთ"}</span>
                <Button size="default" disabled={pending} onClick={() => run(() => startVisit(orderId), "ვიზიტი დაიწყო")}>
                  <MapPin className="size-4" /> მივედი ობიექტზე
                </Button>
              </div>
            )}
          </div>
        )}

        {anyOpen.filter((v) => v.user.id !== meId).length > 0 && (
          <p className="text-xs text-[#25815a]">
            ახლა ობიექტზეა: {anyOpen.filter((v) => v.user.id !== meId).map((v) => v.user.name).join(", ")}
          </p>
        )}

        {reaction !== null && <p className="text-xs text-muted-foreground">რეაგირება დაგეგმილ დროსთან: {reaction >= 0 ? formatDuration(reaction) + " დაგვიანება" : formatDuration(-reaction) + " ადრე"}</p>}

        {visits.length === 0 && !legacy?.arrivedAt && <p className="text-sm text-muted-foreground">ვიზიტები ჯერ არ არის.</p>}
        {visits.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visits.map((v) => {
              const mins = minutesBetween(v.startedAt, v.endedAt);
              return (
                <li key={v.id} className={cn("flex items-center gap-3 px-3 py-2 text-sm", !v.endedAt && "bg-emerald-50/60 dark:bg-emerald-950/20")}>
                  <UserAvatar name={v.user.name} image={v.user.image} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{v.user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(v.startedAt, true)} → {v.endedAt ? formatDate(v.endedAt, true) : "მიმდინარეობს"}
                      {v.note ? ` · ${v.note}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-medium">{mins ? formatDuration(mins) : v.endedAt ? "—" : ""}</div>
                </li>
              );
            })}
          </ul>
        )}
        {visits.length === 0 && legacy?.arrivedAt && (
          <p className="text-xs text-muted-foreground">
            ისტორიული ჩანაწერი (შემსრულებელი უცნობია): მისვლა {formatDate(legacy.arrivedAt, true)}
            {legacy.finishedAt ? `, დასრულება ${formatDate(legacy.finishedAt, true)}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
