export const DEFAULT_PLANNED_MINUTES = 120;

export type Slot = { id: number; userId: string; start: Date; end: Date };

export function plannedEnd(start: Date, plannedMinutes: number | null | undefined): Date {
  return new Date(start.getTime() + (plannedMinutes ?? DEFAULT_PLANNED_MINUTES) * 60_000);
}

/** Returns, per slot id, the ids of other slots of the same user that overlap in time. */
export function findOverlaps(slots: Slot[]): Map<number, number[]> {
  const byUser = new Map<string, Slot[]>();
  for (const s of slots) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  const out = new Map<number, number[]>();
  for (const list of byUser.values()) {
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (b.start >= a.end) break;
        if (a.start < b.end && b.start < a.end) {
          out.set(a.id, [...(out.get(a.id) ?? []), b.id]);
          out.set(b.id, [...(out.get(b.id) ?? []), a.id]);
        }
      }
    }
  }
  return out;
}

/** Planned workload as a share of the daily norm (hours). Capped at 100 for the bar, raw value kept for the label. */
export function workload(plannedMinutesTotal: number, normHours: number): { pct: number; hours: number; over: boolean } {
  const hours = Math.round((plannedMinutesTotal / 60) * 10) / 10;
  const raw = normHours > 0 ? (plannedMinutesTotal / 60 / normHours) * 100 : 0;
  return { pct: Math.min(100, Math.round(raw)), hours, over: raw > 100 };
}

export function tbilisiDayBounds(dateIso: string): { start: Date; end: Date } {
  const start = new Date(`${dateIso}T00:00:00+04:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

export function tbilisiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function tbilisiTime(d: Date): string {
  return new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit" }).format(d);
}

export type LaneSlot = { id: number; start: Date; end: Date };
export type LanePlacement = { id: number; col: number; cols: number };

/**
 * Side-by-side layout for one lane: slots that overlap in time share a cluster and get
 * separate columns; `cols` is the cluster width so blocks can be sized as 1/cols.
 */
export function layoutLane(slots: LaneSlot[]): LanePlacement[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const out: LanePlacement[] = [];
  let cluster: { id: number; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, colEnds.length);
    for (const c of cluster) out.push({ id: c.id, col: c.col, cols });
    cluster = [];
    colEnds = [];
  };
  for (const s of sorted) {
    if (s.start.getTime() >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let col = colEnds.findIndex((e) => e <= s.start.getTime());
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(s.end.getTime());
    } else colEnds[col] = s.end.getTime();
    cluster.push({ id: s.id, col });
    clusterEnd = Math.max(clusterEnd, s.end.getTime());
  }
  flush();
  return out;
}

/** Minutes between a day's local midnight (Tbilisi) and the given instant. */
export function minutesIntoDay(d: Date, dayStart: Date): number {
  return Math.round((d.getTime() - dayStart.getTime()) / 60_000);
}

/** 615 → "10:15" (minutes counted from local midnight). */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
