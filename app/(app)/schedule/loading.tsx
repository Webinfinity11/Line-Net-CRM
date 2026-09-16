import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="იტვირთება">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-7 w-56" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-11 flex-1" />
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-full" />
      <div className="grid gap-[18px] lg:grid-cols-[minmax(260px,3fr)_minmax(0,7fr)]">
        <Skeleton className="h-72" />
        <Skeleton className="h-[560px]" />
      </div>
    </div>
  );
}
