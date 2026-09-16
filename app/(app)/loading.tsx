import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton that mirrors the dashboard layout while data loads. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="იტვირთება">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-[11px]" />
        ))}
      </div>
      <div className="grid gap-[21px] lg:grid-cols-[minmax(0,1.8fr)_minmax(190px,1fr)]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
      <Skeleton className="h-[72px] rounded-xl" />
    </div>
  );
}
