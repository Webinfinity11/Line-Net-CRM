import { Check } from "lucide-react";
import { customerProgress, WORKFLOW_STEPS } from "@/lib/workflow-view";
import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

export function WorkflowProgress({ status, triaged, scheduled, compact = false }: {
  status: OrderStatus; triaged: boolean; scheduled: boolean; compact?: boolean;
}) {
  const progress = customerProgress(status, triaged, scheduled);
  const finished = progress.step === WORKFLOW_STEPS.length - 1;
  const accent = finished ? "text-[#18845b] dark:text-[var(--ln-success)]" : "text-primary";
  return <div className={cn("@container mt-4 rounded-xl bg-[#f5f7fb] dark:bg-muted", compact ? "p-3 sm:p-3.5" : "p-4 sm:p-5")}>
    {progress.step >= 0 && <>
      <div className={cn("flex items-center justify-between gap-3", compact ? "mb-2.5 text-[12px]" : "mb-4 text-[13px]")}>
        <span className={cn("flex items-center gap-2 font-semibold", accent)}>
          {finished && <Check className="size-4" aria-hidden="true" />}
          {compact && progress.step === 4 ? "შემოწმება" : WORKFLOW_STEPS[progress.step]}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">ეტაპი {progress.step + 1} / {WORKFLOW_STEPS.length}</span>
      </div>
      <div role="progressbar" aria-label="შეკვეთის ეტაპები" aria-valuemin={1}
        aria-valuemax={WORKFLOW_STEPS.length} aria-valuenow={progress.step + 1}
        aria-valuetext={WORKFLOW_STEPS[progress.step]}
        className={cn("overflow-hidden rounded-full bg-[#dfe5ef] dark:bg-border", compact ? "h-1" : "h-1.5")}>
        <div className={cn("workflow-progress-fill relative h-full origin-left overflow-hidden rounded-full transition-[transform,background-color] duration-700 ease-out motion-reduce:transition-none", finished ? "bg-[#18845b] dark:bg-[var(--ln-success)]" : "workflow-progress-running bg-primary")}
          style={{ transform: `scaleX(${(progress.step + 1) / WORKFLOW_STEPS.length})` }} />
      </div>
      {!compact && <ol aria-label="შეკვეთის ეტაპები" className="mt-4 grid grid-cols-1 gap-2 @min-[360px]:grid-cols-2 @min-[560px]:grid-cols-3 @min-[900px]:grid-cols-6">
        {WORKFLOW_STEPS.map((label, index) => {
          const current = index === progress.step;
          const done = index < progress.step || finished;
          return <li key={label} aria-current={current ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2 rounded-lg border p-2.5 transition-colors duration-500 motion-reduce:transition-none",
              current ? finished ? "border-[#c0e4d2] dark:border-[var(--ln-success-line)] bg-[#eaf6ef] dark:bg-[var(--ln-success-bg)]" : "border-[#c0dde1] dark:border-primary bg-card shadow-sm" : "border-transparent") }>
            <span aria-hidden="true" className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-500 motion-reduce:transition-none",
              done ? "bg-[#deeee6] dark:bg-[var(--ln-success-bg)] text-[#18845b] dark:text-[var(--ln-success)]" : current ? "bg-primary text-white dark:text-primary-foreground" : "bg-border text-muted-foreground")}>
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("min-w-0 break-words text-[12px] leading-5", current ? cn("font-semibold", accent) : "text-muted-foreground")}>{label}</span>
          </li>;
        })}
      </ol>}
    </>}
    <p key={progress.step} className={cn("text-[12px] leading-relaxed text-[#4a5a6c] dark:text-[var(--ln-strong)] animate-in fade-in duration-500 motion-reduce:animate-none", progress.step >= 0 && (compact ? "mt-2.5" : "mt-4"))}>{progress.detail}</p>
  </div>;
}
