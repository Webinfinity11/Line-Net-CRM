import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard layout so the page does not jump while data loads. */
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[280px]" />
          <Skeleton className="h-4 w-[220px]" />
        </div>
        <Skeleton className="h-10 w-[260px] rounded-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px] rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-[20px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
        <Skeleton className="h-[200px] rounded-[20px]" />
        <Skeleton className="h-[200px] rounded-[20px]" />
        <Skeleton className="h-[200px] rounded-[20px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[260px] rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-[20px]" />
    </div>
  );
}
