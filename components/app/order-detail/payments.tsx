"use client";

import { AlertTriangle, Plus, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { addPayment, confirmPaymentReview, deletePayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PaymentStatus } from "@/db/schema";
import { PAYMENT_METHODS, balance } from "@/lib/finance";
import { PAYMENT_LABELS, formatDate, formatMoney } from "@/lib/i18n";
import { PaymentBadge } from "../badges";

export type PaymentItem = { id: number; amount: string; paidAt: Date; method: string; note: string | null; createdBy: string | null; creator: { id: string; name: string } | null };

export function Payments({
  orderId,
  amount,
  paidTotal,
  paymentStatus,
  reviewNeeded,
  payments,
  meId,
  isAdmin,
  disabled,
}: {
  orderId: number;
  amount: string | null;
  paidTotal: string;
  paymentStatus: PaymentStatus;
  reviewNeeded: boolean;
  payments: PaymentItem[];
  meId: string;
  isAdmin: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const remaining = balance(amount, paidTotal);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return; // ignore a second submit before the first one settles
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await addPayment(orderId, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("გადახდა დაფიქსირდა");
        formRef.current?.reset();
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-1">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" /> ფინანსები
        </CardTitle>
        <PaymentBadge status={paymentStatus} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[#f8faff] p-2 dark:bg-neutral-800">
            <div className="text-[11px] text-muted-foreground">თანხა</div>
            <div className="font-heading text-sm font-bold">{formatMoney(amount)}</div>
          </div>
          <div className="rounded-lg bg-[#eaf6ef] p-2 dark:bg-emerald-950/30">
            <div className="text-[11px] text-[#25815a]">მიღებული</div>
            <div className="font-heading text-sm font-bold text-[#25815a]">{formatMoney(paidTotal)}</div>
          </div>
          <div className={remaining > 0 ? "rounded-lg bg-[#faeeee] p-2 dark:bg-rose-950/30" : "rounded-lg bg-[#f8faff] p-2 dark:bg-neutral-800"}>
            <div className={remaining > 0 ? "text-[11px] text-[#b13f32]" : "text-[11px] text-muted-foreground"}>ნაშთი</div>
            <div className={remaining > 0 ? "font-heading text-sm font-bold text-[#b13f32]" : "font-heading text-sm font-bold"}>{amount ? formatMoney(remaining) : "—"}</div>
          </div>
        </div>

        {reviewNeeded && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f0d9a8] bg-[#fff4df] p-2.5 text-xs text-[#96610b] dark:bg-amber-950/30" role="alert">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">
              ძველი სისტემიდან სტატუსი „{PAYMENT_LABELS.partial}“ გადმოვიდა, მაგრამ მიღებული თანხა უცნობია. ჩაწერეთ რეალური გადახდები, ან დაადასტურეთ, რომ არაფერია მიღებული.
            </span>
            <Button
              size="xs"
              className="min-h-11 md:min-h-0"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await confirmPaymentReview(orderId);
                  if (!res.ok) toast.error(res.error);
                  router.refresh();
                })
              }
            >
              დაზუსტებულია
            </Button>
          </div>
        )}

        {payments.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {formatMoney(p.amount)} <span className="text-xs font-normal text-muted-foreground">· {PAYMENT_METHODS[p.method] ?? p.method}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatDate(p.paidAt)}
                    {p.creator ? ` · ${p.creator.name}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                {(isAdmin || p.createdBy === meId) && !disabled && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-11 md:size-7"
                    aria-label={`გადახდის წაშლა ${formatMoney(p.amount)}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await deletePayment(p.id);
                        if (!res.ok) toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!disabled && (
          <form ref={formRef} onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input name="amount" type="number" step="0.01" min="0.01" required placeholder="თანხა ₾" aria-label="თანხა" className="h-11 text-[16px] sm:h-9 sm:text-[13px]" defaultValue={remaining > 0 ? remaining.toFixed(2) : ""} />
            <Input name="paidAt" type="date" defaultValue={today} aria-label="გადახდის თარიღი" className="h-11 text-[16px] sm:h-9 sm:text-[13px]" />
            <NativeSelect name="method" defaultValue="transfer" aria-label="მეთოდი" className="h-11 text-[16px] sm:h-9 sm:text-[13px] max-md:w-full max-md:min-w-0 max-md:[&_select]:h-11 max-md:[&_select]:text-[16px]">
              {Object.entries(PAYMENT_METHODS)
                .filter(([k]) => k !== "migration")
                .map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
            <Button type="submit" size="default" variant="outline" className="col-span-2 h-11 sm:col-span-1 sm:h-9" disabled={pending}>
              <Plus className="size-4" /> გადახდა
            </Button>
            <Input name="note" placeholder="შენიშვნა (მაგ. ინვოისის №)" aria-label="შენიშვნა" className="col-span-2 sm:col-span-4 h-11 text-[16px] sm:h-9 sm:text-[13px]" />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
