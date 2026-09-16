"use client";

import { Flag, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { endVisit, startVisit } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n";
import { CompleteDialog } from "./order-detail/complete-dialog";

/** Compact visit + completion controls for the technician's list. */
export function MyVisitControls({ orderId, openVisitStartedAt, requiredLeft, needsPhoto }: { orderId: number; openVisitStartedAt: Date | null; requiredLeft: number; needsPhoto: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "შეცდომა");
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {openVisitStartedAt ? (
        <>
          <span className="flex items-center gap-1.5 text-xs text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-500" /> ობიექტზე ხართ {formatDate(openVisitStartedAt, true)}-დან
          </span>
          <Button size="default" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => endVisit(orderId), "ვიზიტი დასრულდა")}>
            <Flag className="size-4" /> {pending ? "ინახება..." : "ვიზიტის დასრულება"}
          </Button>
        </>
      ) : (
        <Button size="default" className="h-11 flex-1 sm:flex-none" disabled={pending} onClick={() => run(() => startVisit(orderId), "ვიზიტი დაიწყო")}>
          <MapPin className="size-4" /> {pending ? "ინახება..." : "მივედი ობიექტზე"}
        </Button>
      )}
      <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} className="h-11 bg-emerald-600 hover:bg-emerald-700" />
    </div>
  );
}
