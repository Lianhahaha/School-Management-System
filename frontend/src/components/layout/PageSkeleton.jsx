import { Skeleton } from '../ui/Skeleton';

/** Placeholder for a page while its code or its main query is loading (detail pages, lazy chunks). */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 space-y-4 rounded-card border border-gray-200 bg-white p-5 shadow-card">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
