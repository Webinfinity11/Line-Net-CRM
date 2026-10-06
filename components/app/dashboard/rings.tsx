"use client";

import { CountUp, Reveal, Ring } from "@/components/app/motion";
import type { OrderStatus } from "@/db/schema";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";

const integer = (value: number) => String(Math.round(value));
const percentage = (value: number) => `${Math.round(value)}%`;
type Slice = { label: string; value: number; color: string };

function RingCard({ title, period, view, segments, value, percent, caption, note }: {
  title: string; period: string; view: string; segments: Slice[]; value: number; percent?: boolean; caption: string; note: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <Reveal as="section" view={view} ariaLabel={title} className="ln-card min-w-0 flex-1 p-6 max-md:p-4 xl:basis-[400px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-[15px]">{toMtavruli(title)}</h2>
        <span className="text-[11.5px] text-muted-foreground">{period}</span>
      </div>
      <div className="my-4 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <Ring segments={segments} label={total ? segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ") : "მონაცემები არ არის"}>
          {total > 0 || !percent ? <CountUp value={value} format={percent ? percentage : integer} className="font-heading text-[30px] font-bold" /> : <span className="text-[30px] text-muted-foreground">—</span>}
          <span className="text-[11.5px] text-muted-foreground">{caption}</span>
        </Ring>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {segments.map((segment) => <li key={segment.label} className="flex items-center gap-2 text-[12px]">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
            <span className="flex-1">{segment.label}</span>
            <span className="tabular font-medium">{segment.value}</span>
          </li>)}
        </ul>
      </div>
      <p className="text-[11.5px] leading-[18px] text-muted-foreground">{total === 0 ? "ამ პერიოდში შეკვეთები არ არის." : note}</p>
    </Reveal>
  );
}

export function DashboardRings({ counts, timeliness, period }: {
  counts: Partial<Record<OrderStatus, number>>;
  timeliness: { total: number; onTime: number; late: number; unknown: number };
  period: string;
}) {
  // Reuse the muted status-chip family instead of introducing another palette.
  const statuses = STATUS_ORDER.map((status) => ({ label: STATUS_LABELS[status], value: counts[status] ?? 0, color: STATUS_COLORS[status].match(/text-\[(#[\da-f]+)\]/i)?.[1] ?? "#65717f" }));
  const total = statuses.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap">
      <RingCard title="შეკვეთების სტატუსები" view="status-ring" period={period} segments={statuses} value={total} caption="სულ შეკვეთა" note="პერიოდში შექმნილი შეკვეთების მიმდინარე სტატუსები." />
      <RingCard title="დროზე შესრულება" view="timeliness-ring" period={period}
        segments={[
          { label: "ვადაში", value: timeliness.onTime, color: "#397b83" },
          { label: "დაგვიანებით", value: timeliness.late, color: "#b13f32" },
          { label: "ვადა არ აქვს", value: timeliness.unknown, color: "#93a0b0" },
        ]}
        value={timeliness.total ? timeliness.onTime / timeliness.total * 100 : 0} percent caption="ვადაში"
        note={`პერიოდში შესრულებული ${timeliness.total} შეკვეთიდან ვადაში ჩაბარდა ${timeliness.onTime}. ვადის გარეშე შეკვეთებიც შედის ჯამში.`} />
    </div>
  );
}
