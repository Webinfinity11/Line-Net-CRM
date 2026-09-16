"use client";

import { Camera, Flag, MapPin, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { endVisit, startVisit } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CompleteDialog } from "./order-detail/complete-dialog";

function timeOf(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

function IconAction({ href, label, icon: Icon, external }: { href: string | null; label: string; icon: typeof Phone; external?: boolean }) {
  const cls = cn(
    "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-[#dbe1ec] bg-white px-3 text-[12px] font-medium text-[#566b7d] transition-colors hover:bg-[#f8faff] hover:text-[#17212b]",
    !href && "pointer-events-none opacity-40",
  );
  if (href && href.startsWith("/")) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        <Icon className="size-4 [stroke-width:1.7]" /> <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }
  return (
    <a href={href ?? undefined} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls} aria-label={label} aria-disabled={!href}>
      <Icon className="size-4 [stroke-width:1.7]" /> <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

/**
 * One primary action per state for the technician's list:
 * not on site → "მივედი ობიექტზე"; on site → "სამუშაო შესრულებულია" + "ვიზიტის დასრულება".
 * Call / route / photo are small secondary actions.
 */
export function MyVisitControls({
  orderId,
  status,
  openVisitStartedAt,
  requiredLeft,
  needsPhoto,
  phoneHref,
  mapsHref,
}: {
  orderId: number;
  status: OrderStatus;
  openVisitStartedAt: Date | null;
  requiredLeft: number;
  needsPhoto: boolean;
  phoneHref: string | null;
  mapsHref: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onSite = !!openVisitStartedAt;
  const canComplete = onSite || status === "in_progress";

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
    <div className="mt-3 space-y-2" aria-live="polite">
      {onSite && (
        <div className="flex items-center gap-1.5 text-[12px] text-[#23764f]">
          <span className="size-2 rounded-full bg-[#2b8260]" /> ობიექტზე ხართ {timeOf(openVisitStartedAt)}-დან
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {onSite ? (
          <>
            {canComplete && <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} className="h-11 flex-1" />}
            <Button variant="outline" className="h-11" disabled={pending} onClick={() => run(() => endVisit(orderId), "ვიზიტი დასრულდა")}>
              <Flag className="size-4" /> {pending ? "ინახება..." : "ვიზიტის დასრულება"}
            </Button>
          </>
        ) : (
          <>
            <Button className="h-11 flex-1" disabled={pending} onClick={() => run(() => startVisit(orderId), "ვიზიტი დაიწყო")}>
              <MapPin className="size-4" /> {pending ? "ინახება..." : "მივედი ობიექტზე"}
            </Button>
            {canComplete && <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} className="h-11" />}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <IconAction href={phoneHref} label="დარეკვა" icon={Phone} />
        <IconAction href={mapsHref} label="მარშრუტი" icon={Navigation} external />
        {onSite && <IconAction href={`/orders/${orderId}#attachments`} label="ფოტო" icon={Camera} />}
      </div>
    </div>
  );
}
