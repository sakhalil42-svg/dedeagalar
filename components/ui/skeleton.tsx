import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0" />
      </div>
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-card p-4", className)}>
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

function SkeletonKpiCard() {
  return (
    <div className="rounded-lg border bg-card p-2 sm:p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="hidden sm:block h-3.5 w-3.5" />
      </div>
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="flex h-40 items-end gap-1 px-4 pb-4 pt-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonText, SkeletonKpiCard, SkeletonChart };
