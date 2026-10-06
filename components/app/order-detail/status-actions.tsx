"use client";

import { Lock, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import type { OrderStatus, UserRole } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/i18n";
import { ConfirmButton } from "../confirm-button";
import { StartButton } from "../my-visit-controls";
import { CompleteDialog } from "./complete-dialog";

/**
 * Primary flow buttons. On a phone the bar is pinned above the bottom navigation so the next
 * action is always one thumb away, whatever the scroll position; on desktop it sits in the flow.
 */
export function StatusActions({
  emailsEnabled = false,
  doneByMe,
  startedByMe = false,
  orderId,
  status,
  role,
  isAssignee,
  requiredLeft,
}: {
  emailsEnabled?: boolean;
  doneByMe?: boolean;
  startedByMe?: boolean;
  orderId: number;
  status: OrderStatus;
  role: UserRole;
  isAssignee: boolean;
  requiredLeft: number;
}) {
  const [sendReport, setSendReport] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const staff = role === "admin" || role === "manager";

  function run(to: OrderStatus) {
    start(async () => {
      const res = await setStatus(orderId, to, to === "closed" && sendReport);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`სტატუსი: ${STATUS_LABELS[to]}`);
      router.refresh();
    });
  }

  if (!staff && doneByMe && status === "in_progress") return <p className="text-[13px]">ჩაბარებულია, ელოდება კოლეგას</p>;
  const canComplete = (staff || isAssignee) && (status === "assigned" || status === "in_progress");
  // a technician opens the visit first ("დაწყება"), as on /my; only then is the handover offered
  const needsStart = canComplete && !staff && !doneByMe && !startedByMe;
  const next =
    status === "new"
      ? "შემდეგი ნაბიჯი: შემსრულებლის დანიშვნა"
      : status === "assigned"
        ? "შემდეგი ნაბიჯი: შემსრულებელი იწყებს ვიზიტს („დაწყება“) და ასრულებს სამუშაოს"
        : status === "in_progress"
          ? "შემდეგი ნაბიჯი: სამუშაოს ჩაბარება მოკლე აღწერით"
          : status === "done"
            ? "შემდეგი ნაბიჯი: მენეჯერი ამოწმებს და ხურავს შეკვეთას"
            : status === "closed"
              ? "შეკვეთა დახურულია. ცვლილება მხოლოდ ადმინს შეუძლია"
              : "შეკვეთა გაუქმებულია";

  // on a phone the next action rides above the bottom navigation, always within thumb reach
  const primary = "h-11 w-full md:w-auto";
  const secondary = "h-11 flex-1 md:flex-none";

  const hasActions =
    canComplete ||
    (staff && status === "done") ||
    ((staff || isAssignee) && status === "done") ||
    (role === "admin" && status === "closed") ||
    (staff && status === "cancelled") ||
    (staff && (status === "new" || status === "assigned" || status === "in_progress"));

  // nothing left to do on this order: a card with one grey line would only look like an empty box
  if (!hasActions) {
    return (
      <p className="flex items-center gap-2 px-1 text-[12.5px] text-muted-foreground" aria-live="polite">
        <Lock className="size-3.5 shrink-0" />
        {next}
      </p>
    );
  }

  return (
    <div
      className="ln-card fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-20 flex flex-wrap items-center gap-2 p-3 shadow-[0_-8px_28px_rgba(16,24,40,0.14)] md:static md:inset-auto md:p-4 md:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_26px_rgba(16,24,40,0.05)]"
      aria-live="polite"
    >
      <span className="hidden text-muted-foreground md:mr-auto md:inline md:text-[12.5px]">{next}</span>
      {needsStart && <StartButton orderId={orderId} stay className={primary} />}
      {canComplete && !needsStart && <CompleteDialog orderId={orderId} requiredLeft={requiredLeft} className={primary} />}
      {staff && status === "done" && <label className="w-full text-[12px]"><input type="checkbox" disabled={!emailsEnabled} checked={sendReport} onChange={e => setSendReport(e.target.checked)}/> კლიენტს გაეგზავნოს რეპორტი და ინვოისი{!emailsEnabled && <span className="block text-muted-foreground">კლიენტის მეილები გამორთულია</span>}</label>}
      {staff && status === "done" && (
        <Button size="default" className={primary} disabled={pending} onClick={() => run("closed")}>
          <Lock className="size-4" /> დადასტურება და დახურვა
        </Button>
      )}
      {(staff || isAssignee) && status === "done" && (
        <Button size="default" variant="outline" className={secondary} disabled={pending} onClick={() => run("in_progress")}>
          <RotateCcw className="size-4" /> მიმდინარე სტატუსზე დაბრუნება
        </Button>
      )}
      {role === "admin" && status === "closed" && (
        <ConfirmButton title="დახურული შეკვეთის გახსნა" description="შეკვეთა დაბრუნდება „მიმდინარე“ სტატუსში. ეს ისტორიაში დაფიქსირდება." confirmLabel="გახსნა" variant="outline" size="default" className={secondary} action={() => setStatus(orderId, "in_progress")}>
          <RotateCcw className="size-4" /> გახსნა (ადმინი)
        </ConfirmButton>
      )}
      {staff && status === "cancelled" && (
        <Button size="default" variant="outline" className={secondary} disabled={pending} onClick={() => run("new")}>
          <RotateCcw className="size-4" /> აღდგენა
        </Button>
      )}
      {staff && (status === "new" || status === "assigned" || status === "in_progress") && (
        <ConfirmButton title="შეკვეთის გაუქმება" description="შეკვეთა გადავა „გაუქმებული“ სტატუსში. შემსრულებლები შეტყობინებას მიიღებენ." confirmLabel="შეკვეთის გაუქმება" variant="destructive" size="default" className={secondary} action={() => setStatus(orderId, "cancelled")}>
          <XCircle className="size-4" /> გაუქმება
        </ConfirmButton>
      )}
    </div>
  );
}
