import type { RiskCategory } from "@/lib/data/risk";

const styles: Record<RiskCategory, string> = {
  low: "bg-risk-low text-paper",
  moderate: "bg-risk-moderate text-ink",
  high: "bg-risk-high text-paper",
  unavailable: "bg-muted text-paper",
};

/**
 * The text label carries the meaning. Colour only reinforces it, so the badge still
 * works in greyscale print and for colour-blind users.
 */
export function RiskBadge({ category, label }: { category: RiskCategory; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${styles[category]}`}
    >
      {label}
    </span>
  );
}
