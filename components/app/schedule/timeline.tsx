import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/app/user-avatar";
import type { OrderStatus } from "@/db/schema";
import { STATUS_HEX, STATUS_TINT } from "@/lib/i18n";
import { formatMinutes } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

export type TimelineBlock = {
  id: number;
  number: string;
  title: string;
  client: string | null;
  status: OrderStatus;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
  clashWith: string[];
};

export type TimelineLane = {
  key: string;
  name: string;
  image?: string | null;
  unassigned?: boolean;
  load?: { hours: number; pct: number; over: boolean };
  blocks: TimelineBlock[];
};

const HOUR_PX = 56;

/**
 * Technician lanes on one vertical time axis. Server component: positions are computed
 * from minutes since local midnight; hours × HOUR_PX gives the canvas height.
 */
export function Timeline({
  lanes,
  axisStartMin,
  axisEndMin,
  normHours,
  nowMin,
}: {
  lanes: TimelineLane[];
  axisStartMin: number;
  axisEndMin: number;
  normHours: number;
  nowMin: number | null;
}) {
  const hours: number[] = [];
  for (let m = axisStartMin; m <= axisEndMin; m += 60) hours.push(m);
  const totalMin = axisEndMin - axisStartMin;
  const canvasH = (totalMin / 60) * HOUR_PX;
  const y = (min: number) => ((min - axisStartMin) / 60) * HOUR_PX;
  const columns = `var(--time-w) repeat(${lanes.length}, minmax(var(--lane-w), 1fr))`;
  const showNow = nowMin !== null && nowMin >= axisStartMin && nowMin <= axisEndMin;

  if (lanes.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">შემსრულებლები არ არიან დამატებული</div>;
  }

  const phoneList = (
    <div className="space-y-4 sm:hidden">
      {lanes.map((lane) => (
        <div key={lane.key}>
          <div className="mb-2 flex items-center gap-2">
            {!lane.unassigned && <UserAvatar name={lane.name} image={lane.image} size="sm" />}
            <span className={cn("text-[13px] font-medium", lane.unassigned && "text-[#b13f32]")}>{lane.name}</span>
            {lane.load && (
              <span className={cn("tabular ml-auto text-[11px]", lane.load.over ? "font-medium text-[#b13f32]" : "text-muted-foreground")}>
                {lane.load.hours} / {normHours} სთ
              </span>
            )}
          </div>
          {lane.blocks.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-[#e6ebf2] px-3 py-3 text-center text-[12px] text-muted-foreground">თავისუფალია</p>
          ) : (
            <ul className="space-y-2">
              {lane.blocks.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/orders/${b.id}`}
                    className="flex min-h-[56px] items-center gap-3 rounded-[12px] px-3 py-2.5"
                    style={{ background: STATUS_TINT[b.status], borderLeft: `3px solid ${STATUS_HEX[b.status]}` }}
                  >
                    <span className="tabular w-[92px] shrink-0 text-[12px] font-medium text-[#4a5e73]">
                      {formatMinutes(b.startMin)}–{formatMinutes(b.endMin)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{b.title}</span>
                      {b.client && <span className="block truncate text-[11.5px] text-muted-foreground">{b.client}</span>}
                      {b.clashWith.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#96610b]">
                          <AlertTriangle className="size-3" /> ემთხვევა: {b.clashWith.join(", ")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {phoneList}
      <div className="hidden sm:block">
    <div className="overflow-x-auto [--lane-w:160px] [--time-w:48px] md:[--lane-w:220px] md:[--time-w:65px]">
      <div className="min-w-max pb-4">
        {/* lane headers */}
        <div className="grid gap-x-2 border-b border-[#e6ebf2] pb-3" style={{ gridTemplateColumns: columns }}>
          <div />
          {lanes.map((lane) => (
            <div key={lane.key} className={cn("min-w-0 px-1", lane.unassigned && "rounded-md border border-dashed border-[#e0b4a8] bg-[#fff8f5] px-2 py-1")}>
              <div className="flex items-center gap-2">
                {lane.unassigned ? (
                  <span className="inline-grid size-6 place-items-center rounded-full bg-[#fff1ed] text-[10px] font-semibold text-[#b13f32]">!</span>
                ) : (
                  <UserAvatar name={lane.name} image={lane.image} size="sm" />
                )}
                <span className={cn("truncate text-[13px] font-medium", lane.unassigned && "text-[#b13f32]")}>{lane.name}</span>
                {lane.load && (
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular">
                    {lane.load.hours} / {normHours} სთ
                  </span>
                )}
              </div>
              {lane.load && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#eef1f6]" role="progressbar" aria-label={`${lane.name}, დაგეგმილია ${lane.load.hours} საათი ${normHours} საათიდან`} aria-valuenow={lane.load.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${lane.load.pct}%`, background: lane.load.over ? "#c75e50" : lane.load.pct > 75 ? "#bd9c56" : "#738fca" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* canvas */}
        <div className="relative grid gap-x-2 pt-2" style={{ gridTemplateColumns: columns }}>
          <div className="relative" style={{ height: canvasH }}>
            {hours.map((m) => (
              // the "now" marker carries its own time; hiding the hour underneath keeps both readable
              <div
                key={m}
                className={cn(
                  "absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular",
                  showNow && Math.abs((nowMin as number) - m) < 25 && "opacity-0",
                )}
                style={{ top: y(m) }}
              >
                {formatMinutes(m)}
              </div>
            ))}
          </div>
          {lanes.map((lane) => (
            <div
              key={lane.key}
              className="relative border-l border-dashed border-[#e6ebf2]"
              style={{
                height: canvasH,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #eceff5 ${HOUR_PX - 1}px, #eceff5 ${HOUR_PX}px)`,
              }}
            >
              {lane.blocks.length === 0 && (
                <div className="absolute inset-x-0 top-3 text-center text-[11px] text-[#8b98a9]">თავისუფალია</div>
              )}
              {lane.blocks.map((b) => {
                const clash = b.clashWith.length > 0;
                return (
                  <Link
                    key={b.id}
                    href={`/orders/${b.id}`}
                    className={cn(
                      "ln-pop absolute overflow-hidden rounded-[6px] p-2 text-[11px] leading-[1.45] text-foreground transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(38,57,104,0.12)] focus-visible:outline-2 focus-visible:outline-[#3457d5]",
                      clash ? "border border-[#f0c36a]" : "border border-transparent",
                    )}
                    style={{
                      top: y(b.startMin) + 1,
                      height: Math.max(44, ((b.endMin - b.startMin) / 60) * HOUR_PX - 2),
                      left: `calc(${(b.col / b.cols) * 100}% + 4px)`,
                      width: `calc(${100 / b.cols}% - 6px)`,
                      borderLeft: `3px solid ${STATUS_HEX[b.status]}`,
                      background: clash ? "#fff8ea" : STATUS_TINT[b.status],
                    }}
                    title={`${b.number} · ${b.title}`}
                  >
                    <div className="tabular font-medium text-[#4a5e73]">
                      {formatMinutes(b.startMin)}–{formatMinutes(b.endMin)}
                    </div>
                    <div className="line-clamp-2 font-medium">{b.title}</div>
                    {b.client && <div className="truncate text-[#617084]">{b.client}</div>}
                    {clash && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-[#96610b]">
                        <AlertTriangle className="size-3" /> ემთხვევა: {b.clashWith.join(", ")}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
          {showNow && (
            <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: y(nowMin) + 8 }} aria-hidden>
              <div className="flex items-center">
                <span className="w-[var(--time-w)] pr-2 text-right text-[10px] font-medium text-[#3457d5] tabular">{formatMinutes(nowMin)}</span>
                <span className="h-px flex-1 bg-[#3457d5]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      </div>
    </>
  );
}
