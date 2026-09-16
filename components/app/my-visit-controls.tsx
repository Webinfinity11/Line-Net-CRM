"use client";

import { Camera, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CompleteDialog } from "./order-detail/complete-dialog";

function IconAction({ href, label, icon: Icon, external }: { href: string | null; label: string; icon: typeof Phone; external?: boolean }) {
  const cls = cn(
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#dbe1ec] bg-white px-3 text-[12px] font-medium text-[#566b7d] transition-colors hover:bg-[#f8faff] hover:text-[#17212b]",
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

/** Technician actions: one primary "სამუშაო შესრულებულია", plus call / route / photo. */
export function MyVisitControls({ orderId, requiredLeft, needsPhoto, phoneHref, mapsHref }: { orderId: number; status: OrderStatus; requiredLeft: number; needsPhoto: boolean; phoneHref: string | null; mapsHref: string | null }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} className="h-11 flex-1 sm:flex-none" />
      <IconAction href={phoneHref} label="დარეკვა" icon={Phone} />
      <IconAction href={mapsHref} label="მარშრუტი" icon={Navigation} external />
      <IconAction href={`/orders/${orderId}#attachments`} label="ფოტო" icon={Camera} />
    </div>
  );
}
