"use client";

import { Lock, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import type { OrderStatus, UserRole } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/i18n";
import { ConfirmButton } from "../confirm-button";
import { CompleteDialog } from "./complete-dialog";

/**
 * Primary flow buttons. Executors complete via the dialog (visit start lives in the Visits block).
 * Staff verify & close after completion, cancel, or (admin) reopen a closed order.
 */
export function StatusActions({
  orderId,
  status,
  role,
  isAssignee,
  requiredLeft,
  needsPhoto,
}: {
  orderId: number;
  status: OrderStatus;
  role: UserRole;
  isAssignee: boolean;
  requiredLeft: number;
  needsPhoto: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const staff = role !== "executor";

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

  const canComplete = (staff || isAssignee) && (status === "assigned" || status === "in_progress");
  const next =
    status === "new"
      ? "შემდეგი ნაბიჯი: შემსრულებლის დანიშვნა"
      : status === "assigned"
        ? "შემდეგი ნაბიჯი: შემსრულებელი მიდის ობიექტზე („მივედი“) და ასრულებს სამუშაოს"
        : status === "in_progress"
          ? "შემდეგი ნაბიჯი: სამუშაოს ჩაბარება ჩეკ-ლისტით და აღწერით"
          : status === "done"
            ? "შემდეგი ნაბიჯი: მენეჯერი ამოწმებს და ხურავს შეკვეთას"
            : status === "closed"
              ? "შეკვეთა დახურულია. ცვლილება მხოლოდ ადმინს შეუძლია"
              : "შეკვეთა გაუქმებულია";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 dark:bg-neutral-900" aria-live="polite">
      <span className="mr-auto text-sm text-muted-foreground">{next}</span>
      {canComplete && <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} needsPhoto={needsPhoto} />}
      {staff && status === "done" && (
        <Button size="default" disabled={pending} onClick={() => run("closed")}>
          <Lock className="size-4" /> შემოწმებულია, დახურვა
        </Button>
      )}
      {(staff || isAssignee) && status === "done" && (
        <Button size="default" variant="outline" disabled={pending} onClick={() => run("in_progress")}>
          <RotateCcw className="size-4" /> დაბრუნება მიმდინარეში
        </Button>
      )}
      {role === "admin" && status === "closed" && (
        <ConfirmButton title="დახურული შეკვეთის გახსნა" description="შეკვეთა დაბრუნდება „მიმდინარე“ სტატუსში. ეს ისტორიაში დაფიქსირდება." confirmLabel="გახსნა" variant="outline" size="default" action={() => setStatus(orderId, "in_progress")}>
          <RotateCcw className="size-4" /> გახსნა (ადმინი)
        </ConfirmButton>
      )}
      {staff && status === "cancelled" && (
        <Button size="default" variant="outline" disabled={pending} onClick={() => run("new")}>
          <RotateCcw className="size-4" /> აღდგენა
        </Button>
      )}
      {staff && (status === "new" || status === "assigned" || status === "in_progress") && (
        <ConfirmButton title="შეკვეთის გაუქმება" description="შეკვეთა გადავა „გაუქმებული“ სტატუსში. შემსრულებლები შეტყობინებას მიიღებენ." confirmLabel="გაუქმება" variant="destructive" size="default" action={() => setStatus(orderId, "cancelled")}>
          <XCircle className="size-4" /> გაუქმება
        </ConfirmButton>
      )}
    </div>
  );
}
