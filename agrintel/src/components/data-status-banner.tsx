import type { Dictionary } from "@/lib/i18n";

type Props = {
  verifiedCount: number;
  sampleCount: number;
  labels: Dictionary["status"];
};

/**
 * Shown on every public page. It must never hide the fact that sample data is in use.
 * Colour is not the only signal: each state also has a text label.
 */
export function DataStatusBanner({ verifiedCount, sampleCount, labels }: Props) {
  const noneVerified = verifiedCount === 0;

  return (
    <section
      aria-labelledby="data-status-title"
      className={`rounded-lg border-l-4 px-4 py-3 ${
        noneVerified
          ? "border-harvest bg-sprout/60"
          : "border-leaf bg-sprout"
      }`}
    >
      <h2 id="data-status-title" className="font-sans text-base font-semibold text-canopy">
        {labels.bannerTitle}
      </h2>
      <p className="mt-1 text-sm text-ink">
        <span className="font-semibold">{verifiedCount}</span> {labels.verifiedCount} ·{" "}
        {sampleCount > 0 ? (
          <>
            <span className="font-semibold">{sampleCount}</span> {labels.sampleCount}
          </>
        ) : (
          <span className="font-semibold text-forest">
            {labels.empiricalOnly ?? "100% empirical official data"}
          </span>
        )}
      </p>
      {noneVerified ? <p className="mt-1 text-sm text-ink">{labels.noneVerified}</p> : null}
    </section>
  );
}
