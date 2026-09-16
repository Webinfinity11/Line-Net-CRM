import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, kicker, actions }: { title: string; subtitle?: ReactNode; kicker?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <div className="text-[11px] tracking-[0.3px] text-muted-foreground">{kicker}</div> : null}
        <h1 className="mt-0.5 font-heading text-2xl font-medium leading-[1.35] tracking-[-0.4px] text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
