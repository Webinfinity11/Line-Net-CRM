"use client";

import { Check, Play, RotateCcw, XCircle, Lock, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import type { OrderStatus, UserRole } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/i18n";

type Action = { to: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }>; primary?: boolean; variant?: "outline" | "destructive" };

function actionsFor(status: OrderStatus, role: UserRole): Action[] {
  const staff = role !== "executor";
  const start: Action = { to: "in_progress", label: "დაწყება", icon: Play, primary: true };
  const done: Action = { to: "done", label: "შესრულებულია", icon: Check, primary: true };
  const reopen: Action = { to: "in_progress", label: "დაბრუნება მიმდინარეში", icon: RotateCcw, variant: "outline" };
  const close: Action = { to: "closed", label: "დახურვა", icon: Lock, primary: true };
  const cancel: Action = { to: "cancelled", label: "გაუქმება", icon: XCircle, variant: "destructive" };
  const toAssigned: Action = { to: "assigned", label: STATUS_LABELS.assigned, icon: UserPlus, variant: "outline" };

  switch (status) {
    case "new":
      return staff ? [toAssigned, start, cancel] : [];
    case "assigned":
      return staff ? [start, done, cancel] : [start, done];
    case "in_progress":
      return staff ? [done, cancel] : [done];
    case "done":
      return staff ? [close, reopen] : [reopen];
    case "closed":
      return staff ? [reopen] : [];
    case "cancelled":
      return staff ? [{ to: "new", label: "აღდგენა", icon: RotateCcw, variant: "outline" }] : [];
  }
}

export function StatusActions({ orderId, status, role }: { orderId: number; status: OrderStatus; role: UserRole }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const actions = actionsFor(status, role);
  if (actions.length === 0) return null;

  function run(to: OrderStatus) {
    start(async () => {
      const res = await setStatus(orderId, to);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`სტატუსი: ${STATUS_LABELS[to]}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 dark:bg-neutral-900">
      <span className="mr-1 text-sm text-muted-foreground">მოქმედება:</span>
      {actions.map((a) => (
        <Button
          key={a.to + a.label}
          size="sm"
          disabled={pending}
          variant={a.variant ?? "default"}
          className={a.primary ? "bg-sky-600 hover:bg-sky-700" : undefined}
          onClick={() => run(a.to)}
        >
          <a.icon className="size-3.5" /> {a.label}
        </Button>
      ))}
    </div>
  );
}
