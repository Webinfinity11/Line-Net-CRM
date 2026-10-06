"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { takeOrder } from "@/actions/requests";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TakeOrderButton({ orderId, label = "ავიღებ", className }: {
  orderId: number;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        const res = await takeOrder(orderId);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success("დავალება აიღეთ");
        router.push("/my?tab=new");
        router.refresh();
      } catch {
        const message = "დავალების აღება ვერ დადასტურდა. შეამოწმეთ კავშირი და განაახლეთ სია ხელახლა ცდამდე.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return <div className="space-y-2">
    <Button type="button" className={cn("h-11 whitespace-nowrap", className)} disabled={pending} onClick={run}>{pending ? "მიმდინარეობს…" : label}</Button>
    {error && <p role="alert" className="text-[13px] leading-5 text-[#b13f32] dark:text-[var(--ln-alert)]">{error}</p>}
  </div>;
}
