export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'animate-pulse rounded-md bg-paper-200/70',
        className,
      ].join(' ')}
    />
  );
}

export function CookListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-steel/10 py-4"
        >
          <Skeleton className="h-16 w-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
