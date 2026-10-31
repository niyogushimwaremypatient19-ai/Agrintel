export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-8 animate-in fade-in duration-300"
    >
      {/* Accessible Screen-Reader Announcement */}
      <span className="sr-only">
        Loading AgrIntel Rwanda agricultural intelligence and live market data...
      </span>

      {/* Top Banner Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full skeleton-shimmer" />
          <div className="h-4 w-48 rounded skeleton-shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full skeleton-shimmer" />
          <div className="h-6 w-28 rounded-full skeleton-shimmer" />
        </div>
      </div>

      {/* Page Header Skeleton with Semantic Activity Bar */}
      <div className="max-w-2xl space-y-3">
        <div className="inline-flex items-center gap-2">
          <div className="h-5 w-32 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-10 w-3/4 rounded-lg skeleton-shimmer" />
        <div className="h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-5/6 rounded skeleton-shimmer" />
      </div>

      {/* Domain Process Indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-sprout bg-sprout/20 px-4 py-3 text-xs text-canopy">
        <progress
          aria-label="Synchronizing agricultural dataset"
          className="h-1.5 w-24 overflow-hidden rounded-full bg-sprout accent-leaf"
        />
        <span className="font-semibold">
          Synchronizing 30-district agro-climatic anomalies & market price observations...
        </span>
      </div>

      {/* 3-Column Metric Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((card) => (
          <div
            key={card}
            className="flex flex-col justify-between rounded-2xl border border-line bg-paper p-6 shadow-xs min-h-[220px]"
          >
            <div className="space-y-3">
              <div className="h-5 w-28 rounded-full skeleton-shimmer" />
              <div className="h-8 w-36 rounded-md skeleton-shimmer" />
              <div className="h-4 w-44 rounded skeleton-shimmer" />
              <div className="h-12 w-full rounded skeleton-shimmer" />
            </div>
            <div className="mt-6 h-10 w-full rounded-xl skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Primary Visual / Chart / Table Skeleton */}
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-xs min-h-[360px] flex flex-col justify-between">
        <div className="flex justify-between items-center border-b border-line pb-4">
          <div className="h-6 w-56 rounded skeleton-shimmer" />
          <div className="flex gap-2">
            <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
            <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
          </div>
        </div>
        <div className="my-8 h-48 w-full rounded-xl skeleton-shimmer" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-4 w-40 rounded skeleton-shimmer" />
          <div className="h-4 w-28 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
