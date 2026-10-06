"use client";

import { useState } from "react";
import { formatDate } from "@/lib/i18n";

export type HistoryEntry = { id: number; text: string; who: string; at: Date; count: number };

const COMPACT = 5;

/** Quiet by default: the newest handful, with the rest one click away. */
export function OrderHistory({ entries }: { entries: HistoryEntry[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, COMPACT);
  if (entries.length === 0) return <p className="text-[12.5px] text-muted-foreground">ისტორია ცარიელია</p>;
  return (
    <>
      <ol className="space-y-2.5 border-l border-[#eef1f6] pl-4 text-[12.5px]">
        {shown.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-[#dbe1ec]" />
            <div>
              {e.text}
              {e.count > 1 && <span className="ml-1 text-[11px] text-muted-foreground">×{e.count}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {e.who} · {formatDate(e.at, true)}
            </div>
          </li>
        ))}
      </ol>
      {entries.length > COMPACT && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="ln-link mt-3 text-[11.5px] font-medium transition-colors"
        >
          {all ? "მოკლედ ჩვენება" : `ყველას ჩვენება (${entries.length})`}
        </button>
      )}
    </>
  );
}
