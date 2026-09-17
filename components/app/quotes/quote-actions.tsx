"use client";

import { ArrowRight, Check, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { convertQuoteToOrder, setQuoteStatus } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@/db/schema";

/** One decision at a time: what the offer's state actually allows. */
export function QuoteActions({ id, status, hasOrder }: { id: number; status: QuoteStatus; hasOrder: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "შეცდომა");
          return;
        }
        toast.success(okMsg);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  function convert() {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        const res = await convertQuoteToOrder(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("შეკვეთა შეიქმნა");
        router.push(`/orders/${res.data?.orderId}`);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  if (status === "draft") {
    return (
      <Button size="sm" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "sent"), "მონიშნულია გაგზავნილად")}>
        <Send className="size-3.5" /> გაგზავნილად მონიშვნა
      </Button>
    );
  }

  if (status === "sent") {
    return (
      <>
        <Button size="sm" variant="success" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "accepted"), "მიღებულია")}>
          <Check className="size-3.5" /> მიღებულია
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "declined"), "უარყოფილია")}>
          <X className="size-3.5" /> უარყოფილია
        </Button>
      </>
    );
  }

  if (status === "accepted" && !hasOrder) {
    return (
      <Button size="sm" disabled={pending} onClick={convert}>
        <ArrowRight className="size-3.5" /> შეკვეთის შექმნა
      </Button>
    );
  }

  return null;
}
