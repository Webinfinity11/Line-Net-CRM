import type { ReactNode } from "react";
import { toMtavruli } from "@/lib/mtavruli";

export function PageHeader({ title, subtitle, kicker, actions, titleAction }: { title: string; subtitle?: ReactNode; kicker?: ReactNode; actions?: ReactNode; titleAction?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <div className="text-[11px] tracking-[0.3px] text-muted-foreground">{kicker}</div> : null}
        <div className="flex items-center gap-2">
          <h1 className="mt-0.5 font-heading text-[24px] leading-[1.3] tracking-[-0.4px] text-foreground">{toMtavruli(title)}</h1>
          {titleAction}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
