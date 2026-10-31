import type { RiskCategory, RiskDriver } from "@/lib/data/risk";

export type ActionBadgeProps = {
  category: RiskCategory;
  driver: RiskDriver | null;
  isLivestock: boolean;
  locale: "en" | "rw";
  cropName: string;
  districtName: string;
  labels: {
    title: string;
    subtitle: string;
    sell: string;
    sellSub: string;
    sellAdvice: string;
    store: string;
    storeSub: string;
    storeAdvice: string;
    monitor: string;
    monitorSub: string;
    monitorAdvice: string;
    consult: string;
    consultSub: string;
    consultAdvice: string;
    currentPrice: string;
    previousPrice: string;
    priceChange: string;
    rwfUnit: string;
  };
};

const formatRwf = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));

const formatPct = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(
    Math.abs(value),
  );

export function ActionRecommendationCard({
  category,
  driver,
  isLivestock,
  locale,
  cropName,
  districtName,
  labels,
}: ActionBadgeProps) {
  // Determine recommendation state
  const hasValidData = !isLivestock && driver !== null && category !== "unavailable";

  let actionType: "sell" | "store" | "monitor" | "consult" = "consult";
  let rwfDiff = 0;
  let pctFormatted = "0%";
  let isPositive = false;

  if (hasValidData && driver) {
    rwfDiff = driver.recentAverage - driver.previousAverage;
    pctFormatted = formatPct(driver.changePct);
    isPositive = driver.changePct > 0;

    if (driver.changePct >= 0.08 || category === "high") {
      actionType = "sell";
    } else if (driver.changePct <= -0.05) {
      actionType = "store";
    } else {
      actionType = "monitor";
    }
  }

  // Visual styles per action
  const configs = {
    sell: {
      badgeText: labels.sell,
      subText: labels.sellSub,
      advice: labels.sellAdvice.replace("{percent}", pctFormatted),
      badgeBg: "bg-emerald-600 text-cream",
      badgeBorder: "border-emerald-700",
      cardBorder: "border-emerald-500/40",
      bgGlow: "bg-emerald-50/50",
      accentIcon: "▲",
      changeColor: "text-emerald-700 bg-emerald-100",
      symbol: "💰",
    },
    store: {
      badgeText: labels.store,
      subText: labels.storeSub,
      advice: labels.storeAdvice.replace("{percent}", pctFormatted),
      badgeBg: "bg-amber-600 text-cream",
      badgeBorder: "border-amber-700",
      cardBorder: "border-amber-500/40",
      bgGlow: "bg-amber-50/50",
      accentIcon: "▼",
      changeColor: "text-amber-800 bg-amber-100",
      symbol: "🛖",
    },
    monitor: {
      badgeText: labels.monitor,
      subText: labels.monitorSub,
      advice: labels.monitorAdvice.replace("{percent}", pctFormatted),
      badgeBg: "bg-canopy text-cream",
      badgeBorder: "border-canopy",
      cardBorder: "border-line",
      bgGlow: "bg-sprout/20",
      accentIcon: "●",
      changeColor: "text-leaf bg-sprout/60",
      symbol: "⚖️",
    },
    consult: {
      badgeText: labels.consult,
      subText: labels.consultSub,
      advice: labels.consultAdvice,
      badgeBg: "bg-stone-600 text-cream",
      badgeBorder: "border-stone-700",
      cardBorder: "border-dashed border-line",
      bgGlow: "bg-stone-50",
      accentIcon: "ℹ",
      changeColor: "text-muted bg-stone-200",
      symbol: "🧑‍🌾",
    },
  };

  const currentConfig = configs[actionType];

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 ${currentConfig.cardBorder} ${currentConfig.bgGlow} bg-paper p-6 shadow-sm sm:p-8`}
    >
      {/* Top Banner with Action Badge & Context */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-soil">
            {labels.title} · {districtName}
          </span>
          <h2 className="mt-1 text-2xl font-bold text-canopy sm:text-3xl">
            {cropName}
          </h2>
        </div>

        {/* Big Action Badge */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-lg font-black tracking-wide shadow-md ${currentConfig.badgeBg}`}
          >
            <span className="text-xl select-none">{currentConfig.symbol}</span>
            <span>{currentConfig.badgeText}</span>
          </div>
        </div>
      </div>

      {/* Price Spotlight Grid */}
      <div className="mt-6 grid gap-6 rounded-2xl border border-line bg-paper/90 p-5 sm:grid-cols-2 md:grid-cols-3">
        {/* Main Price */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted uppercase">
            {labels.currentPrice}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-canopy sm:text-4xl font-mono tabular-nums">
              {driver ? formatRwf(driver.recentAverage) : "—"}
            </span>
            <span className="text-sm font-semibold text-soil">{labels.rwfUnit}</span>
          </div>
          <span className="mt-1 text-xs text-muted">
            {districtName} ({locale === "rw" ? "impuzandengo y'ubu" : "recent 3mo avg"})
          </span>
        </div>

        {/* Price Difference / Change */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted uppercase">
            {labels.priceChange}
          </span>
          <div className="mt-1 flex items-center gap-2">
            {driver ? (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-base font-bold font-mono tabular-nums ${currentConfig.changeColor}`}
                >
                  <span>{isPositive ? "+" : "−"}</span>
                  <span>{formatRwf(Math.abs(rwfDiff))} RWF</span>
                  <span className="text-xs font-semibold">({pctFormatted})</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-muted">
                {locale === "rw" ? "Nta kigereranyo gihari" : "No trend calculated"}
              </span>
            )}
          </div>
          <span className="mt-1 text-xs text-muted">
            {driver
              ? `${labels.previousPrice}: ${formatRwf(driver.previousAverage)} RWF`
              : locale === "rw"
                ? "Baza agronome w'umurenge"
                : "Awaiting market feed"}
          </span>
        </div>

        {/* Recommendation summary note */}
        <div className="flex flex-col justify-center sm:col-span-2 md:col-span-1">
          <span className="text-xs font-bold uppercase text-soil">
            {currentConfig.subText}
          </span>
          <p className="mt-1 text-xs text-ink/80 leading-relaxed">
            {locale === "rw"
              ? "Ubu bushakashatsi bushingiye ku mibare y'isoko ry'aho uri yo gufasha gufata ibyemezo."
              : "Derived from localized market observations to protect producer incomes."}
          </p>
        </div>
      </div>

      {/* Clear Plain Language Action Guidance */}
      <div className="mt-5 rounded-2xl bg-cream/70 p-4 sm:p-5 border border-line/60">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl select-none">💡</span>
          <div>
            <h4 className="text-sm font-bold text-canopy">
              {locale === "rw" ? "Icyo gukora muri iki gihe:" : "Recommended step:"}
            </h4>
            <p className="mt-1 text-sm font-medium text-ink leading-relaxed">
              {currentConfig.advice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
