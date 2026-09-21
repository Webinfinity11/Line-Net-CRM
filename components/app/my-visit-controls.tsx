"use client";

import { Camera, Navigation, Phone, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { startVisit } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CompleteDialog } from "./order-detail/complete-dialog";

function IconAction({ href, label, icon: Icon, external }: { href: string | null; label: string; icon: typeof Phone; external?: boolean }) {
  const cls = cn(
    "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#dbe1ec] bg-white px-1 text-[11px] md:px-3 md:text-[12px] font-medium text-[#617084] transition-colors hover:bg-[#f8faff] hover:text-[#17212b]",
    !href && "pointer-events-none opacity-40",
  );
  if (href && href.startsWith("/")) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        <Icon className="size-4 [stroke-width:1.7]" /> {label}
      </Link>
    );
  }
  return (
    <a href={href ?? undefined} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls} aria-label={label} aria-disabled={!href}>
      <Icon className="size-4 [stroke-width:1.7]" /> {label}
    </a>
  );
}

/** Opens the visit: the order moves to "in progress" and the time on site starts counting. */
function StartButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      className="h-11 w-full md:w-auto md:flex-none"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startVisit(orderId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("სამუშაო დაიწყო");
          router.push("/my?tab=active");
          router.refresh();
        })
      }
    >
      <Play className="size-4" /> {pending ? "იწყება…" : "დაწყება"}
    </Button>
  );
}

/** Technician actions: the primary button follows the status (start, then hand over), plus call / route / photo. */
export function MyVisitControls({ orderId, status, requiredLeft, needsPhoto, phoneHref, mapsHref }: { orderId: number; status: OrderStatus; requiredLeft: number; needsPhoto: boolean; phoneHref: string | null; mapsHref: string | null }) {
  return (
    <div className="mt-3 grid grid-cols-3 items-center gap-2 md:flex md:flex-wrap">
      <div className="col-span-3 md:contents">
        {status === "in_progress" ? (
          <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} className="h-11 w-full md:w-auto md:flex-none" />
        ) : (
          <StartButton orderId={orderId} />
        )}
      </div>
      <IconAction href={phoneHref} label="დარეკვა" icon={Phone} />
      <IconAction href={mapsHref} label="მარშრუტი" icon={Navigation} external />
      <IconAction href={`/orders/${orderId}#attachments`} label="ფოტო" icon={Camera} />
    </div>
  );
}
