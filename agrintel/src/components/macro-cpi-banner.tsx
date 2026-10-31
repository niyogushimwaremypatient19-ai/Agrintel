import type { MacroCpiRecord } from "@/lib/data/macro-cpi";

interface MacroCpiBannerProps {
  cpi: MacroCpiRecord;
  labels: {
    title: string;
    badge: string;
    foodInflation: string;
    ruralCpi: string;
    urbanCpi: string;
    divergence: string;
    divergenceExplanation: string;
    sourcePrefix: string;
  };
}

export function MacroCpiBanner({ cpi, labels }: MacroCpiBannerProps) {
  return (
    <article
      aria-labelledby="macro-cpi-heading"
      className="@container rounded-2xl border border-line bg-paper p-5 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-clay/10 px-2.5 py-0.5 text-xs font-semibold text-clay">
            {labels.badge} · {cpi.period}
          </span>
          <h2 id="macro-cpi-heading" className="text-base font-bold text-canopy">
            {labels.title}
          </h2>
        </div>
        <p className="text-xs text-muted">
          {labels.sourcePrefix}: <span className="font-medium text-ink">{cpi.source}</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 @md:grid-cols-4">
        {/* Metric 1: Food Inflation YoY */}
        <div className="rounded-xl bg-cream/60 p-3 border border-line/40">
          <span className="text-xs font-medium text-muted block">{labels.foodInflation}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-clay font-mono tabular-nums">+{cpi.food_inflation_yoy.toFixed(1)}%</span>
            <span className="text-xs text-clay/80 font-medium">YoY</span>
          </div>
          <span className="mt-1 text-[11px] text-muted block">National food price jump</span>
        </div>

        {/* Metric 2: Rural CPI */}
        <div className="rounded-xl bg-cream/60 p-3 border border-line/40">
          <span className="text-xs font-medium text-muted block">{labels.ruralCpi}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-canopy font-mono tabular-nums">{cpi.rural_cpi.toFixed(1)}</span>
            <span className="text-xs text-muted">pts</span>
          </div>
          <span className="mt-1 text-[11px] text-clay font-medium block">Smallholder living cost index</span>
        </div>

        {/* Metric 3: Urban CPI */}
        <div className="rounded-xl bg-cream/60 p-3 border border-line/40">
          <span className="text-xs font-medium text-muted block">{labels.urbanCpi}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-ink font-mono tabular-nums">{cpi.urban_cpi.toFixed(1)}</span>
            <span className="text-xs text-muted">pts</span>
          </div>
          <span className="mt-1 text-[11px] text-muted block">Kigali & secondary cities</span>
        </div>

        {/* Metric 4: Divergence Spread */}
        <div className="rounded-xl bg-forest/5 p-3 border border-forest/20">
          <span className="text-xs font-medium text-forest block">{labels.divergence}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-forest font-mono tabular-nums">+{cpi.rural_urban_divergence.toFixed(1)}</span>
            <span className="text-xs text-forest/80 font-semibold">pts spread</span>
          </div>
          <span className="mt-1 text-[11px] text-forest/90 font-medium block">Rural price index penalty</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink/90 leading-relaxed border-t border-line/40 pt-2.5">
        <strong className="text-canopy font-semibold">Empirical Policy Insight:</strong> {labels.divergenceExplanation}
      </p>
    </article>
  );
}
