import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";

/**
 * Phone sizing for form fields: comfortable touch targets below `sm`, dense on desktop.
 * Put it on the wrapper that holds the inputs.
 */
export const formFields =
  "[&_input:not([type=checkbox]):not([type=radio])]:h-11 [&_select]:h-11 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_input:not([type=checkbox]):not([type=radio])]:h-8 sm:[&_select]:h-8";

/** Shared table classes so every secondary page reads the same way. */
export const tableCls = {
  wrap: "ln-card overflow-hidden",
  scroll: "overflow-x-auto",
  table: "w-full text-[13px]",
  head: "bg-[#fbfcfe]",
  th: "px-4 py-3 text-left text-[11px] font-medium text-muted-foreground",
  thRight: "px-4 py-3 text-right text-[11px] font-medium text-muted-foreground",
  row: "border-t border-[#eef1f6] transition-colors hover:bg-[#f8faff]",
  td: "px-4 py-[14px]",
  tdRight: "px-4 py-[14px] text-right whitespace-nowrap tabular",
};

/** One white surface with a heading row. Never nest these. */
export function SectionCard({
  title,
  icon: Icon,
  aside,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** muted text on the right of the heading */
  aside?: ReactNode;
  /** button or link on the right of the heading */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("ln-card min-w-0 p-6", className)} aria-label={title}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold">
          {Icon && <Icon className="size-4 text-muted-foreground [stroke-width:1.7]" />}
          {toMtavruli(title)}
          {aside ? <span className="text-[11.5px] font-normal text-muted-foreground">{aside}</span> : null}
        </h2>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * Phone list: the same rows a table shows on desktop, as readable cards.
 * Pair it with a `hidden sm:block` table so each viewport gets the right shape.
 */
export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-[#eef1f6] sm:hidden", className)}>{children}</ul>;
}

/** One row of a DataList: title with optional link, meta lines, a right-hand value and optional actions. */
export function DataRow({
  href,
  title,
  meta,
  right,
  actions,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  actions?: ReactNode;
}) {
  const head = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-snug text-foreground">{title}</div>
        {meta ? <div className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">{meta}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-right text-[12.5px]">{right}</div> : null}
    </div>
  );
  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      {href ? (
        <Link href={href} className="block min-h-[44px] rounded-[12px] transition-colors active:bg-[#f8faff]">
          {head}
        </Link>
      ) : (
        head
      )}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}

/** Dashed placeholder: one icon, one sentence, at most one action. */
export function EmptyState({ icon: Icon, message, action, className }: { icon: LucideIcon; message: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-dashed border-[#e6ebf2] px-4 py-10 text-center", className)}>
      <Icon className="mx-auto mb-2.5 size-6 text-[#c2ccd8] [stroke-width:1.6]" />
      <p className="text-[12.5px] text-muted-foreground">{message}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Small neutral chip for metadata (specialisations, flags). */
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-1.5 py-[3px] text-[11px] font-medium",
        tone === "accent" && "bg-[#edf2ff] text-[#3457d5]",
        tone === "warn" && "bg-[#fff4df] text-[#96610b]",
        tone === "neutral" && "bg-[#f1f4f9] text-[#566b7d]",
      )}
    >
      {children}
    </span>
  );
}
