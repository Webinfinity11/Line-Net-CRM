"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setPaymentStatus } from "@/actions/orders";
import type { PaymentStatus } from "@/db/schema";
import { PAYMENT_COLORS, PAYMENT_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PaymentSelect({ orderId, value }: { orderId: number; value: PaymentStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value as PaymentStatus;
        start(async () => {
          const res = await setPaymentStatus(orderId, v);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        });
      }}
      className={cn("h-7 cursor-pointer rounded-md border-0 px-2 text-xs font-medium outline-none", PAYMENT_COLORS[value])}
    >
      {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
