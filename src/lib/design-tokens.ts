/**
 * AgrIntel Design Tokens & Accessibility Standards
 * 
 * Single source of truth for color semantics, typography tokens,
 * WCAG 2.1 AA compliant text/contrast pairings, and chart palettes.
 * Prevents "Design System Drift" and hardcoded raw hex strings.
 */

export const tokens = {
  brand: {
    canopy: "#1f4d2b",      // Primary brand green: headings, navigation, primary actions
    canopyDark: "#15351e",
    leaf: "#3f7d3a",        // Secondary brand green: positive trends, links
    leafDark: "#2c5728",
    sprout: "#dcebc8",      // Light highlight background
    sproutDark: "#4a6b2c",
  },
  accent: {
    harvest: "#d9a441",     // Harvest gold: moderate risk, highlights
    harvestDark: "#85580e", // WCAG AA compliant on light background (ratio > 4.5:1)
    soil: "#5c3d23",        // Volcanic soil brown: secondary text accents, borders
    clay: "#b5562e",        // Terracotta red: high risk, alerts, negative residuals
    clayDark: "#7d3618",
  },
  neutral: {
    cream: "#faf6ec",       // Page canvas background
    paper: "#ffffff",       // Surface / Card background
    ink: "#1e2a21",         // Primary readable body text
    muted: "#45534a",       // Secondary readable text (ratio > 4.5:1 on cream/paper)
    line: "#d9d3c2",        // Clean structural borders
    lineLight: "#ede9de",
  },
  risk: {
    low: "#3f7d3a",         // Low Risk / Nominal Expected
    moderate: "#b87c14",    // Moderate Risk / Notice
    high: "#b5562e",        // High Risk / Severe Leakage or Anomaly
    unavailable: "#6e736c", // Data Pending / Unmonitored
  },
  chart: {
    grid: "#d9d3c2",
    axis: "#45534a",
    observedLine: "#1f4d2b",
    observedDotFill: "#1f4d2b",
    observedDotStroke: "#faf6ec",
    forecastLine: "#b5562e",
    forecastBandFill: "#dcebc8",
    forecastBandStroke: "#a8c98e",
    referenceLine: "#5c3d23",
  },
} as const;

export type RiskCategoryKey = "low" | "moderate" | "high" | "unavailable";

/**
 * Returns WCAG AA compliant CSS classes for badges and indicators.
 * Explicitly avoids low-contrast yellow-on-white text failures.
 */
export function getRiskBadgeClasses(category: RiskCategoryKey): {
  badge: string;
  pill: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (category) {
    case "low":
      return {
        badge: "bg-leaf/15 text-leaf border-leaf/30",
        pill: "bg-leaf text-paper",
        border: "border-leaf/40",
        text: "text-leaf",
        icon: "🟢",
      };
    case "moderate":
      // Uses harvestDark or soil for text to ensure WCAG AA readability
      return {
        badge: "bg-harvest/20 text-[#85580e] border-[#85580e]/30 font-medium",
        pill: "bg-[#85580e] text-paper",
        border: "border-harvest/50",
        text: "text-[#85580e]",
        icon: "🟡",
      };
    case "high":
      return {
        badge: "bg-clay/15 text-clay border-clay/30",
        pill: "bg-clay text-paper",
        border: "border-clay/40",
        text: "text-clay",
        icon: "🔴",
      };
    case "unavailable":
    default:
      return {
        badge: "bg-[#8a8f88]/15 text-[#55645a] border-[#8a8f88]/30",
        pill: "bg-[#6e736c] text-paper",
        border: "border-[#8a8f88]/40",
        text: "text-[#55645a]",
        icon: "⚪",
      };
  }
}

/**
 * Returns authoritative hex code for SVG and Canvas elements
 */
export function getRiskColorHex(category: RiskCategoryKey | string): string {
  switch (category) {
    case "low":
      return tokens.risk.low;
    case "moderate":
      return tokens.risk.moderate;
    case "high":
      return tokens.risk.high;
    case "unavailable":
    default:
      return tokens.risk.unavailable;
  }
}
